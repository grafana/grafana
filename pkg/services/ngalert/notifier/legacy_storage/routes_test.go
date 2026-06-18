package legacy_storage

import (
	"fmt"
	"strings"
	"testing"

	"github.com/grafana/alerting/definition"
	"github.com/prometheus/alertmanager/dispatch"
	"github.com/prometheus/alertmanager/pkg/labels"
	"github.com/prometheus/common/model"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	policy_exports "github.com/grafana/grafana/pkg/services/ngalert/api/test-data/policy-exports"
	"github.com/grafana/grafana/pkg/services/ngalert/models"
	v1 "github.com/grafana/grafana/pkg/services/ngalert/notifier/legacy_storage/v1"
	"github.com/grafana/grafana/pkg/services/sqlstore/migrations/ualert"
)

func TestManagedRoute_GeneratedSubRoute_DefaultsAndMatcher(t *testing.T) {
	mr := &ManagedRoute{
		Name:     "managed",
		Receiver: "receiver",
	}

	route := mr.GeneratedSubRoute()

	assert.Equal(t, model.Duration(dispatch.DefaultRouteOpts.GroupWait), *route.GroupWait)
	assert.Equal(t, model.Duration(dispatch.DefaultRouteOpts.GroupInterval), *route.GroupInterval)
	assert.Equal(t, model.Duration(dispatch.DefaultRouteOpts.RepeatInterval), *route.RepeatInterval)

	require.Len(t, route.ObjectMatchers, 1)
	assert.Equal(t, NamedRouteMatcher, route.ObjectMatchers[0].Name)
	assert.Equal(t, "managed", route.ObjectMatchers[0].Value)
}

func TestManagedRoute_GeneratedSubRoute_UserDefinedHasNoMatcher(t *testing.T) {
	mr := &ManagedRoute{
		Name:     UserDefinedRoutingTreeName,
		Receiver: "receiver",
	}

	route := mr.GeneratedSubRoute()
	require.Empty(t, route.ObjectMatchers)
}

func TestManagedRoute_GeneratedSubRoute_PreservesFields(t *testing.T) {
	gw := model.Duration(10)
	gi := model.Duration(20)
	ri := model.Duration(30)

	child := &v1.Route{
		Receiver: "child",
	}

	mr := &ManagedRoute{
		Name:           "managed",
		Receiver:       "receiver",
		GroupBy:        []string{"alertname", "cluster"},
		GroupWait:      &gw,
		GroupInterval:  &gi,
		RepeatInterval: &ri,
		Routes:         []*v1.Route{child},
		Provenance:     models.Provenance("test"),
	}

	route := mr.GeneratedSubRoute()

	// Basic fields preserved
	assert.Equal(t, "receiver", route.Receiver)
	assert.Equal(t, []string{"alertname", "cluster"}, route.GroupByStr)
	assert.Equal(t, &gw, route.GroupWait)
	assert.Equal(t, &gi, route.GroupInterval)
	assert.Equal(t, &ri, route.RepeatInterval)

	// Child routes preserved
	require.Len(t, route.Routes, 1)
	assert.Equal(t, "child", route.Routes[0].Receiver)

	// Managed route matcher added
	require.Len(t, route.ObjectMatchers, 1)
	assert.Equal(t, NamedRouteMatcher, route.ObjectMatchers[0].Name)
	assert.Equal(t, "managed", route.ObjectMatchers[0].Value)

	// Provenance propagated
	assert.EqualValues(t, v1.Provenance("test"), route.Provenance)
}

func TestManagedRoutes_Sort(t *testing.T) {
	routes := ManagedRoutes{
		{Name: "x"},
		{Name: UserDefinedRoutingTreeName},
		{Name: "z"},
	}

	routes.Sort()

	require.Equal(t, "x", routes[0].Name)
	require.Equal(t, "z", routes[1].Name)
	require.Equal(t, UserDefinedRoutingTreeName, routes[2].Name)
}

func TestManagedRoutes_Contains(t *testing.T) {
	routes := ManagedRoutes{
		{Name: "x"},
		{Name: UserDefinedRoutingTreeName},
		{Name: "z"},
	}
	assert.True(t, routes.Contains("x"))
	assert.True(t, routes.Contains("z"))
	assert.True(t, routes.Contains(UserDefinedRoutingTreeName))
	assert.False(t, routes.Contains("missing"))
}

