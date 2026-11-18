package notifier

import (
	"testing"

	"github.com/grafana/alerting/definition"
	"github.com/prometheus/alertmanager/dispatch"
	"github.com/prometheus/alertmanager/pkg/labels"
	"github.com/prometheus/common/model"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	policy_exports "github.com/grafana/grafana/pkg/services/ngalert/api/test-data/policy-exports"
	"github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/services/ngalert/notifier/legacy_storage"
	v1 "github.com/grafana/grafana/pkg/services/ngalert/notifier/legacy_storage/v1"
)

func TestManagedRoute_GeneratedSubRoute_DefaultsAndMatcher(t *testing.T) {
	mr := &v1.ManagedRoute{
		ResourceMetadata: v1.ResourceMetadata{UID: "managed"},
		Receiver:         "receiver",
	}

	route := GeneratedSubRoute(mr)

	assert.Equal(t, model.Duration(dispatch.DefaultRouteOpts.GroupWait), *route.GroupWait)
	assert.Equal(t, model.Duration(dispatch.DefaultRouteOpts.GroupInterval), *route.GroupInterval)
	assert.Equal(t, model.Duration(dispatch.DefaultRouteOpts.RepeatInterval), *route.RepeatInterval)

	require.Len(t, route.ObjectMatchers, 1)
	assert.Equal(t, NamedRouteMatcher, route.ObjectMatchers[0].Name)
	assert.Equal(t, "managed", route.ObjectMatchers[0].Value)
}

func TestManagedRoute_GeneratedSubRoute_UserDefinedHasNoMatcher(t *testing.T) {
	mr := &v1.ManagedRoute{
		ResourceMetadata: v1.ResourceMetadata{UID: models.DefaultRoutingTreeName},
		Receiver:         "receiver",
	}

	route := GeneratedSubRoute(mr)
	require.Empty(t, route.ObjectMatchers)
}

func TestManagedRoute_GeneratedSubRoute_PreservesFields(t *testing.T) {
	gw := model.Duration(10)
	gi := model.Duration(20)
	ri := model.Duration(30)

	child := &v1.Route{
		Receiver: "child",
	}

	mr := &v1.ManagedRoute{
		ResourceMetadata: v1.ResourceMetadata{
			UID:        "managed",
			Provenance: models.Provenance("test"),
		},
		Receiver:       "receiver",
		GroupBy:        []string{"alertname", "cluster"},
		GroupWait:      &gw,
		GroupInterval:  &gi,
		RepeatInterval: &ri,
		Routes:         []*v1.Route{child},
	}

	route := GeneratedSubRoute(mr)

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
	assert.EqualValues(t, definition.Provenance("test"), route.Provenance)
}

func TestWithManagedRoutes(t *testing.T) {
	rev := func(root *v1.Route, managedRoutes map[string]*v1.Route) *legacy_storage.ConfigRevision {
		return &legacy_storage.ConfigRevision{
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

		rev *legacy_storage.ConfigRevision

		expectedRoute *definition.Route
	}{
		{
			name: "simple, root is empty just adds managed routes",
			rev: rev(policy_exports.Empty(),
				map[string]*v1.Route{
					"override-inherit": policy_exports.OverrideInherit(),
					"matcher-variety":  policy_exports.MatcherVariety(),
				},
			),
			expectedRoute: &definition.Route{
				Receiver: policy_exports.Empty().Receiver,
				Routes: []*definition.Route{
					GeneratedSubRoute(v1.NewManagedRoute("matcher-variety", policy_exports.MatcherVariety())),
					GeneratedSubRoute(v1.NewManagedRoute("override-inherit", policy_exports.OverrideInherit())),
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
			expectedRoute: &definition.Route{
				Receiver: "root-receiver",
				Routes: []*definition.Route{
					{
						Receiver:       "recv1",
						ObjectMatchers: definition.ObjectMatchers{{Name: NamedRouteMatcher, Type: labels.MatchEqual, Value: "r1"}},
						GroupWait:      new(model.Duration(dispatch.DefaultRouteOpts.GroupWait)),
						GroupInterval:  new(model.Duration(dispatch.DefaultRouteOpts.GroupInterval)),
						RepeatInterval: new(model.Duration(dispatch.DefaultRouteOpts.RepeatInterval)),
					},
					{
						Receiver:       "recv2",
						ObjectMatchers: definition.ObjectMatchers{{Name: NamedRouteMatcher, Type: labels.MatchEqual, Value: "r2"}},
						GroupWait:      new(model.Duration(dispatch.DefaultRouteOpts.GroupWait)),
						GroupInterval:  new(model.Duration(dispatch.DefaultRouteOpts.GroupInterval)),
						RepeatInterval: new(model.Duration(dispatch.DefaultRouteOpts.RepeatInterval)),
					},
					{ObjectMatchers: definition.ObjectMatchers{{Name: "severity", Type: labels.MatchEqual, Value: "warn"}}, Continue: true},
					{ObjectMatchers: definition.ObjectMatchers{{Name: "severity", Type: labels.MatchNotEqual, Value: "critical"}}, Continue: true},
					{ObjectMatchers: definition.ObjectMatchers{{Name: "severity", Type: labels.MatchRegexp, Value: "info"}}, Continue: true},
					{ObjectMatchers: definition.ObjectMatchers{{Name: "severity", Type: labels.MatchNotRegexp, Value: "debug"}}, Continue: true},
				},
			},
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			result := WithManagedRoutes(tc.rev.Config)
			assert.Equal(t, tc.expectedRoute, result)
		})
	}
}
