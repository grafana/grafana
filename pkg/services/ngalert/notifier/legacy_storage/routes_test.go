package legacy_storage

import (
	"fmt"
	"testing"

	"github.com/prometheus/alertmanager/config"
	"github.com/prometheus/alertmanager/dispatch"
	"github.com/prometheus/alertmanager/pkg/labels"
	"github.com/prometheus/common/model"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/grafana/alerting/definition"

	policy_exports "github.com/grafana/grafana/pkg/services/ngalert/api/test-data/policy-exports"
	"github.com/grafana/grafana/pkg/services/ngalert/api/tooling/definitions"
	"github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/util"
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

	child := &definition.Route{
		Receiver: "child",
	}

	mr := &ManagedRoute{
		Name:           "managed",
		Receiver:       "receiver",
		GroupBy:        []string{"alertname", "cluster"},
		GroupWait:      &gw,
		GroupInterval:  &gi,
		RepeatInterval: &ri,
		Routes:         []*definition.Route{child},
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
	assert.EqualValues(t, definitions.Provenance("test"), route.Provenance)
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

func TestWithManagedRoutes(t *testing.T) {
	rev := func(root *definitions.Route, managedRoutes map[string]*definitions.Route) *ConfigRevision {
		return &ConfigRevision{
			Config: &definitions.PostableUserConfig{
				AlertmanagerConfig: definitions.PostableApiAlertingConfig{
					Config: definitions.Config{
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

		expectedRoute *definitions.Route
	}{
		{
			name: "simple, root is empty just adds managed routes",
			rev: rev(policy_exports.Empty(),
				map[string]*definitions.Route{
					"override-inherit": policy_exports.OverrideInherit(),
					"matcher-variety":  policy_exports.MatcherVariety(),
				},
			),
			expectedRoute: &definitions.Route{
				Receiver: policy_exports.Empty().Receiver,
				Routes: []*definitions.Route{
					NewManagedRoute("matcher-variety", policy_exports.MatcherVariety()).GeneratedSubRoute(),
					NewManagedRoute("override-inherit", policy_exports.OverrideInherit()).GeneratedSubRoute(),
				},
			},
		},
		{
			name: "complex root with existing routes merges to end of routes",
			rev: rev(&definitions.Route{
				Receiver: "root-receiver",
				Routes: []*definitions.Route{
					{ObjectMatchers: definitions.ObjectMatchers{{Name: "severity", Type: labels.MatchEqual, Value: "warn"}}, Continue: true},
					{ObjectMatchers: definitions.ObjectMatchers{{Name: "severity", Type: labels.MatchNotEqual, Value: "critical"}}, Continue: true},
					{ObjectMatchers: definitions.ObjectMatchers{{Name: "severity", Type: labels.MatchRegexp, Value: "info"}}, Continue: true},
					{ObjectMatchers: definitions.ObjectMatchers{{Name: "severity", Type: labels.MatchNotRegexp, Value: "debug"}}, Continue: true},
				},
			},
				map[string]*definitions.Route{
					"r1": {Receiver: "recv1"},
					"r2": {Receiver: "recv2"},
				},
			),
			expectedRoute: &definitions.Route{
				Receiver: "root-receiver",
				Routes: []*definitions.Route{
					{
						Receiver:       "recv1",
						ObjectMatchers: definitions.ObjectMatchers{{Name: NamedRouteMatcher, Type: labels.MatchEqual, Value: "r1"}},
						GroupWait:      util.Pointer(model.Duration(dispatch.DefaultRouteOpts.GroupWait)),
						GroupInterval:  util.Pointer(model.Duration(dispatch.DefaultRouteOpts.GroupInterval)),
						RepeatInterval: util.Pointer(model.Duration(dispatch.DefaultRouteOpts.RepeatInterval)),
					},
					{
						Receiver:       "recv2",
						ObjectMatchers: definitions.ObjectMatchers{{Name: NamedRouteMatcher, Type: labels.MatchEqual, Value: "r2"}},
						GroupWait:      util.Pointer(model.Duration(dispatch.DefaultRouteOpts.GroupWait)),
						GroupInterval:  util.Pointer(model.Duration(dispatch.DefaultRouteOpts.GroupInterval)),
						RepeatInterval: util.Pointer(model.Duration(dispatch.DefaultRouteOpts.RepeatInterval)),
					},
					{ObjectMatchers: definitions.ObjectMatchers{{Name: "severity", Type: labels.MatchEqual, Value: "warn"}}, Continue: true},
					{ObjectMatchers: definitions.ObjectMatchers{{Name: "severity", Type: labels.MatchNotEqual, Value: "critical"}}, Continue: true},
					{ObjectMatchers: definitions.ObjectMatchers{{Name: "severity", Type: labels.MatchRegexp, Value: "info"}}, Continue: true},
					{ObjectMatchers: definitions.ObjectMatchers{{Name: "severity", Type: labels.MatchNotRegexp, Value: "debug"}}, Continue: true},
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
	subtree := definitions.Route{
		Receiver: origRev.Config.AlertmanagerConfig.Receivers[0].Name,
	}

	t.Run("rejects empty name", func(t *testing.T) {
		_, err := testConfig().CreateManagedRoute("", subtree)
		assert.ErrorContains(t, err, "name")
		assert.ErrorContains(t, err, "required")
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
		_, err := testConfig().CreateManagedRoute("test", definitions.Route{})
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
	subtree := definitions.Route{
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
		_, err := rev.UpdateNamedRoute(getAnyKey(t, rev.Config.ManagedRoutes), definitions.Route{})
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
	newRoute := definitions.Route{
		Receiver: rev.Config.AlertmanagerConfig.Receivers[0].Name,
	}
	defaultCfg := definitions.PostableUserConfig{
		AlertmanagerConfig: definitions.PostableApiAlertingConfig{
			Config: definitions.Config{
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
	newRoute = definitions.Route{
		Receiver: name,
	}
	defaultCfg = definitions.PostableUserConfig{
		AlertmanagerConfig: definitions.PostableApiAlertingConfig{
			Config: definitions.Config{
				Route: &definitions.Route{
					Receiver: name,
				},
			},
			Receivers: []*definition.PostableApiReceiver{
				{
					Receiver: config.Receiver{
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
		validRoute := definitions.Route{
			Receiver: rev.Config.AlertmanagerConfig.Receivers[0].Name,
		}
		err := rev.ValidateRoute(validRoute)
		require.NoError(t, err)
	})

	t.Run("fails route structural validation", func(t *testing.T) {
		rev := testConfig()

		// Empty receiver is invalid for root.
		invalid := definitions.Route{
			Receiver: "",
		}

		err := rev.ValidateRoute(invalid)
		require.ErrorContains(t, err, "default receiver")
	})

	t.Run("fails when receiver does not exist", func(t *testing.T) {
		rev := testConfig()

		invalid := definitions.Route{
			Receiver: "missing-receiver",
		}

		err := rev.ValidateRoute(invalid)
		require.ErrorContains(t, err, "missing-receiver")
	})

	t.Run("fails when mute time interval does not exist", func(t *testing.T) {
		rev := testConfig()

		invalid := definitions.Route{
			Receiver: rev.Config.AlertmanagerConfig.Receivers[0].Name,
			Routes: []*definitions.Route{
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

		invalid := definitions.Route{
			Receiver: rev.Config.AlertmanagerConfig.Receivers[0].Name,
			Routes: []*definitions.Route{
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