func TestWithManagedRoutes(t *testing.T) {
	rev := func(root *v1.Route, managedRoutes map[string]*v1.Route) *ConfigRevision {
		return &ConfigRevision{
			Config: &v1.AMConfigV1{
				AlertmanagerConfig: v1.PostableApiAlertingConfig{
					Config: v1.Config{
						Route: root,
					},
				},
				ManagedRoutes: managedRoutes,
			},
		}
	}
	testCases := []struct {
		name string

		rev *ConfigRevision

		expectedRoute *v1.Route
	}{
		{
			name: "simple, root is empty just adds managed routes",
			rev: rev(policy_exports.Empty(),
				map[string]*v1.Route{
					"override-inherit": policy_exports.OverrideInherit(),
					"matcher-variety":  policy_exports.MatcherVariety(),
				},
			),
			expectedRoute: &v1.Route{
				Receiver: policy_exports.Empty().Receiver,
				Routes: []*v1.Route{
					NewManagedRoute("matcher-variety", policy_exports.MatcherVariety()).GeneratedSubRoute(),
					NewManagedRoute("override-inherit", policy_exports.OverrideInherit()).GeneratedSubRoute(),
				},
			},
		},
		{
			name: "complex root with existing routes merges to end of routes",
			rev: rev(&v1.Route{
				Receiver: "root-receiver",
				Routes: []*v1.Route{
					{ObjectMatchers: v1.ObjectMatchers{{Name: "severity", Type: labels.MatchEqual, Value: "warn"}}, Continue: true},
					{ObjectMatchers: v1.ObjectMatchers{{Name: "severity", Type: labels.MatchNotEqual, Value: "critical"}}, Continue: true},
					{ObjectMatchers: v1.ObjectMatchers{{Name: "severity", Type: labels.MatchRegexp, Value: "info"}}, Continue: true},
					{ObjectMatchers: v1.ObjectMatchers{{Name: "severity", Type: labels.MatchNotRegexp, Value: "debug"}}, Continue: true},
				},
			},
				map[string]*v1.Route{
					"r1": {Receiver: "recv1"},
					"r2": {Receiver: "recv2"},
				},
			),
			expectedRoute: &v1.Route{
				Receiver: "root-receiver",
				Routes: []*v1.Route{
					{
						Receiver:       "recv1",
						ObjectMatchers: v1.ObjectMatchers{{Name: NamedRouteMatcher, Type: labels.MatchEqual, Value: "r1"}},
						GroupWait:      new(model.Duration(dispatch.DefaultRouteOpts.GroupWait)),
						GroupInterval:  new(model.Duration(dispatch.DefaultRouteOpts.GroupInterval)),
						RepeatInterval: new(model.Duration(dispatch.DefaultRouteOpts.RepeatInterval)),
					},
					{
						Receiver:       "recv2",
						ObjectMatchers: v1.ObjectMatchers{{Name: NamedRouteMatcher, Type: labels.MatchEqual, Value: "r2"}},
						GroupWait:      new(model.Duration(dispatch.DefaultRouteOpts.GroupWait)),
						GroupInterval:  new(model.Duration(dispatch.DefaultRouteOpts.GroupInterval)),
						RepeatInterval: new(model.Duration(dispatch.DefaultRouteOpts.RepeatInterval)),
					},
					{ObjectMatchers: v1.ObjectMatchers{{Name: "severity", Type: labels.MatchEqual, Value: "warn"}}, Continue: true},
					{ObjectMatchers: v1.ObjectMatchers{{Name: "severity", Type: labels.MatchNotEqual, Value: "critical"}}, Continue: true},
					{ObjectMatchers: v1.ObjectMatchers{{Name: "severity", Type: labels.MatchRegexp, Value: "info"}}, Continue: true},
					{ObjectMatchers: v1.ObjectMatchers{{Name: "severity", Type: labels.MatchNotRegexp, Value: "debug"}}, Continue: true},
				},
			},
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			result := WithManagedRoutes(tc.rev.Config.AlertmanagerConfig.Route, tc.rev.Config.ManagedRoutes)
			assert.Equal(t, tc.expectedRoute, result)
		})
	}
}

func TestConfigRevision_GetManagedRoute(t *testing.T) {
	rev := testConfig()

	for name, expected := range rev.Config.ManagedRoutes {
		t.Run(fmt.Sprintf("returns managed route %s", name), func(t *testing.T) {
			got := rev.GetManagedRoute(name)
			require.NotNil(t, got)
			assert.Equal(t, NewManagedRoute(name, expected), got)
		})
	}

	t.Run("returns user-defined route", func(t *testing.T) {
		got := rev.GetManagedRoute(UserDefinedRoutingTreeName)
		require.NotNil(t, got)
		assert.Equal(t, UserDefinedRoutingTreeName, got.Name)
		assert.Equal(t, NewManagedRoute(UserDefinedRoutingTreeName, rev.Config.AlertmanagerConfig.Route), got)
	})

	t.Run("returns nil if not found", func(t *testing.T) {
		require.Nil(t, rev.GetManagedRoute("missing"))
	})
}

func TestConfigRevision_DefaultRoutingTreeAliases(t *testing.T) {
	// The default (root) tree must be addressable by both its canonical name and the alias
	// so existing clients that reference "user-defined" keep working.
	require.Equal(t, models.DefaultRoutingTreeName, UserDefinedRoutingTreeName)

	t.Run("both names resolve to the root route and echo the requested name", func(t *testing.T) {
		for _, name := range []string{models.DefaultRoutingTreeName, models.DefaultRoutingTreeNameAlias} {
			t.Run(name, func(t *testing.T) {
				rev := testConfig()
				got := rev.GetManagedRoute(name)
				require.NotNil(t, got)
				// Name echoes the requested alias so the API response preserves the client's name.
				assert.Equal(t, name, got.Name)
				// The underlying route is the root route regardless of which alias was used.
				assert.Equal(t, NewManagedRoute(name, rev.Config.AlertmanagerConfig.Route), got)
				// Identity is canonical so RBAC scopes and provenance keys are stable across aliases.
				assert.Equal(t, models.DefaultRoutingTreeName, got.GetUID())
				assert.Equal(t, "", got.ResourceID())
			})
		}
	})

	t.Run("both names are reserved and cannot be created as managed routes", func(t *testing.T) {
		subtree := v1.Route{Receiver: testConfig().Config.AlertmanagerConfig.Receivers[0].Name}
		for _, name := range []string{models.DefaultRoutingTreeName, models.DefaultRoutingTreeNameAlias} {
			t.Run(name, func(t *testing.T) {
				_, err := testConfig().CreateManagedRoute(name, subtree)
				assert.ErrorIs(t, err, models.ErrRouteExists)
				assert.ErrorContains(t, err, "reserved")
			})
		}
	})
}

func TestConfigRevision_GetManagedRoutes(t *testing.T) {
	rev := testConfig()

	t.Run("returns all managed routes", func(t *testing.T) {
		routes := rev.GetManagedRoutes(true)

		expected := make([]*ManagedRoute, 0, len(rev.Config.ManagedRoutes)+1)
		for name, mr := range rev.Config.ManagedRoutes {
			expected = append(expected, NewManagedRoute(name, mr))
		}
		expected = append(expected, NewManagedRoute(UserDefinedRoutingTreeName, rev.Config.AlertmanagerConfig.Route))

		assert.Len(t, routes, len(expected))
		assert.ElementsMatch(t, routes, expected)
	})

	t.Run("returns only default route when flag is false", func(t *testing.T) {
		// Ignore non-default routes when `includeManagedRoutes=false`
		routes := rev.GetManagedRoutes(false)

		assert.Len(t, routes, 1)
		assert.Equal(t, routes[0], NewManagedRoute(UserDefinedRoutingTreeName, rev.Config.AlertmanagerConfig.Route))
	})
}

func TestConfigRevision_CreateManagedRoute(t *testing.T) {
	origRev := testConfig()
	subtree := v1.Route{
		Receiver: origRev.Config.AlertmanagerConfig.Receivers[0].Name,
	}

	t.Run("validates name", func(t *testing.T) {
		testCases := []struct {
			name        string
			routeName   string
			expectErr   bool
			errContains string
		}{
			// Empty / blank.
			{name: "empty string", routeName: "", expectErr: true, errContains: "required"},
			{name: "whitespace-only", routeName: "   ", expectErr: true, errContains: "required"},
			// Length
			{name: "too long", routeName: strings.Repeat("a", ualert.UIDMaxLength+1), expectErr: true, errContains: "cannot be longer"},
			// Colon is rejected before DNS1123 check.
			{name: "contains colon", routeName: "my:route", expectErr: true, errContains: ":"},
			{name: "colon only", routeName: ":", expectErr: true, errContains: ":"},
			// DNS1123 subdomain violations.
			{name: "uppercase letter", routeName: "MyRoute", expectErr: true, errContains: "DNS subdomain"},
			{name: "space in name", routeName: "my route", expectErr: true, errContains: "DNS subdomain"},
			{name: "underscore", routeName: "my_route", expectErr: true, errContains: "DNS subdomain"},
			{name: "leading hyphen", routeName: "-myroute", expectErr: true, errContains: "DNS subdomain"},
			{name: "trailing hyphen", routeName: "myroute-", expectErr: true, errContains: "DNS subdomain"},
			// Valid names.
			{name: "simple lowercase", routeName: "myroute", expectErr: false},
			{name: "with hyphens", routeName: "my-route-1", expectErr: false},
			{name: "with dots", routeName: "my.route.name", expectErr: false},
			{name: "max length (253 chars)", routeName: strings.Repeat("a", ualert.UIDMaxLength), expectErr: false},
		}
		for _, tc := range testCases {
			t.Run(tc.name, func(t *testing.T) {
				_, err := testConfig().CreateManagedRoute(tc.routeName, subtree)
				if tc.expectErr {
					assert.ErrorIs(t, err, models.ErrRouteInvalidFormat)
					if tc.errContains != "" {
						assert.ErrorContains(t, err, tc.errContains)
					}
				} else {
					assert.NoError(t, err)
				}
			})
		}
	})

	t.Run("rejects reserved name", func(t *testing.T) {
		_, err := testConfig().CreateManagedRoute(UserDefinedRoutingTreeName, subtree)
		assert.ErrorContains(t, err, "reserved")
		assert.ErrorContains(t, err, UserDefinedRoutingTreeName)
		assert.ErrorIs(t, err, models.ErrRouteExists)
	})

	t.Run("rejects duplicate name", func(t *testing.T) {
		rev := testConfig()
		_, err := rev.CreateManagedRoute(getAnyKey(t, rev.Config.ManagedRoutes), subtree)
		assert.ErrorIs(t, err, models.ErrRouteExists)
	})

	t.Run("rejects invalid route", func(t *testing.T) {
		_, err := testConfig().CreateManagedRoute("test", v1.Route{})
		assert.ErrorIs(t, err, models.ErrRouteInvalidFormat)
	})

	t.Run("creates valid managed route", func(t *testing.T) {
		rev := testConfig()
		name := "test"
		mr, err := rev.CreateManagedRoute(name, subtree)
		assert.NoError(t, err)
		assert.NotNil(t, mr)
		assert.Equal(t, name, mr.Name)

		assert.Contains(t, rev.Config.ManagedRoutes, name)
		assert.Equal(t, &subtree, rev.Config.ManagedRoutes[name])
	})
}

func TestConfigRevision_UpdateNamedRoute(t *testing.T) {
	origRev := testConfig()
	subtree := v1.Route{
		Receiver: origRev.Config.AlertmanagerConfig.Receivers[0].Name,
	}

	t.Run("rejects empty name", func(t *testing.T) {
		_, err := testConfig().UpdateNamedRoute("", subtree)
		assert.ErrorContains(t, err, "name")
		assert.ErrorContains(t, err, "required")
	})

	t.Run("reserved name updates default", func(t *testing.T) {
		rev := testConfig()
		_, err := rev.UpdateNamedRoute(UserDefinedRoutingTreeName, subtree)
		assert.NoError(t, err)
		assert.Equal(t, &subtree, rev.Config.AlertmanagerConfig.Route)
	})

	t.Run("rejects invalid route", func(t *testing.T) {
		rev := testConfig()
		_, err := rev.UpdateNamedRoute(getAnyKey(t, rev.Config.ManagedRoutes), v1.Route{})
		assert.ErrorIs(t, err, models.ErrRouteInvalidFormat)
	})

	t.Run("updates valid managed route", func(t *testing.T) {
		rev := testConfig()
		name := getAnyKey(t, rev.Config.ManagedRoutes)
		mr, err := rev.UpdateNamedRoute(name, subtree)
		assert.NoError(t, err)
		assert.NotNil(t, mr)
		assert.Equal(t, name, mr.Name)

		assert.Contains(t, rev.Config.ManagedRoutes, name)
		assert.Equal(t, &subtree, rev.Config.ManagedRoutes[name])
	})
}

func TestConfigRevision_DeleteManagedRoute(t *testing.T) {
	rev := testConfig()
	for name := range policy_exports.Config().ManagedRoutes {
		rev.DeleteManagedRoute(name)

		assert.NotContains(t, rev.Config.ManagedRoutes, name)
		assert.Nil(t, rev.GetManagedRoute(name))
	}
}

func TestConfigRevision_ResetUserDefinedRoute(t *testing.T) {
	rev := testConfig()
	original := rev.Config.AlertmanagerConfig.Route
	newRoute := v1.Route{
		Receiver: rev.Config.AlertmanagerConfig.Receivers[0].Name,
	}
	defaultCfg := v1.AMConfigV1{
		AlertmanagerConfig: v1.PostableApiAlertingConfig{
			Config: v1.Config{
				Route: &newRoute,
			},
		},
	}
	mr, err := rev.ResetUserDefinedRoute(&defaultCfg)
	assert.NoError(t, err)
	assert.NotNil(t, mr)
	assert.Equal(t, UserDefinedRoutingTreeName, mr.Name)

	assert.Equal(t, &newRoute, rev.Config.AlertmanagerConfig.Route)
	assert.NotEqual(t, original, rev.Config.AlertmanagerConfig.Route)

	// Now we try with a default config that has an invalid receiver.
	// We don't fail the reset if the new default receiver exists in the default config,
	// instead we create it as per the definition.
	name := "deleted_default"
	newRoute = v1.Route{
		Receiver: name,
	}
	defaultCfg = v1.AMConfigV1{
		AlertmanagerConfig: v1.PostableApiAlertingConfig{
			Config: v1.Config{
				Route: &v1.Route{
					Receiver: name,
				},
			},
			Receivers: []*v1.PostableApiReceiver{
				{
					Receiver: definition.Receiver{
						Name: name,
					},
				},
			},
		},
	}
	mr, err = rev.ResetUserDefinedRoute(&defaultCfg)
	assert.NoError(t, err)
	assert.NotNil(t, mr)
	assert.Equal(t, UserDefinedRoutingTreeName, mr.Name)

	assert.Equal(t, &newRoute, rev.Config.AlertmanagerConfig.Route)
	assert.NotEqual(t, original, rev.Config.AlertmanagerConfig.Route)

	assert.Contains(t, rev.GetReceiversNames(), name)
}

// The intention here isn't to be exhaustive; route validation is done at length elsewhere. Instead, we hit the main
// sources of validation issues to ensure it's calling the correct code-paths.
func TestConfigRevision_ValidateRoute(t *testing.T) {
	t.Run("valid route passes validation", func(t *testing.T) {
		rev := testConfig()
		validRoute := v1.Route{
			Receiver: rev.Config.AlertmanagerConfig.Receivers[0].Name,
		}
		err := rev.ValidateRoute(validRoute)
		require.NoError(t, err)
	})

	t.Run("fails route structural validation", func(t *testing.T) {
		rev := testConfig()

		// Empty receiver is invalid for root.
		invalid := v1.Route{
			Receiver: "",
		}

		err := rev.ValidateRoute(invalid)
		require.ErrorContains(t, err, "default receiver")
	})

	t.Run("fails when receiver does not exist", func(t *testing.T) {
		rev := testConfig()

		invalid := v1.Route{
			Receiver: "missing-receiver",
		}

		err := rev.ValidateRoute(invalid)
		require.ErrorContains(t, err, "missing-receiver")
	})

	t.Run("fails when mute time interval does not exist", func(t *testing.T) {
		rev := testConfig()

		invalid := v1.Route{
			Receiver: rev.Config.AlertmanagerConfig.Receivers[0].Name,
			Routes: []*v1.Route{
				{
					MuteTimeIntervals: []string{"missing-interval"},
				},
			},
		}

		err := rev.ValidateRoute(invalid)
		require.ErrorContains(t, err, "missing-interval")
	})

	t.Run("fails when active time interval does not exist", func(t *testing.T) {
		rev := testConfig()

		invalid := v1.Route{
			Receiver: rev.Config.AlertmanagerConfig.Receivers[0].Name,
			Routes: []*v1.Route{
				{
					ActiveTimeIntervals: []string{"missing-interval"},
				},
			},
		}

		err := rev.ValidateRoute(invalid)
		require.ErrorContains(t, err, "missing-interval")
	})
}

func testConfig() *ConfigRevision {
	rev := &ConfigRevision{
		Config: policy_exports.Config(),
	}
	return rev
}

func getAnyKey[T any](t *testing.T, m map[string]*T) string {
	for k := range m {
		return k
	}
	t.Error("map is empty")
	return ""
}
