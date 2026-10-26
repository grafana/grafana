package resource

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"strconv"
	"strings"
	"testing"

	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/testutil"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	otelcodes "go.opentelemetry.io/otel/codes"
	sdktrace "go.opentelemetry.io/otel/sdk/trace"
	"go.opentelemetry.io/otel/sdk/trace/tracetest"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apimachinery/pkg/selection"

	authnlib "github.com/grafana/authlib/authn"
	authlib "github.com/grafana/authlib/types"
	"github.com/grafana/grafana-app-sdk/app"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/infra/log/logtest"
	"github.com/grafana/grafana/pkg/services/dashboards/dashboardaccess"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
)

// userWithDelegatedPermissions mirrors what search-api sees when storage-api
// searches on behalf of a user.
func userWithDelegatedPermissions(delegated ...string) *identity.StaticRequester {
	return &identity.StaticRequester{
		Type:      authlib.TypeUser,
		UserID:    1,
		Namespace: "stacks-1",
		AccessTokenClaims: &authnlib.Claims[authnlib.AccessTokenClaims]{
			Rest: authnlib.AccessTokenClaims{
				Namespace:            "stacks-1",
				DelegatedPermissions: delegated,
			},
		},
	}
}

// tokenWithoutDelegation carries service permissions but no delegated ones,
// which is what storage-api's token looked like during the incident.
func tokenWithoutDelegation() *identity.StaticRequester {
	id := userWithDelegatedPermissions()
	id.AccessTokenClaims.Rest.Permissions = []string{"dashboards.insights:read"}
	return id
}

func newLimitedClient(t *testing.T) *authzLimitedClient {
	t.Helper()
	c, ok := NewAuthzLimitedClient(authlib.FixedAccessClient(true), AuthzOptions{Registry: prometheus.NewRegistry()}).(*authzLimitedClient)
	require.True(t, ok)
	return c
}

func missingDelegatedCount(c *authzLimitedClient, group, resource, verb string) float64 {
	return testutil.ToFloat64(c.metrics.servicePermissionFailures.WithLabelValues(group, resource, verb, "delegated", strconv.FormatBool(!c.IsCompatibleWithRBAC(group, resource))))
}

func TestCheckServicePermission(t *testing.T) {
	for name, tc := range map[string]struct {
		id        authlib.AuthInfo
		wantErr   bool
		wantCount float64
	}{
		// The incident shape: the token carries service permissions but cannot act
		// for a user on this resource.
		"token with permissions but none delegated": {
			id:        tokenWithoutDelegation(),
			wantErr:   true,
			wantCount: 1,
		},
		"access token with no visible permissions": {
			id: &identity.StaticRequester{
				Type: authlib.TypeUser, Namespace: "stacks-1", AccessToken: "verified-token",
			},
			wantErr:   true,
			wantCount: 1,
		},
		// Single-tenant and in-process callers carry no token permissions.
		"no token permissions at all": {
			id: userWithDelegatedPermissions(),
		},
		"delegated permission for the resource": {
			id: userWithDelegatedPermissions("dashboard.grafana.app/dashboards:get"),
		},
		// A permission without a resource covers every resource in the group.
		"delegated permission for the whole group": {
			id: userWithDelegatedPermissions("dashboard.grafana.app:get"),
		},
		// Without a user there is nothing to delegate.
		"service call without a user": {
			id: &identity.StaticRequester{Type: authlib.TypeAccessPolicy, Namespace: "stacks-1"},
		},
	} {
		t.Run(name, func(t *testing.T) {
			c := newLimitedClient(t)

			err := c.checkServicePermission(t.Context(), tc.id, "dashboard.grafana.app", "dashboards", utils.VerbGet)

			if tc.wantErr {
				require.ErrorIs(t, err, ErrServiceCannotDelegate)
				assert.Contains(t, err.Error(), "dashboard.grafana.app/dashboards:get")
			} else {
				require.NoError(t, err)
			}
			assert.Equal(t, tc.wantCount, missingDelegatedCount(c, "dashboard.grafana.app", "dashboards", utils.VerbGet))
		})
	}
}

// A token that cannot delegate is a deployment mistake, so every entry point
// fails instead of passing on a denial that reads as "the user has no access".
func TestAuthzLimitedClient_RefusesWhenServiceCannotDelegate(t *testing.T) {
	const group, res = "dashboard.grafana.app", "dashboards"
	id := tokenWithoutDelegation()

	t.Run("Check", func(t *testing.T) {
		c := newLimitedClient(t)
		resp, err := c.Check(context.Background(), id, authlib.CheckRequest{
			Namespace: "stacks-1", Group: group, Resource: res, Verb: utils.VerbGet, Name: "dash1",
		}, "folder1")
		require.ErrorIs(t, err, ErrServiceCannotDelegate)
		assert.False(t, resp.Allowed)
		assert.Equal(t, 1.0, missingDelegatedCount(c, group, res, utils.VerbGet))
	})

	t.Run("Compile", func(t *testing.T) {
		c := newLimitedClient(t)
		checker, _, err := c.Compile(context.Background(), id, authlib.ListRequest{
			Namespace: "stacks-1", Group: group, Resource: res, Verb: utils.VerbList,
		})
		require.ErrorIs(t, err, ErrServiceCannotDelegate)
		assert.Nil(t, checker)
		assert.Equal(t, 1.0, missingDelegatedCount(c, group, res, utils.VerbList))
	})

	t.Run("BatchCheck", func(t *testing.T) {
		c := newLimitedClient(t)
		_, err := c.BatchCheck(context.Background(), id, authlib.BatchCheckRequest{
			Namespace: "stacks-1",
			Checks: []authlib.BatchCheckItem{
				{CorrelationID: "1", Group: group, Resource: res, Verb: utils.VerbGet, Name: "dash1"},
				{CorrelationID: "2", Group: group, Resource: res, Verb: utils.VerbGet, Name: "dash2"},
			},
		})
		require.ErrorIs(t, err, ErrServiceCannotDelegate)
		// Once per group, resource and verb, however many hits share it.
		assert.Equal(t, 1.0, missingDelegatedCount(c, group, res, utils.VerbGet))
	})

	t.Run("resources that are not RBAC enforced are unaffected", func(t *testing.T) {
		c := newLimitedClient(t)
		resp, err := c.Check(context.Background(), id, authlib.CheckRequest{
			Namespace: "stacks-1", Group: "playlist.grafana.app", Resource: "playlists", Verb: utils.VerbGet, Name: "p1",
		}, "")
		require.NoError(t, err)
		assert.True(t, resp.Allowed)
		assert.Equal(t, 1.0, missingDelegatedCount(c, "playlist.grafana.app", "playlists", utils.VerbGet))
	})

	t.Run("a token that can delegate reaches the underlying client", func(t *testing.T) {
		c := newLimitedClient(t)
		resp, err := c.Check(context.Background(), userWithDelegatedPermissions("dashboard.grafana.app/dashboards:get"),
			authlib.CheckRequest{Namespace: "stacks-1", Group: group, Resource: res, Verb: utils.VerbGet, Name: "dash1"}, "folder1")
		require.NoError(t, err)
		assert.True(t, resp.Allowed)
	})
}

func serviceWithPermissions(permissions ...string) *identity.StaticRequester {
	return &identity.StaticRequester{
		Type:        authlib.TypeAccessPolicy,
		Namespace:   "stacks-1",
		AccessToken: "verified-access-token",
		AccessTokenClaims: &authnlib.Claims[authnlib.AccessTokenClaims]{
			Rest: authnlib.AccessTokenClaims{Permissions: permissions},
		},
	}
}

func TestAuthzLimitedClient_ServicePermissions(t *testing.T) {
	userWithoutGrants := userWithDelegatedPermissions()
	userWithoutGrants.AccessToken = "verified-access-token"
	for name, tc := range map[string]struct {
		id      authlib.AuthInfo
		wantErr error
	}{
		"direct service missing grant": {serviceWithPermissions("folder.grafana.app:get"), ErrServicePermissionMissing},
		"direct service empty grants":  {serviceWithPermissions(), ErrServicePermissionMissing},
		"direct service wrong verb":    {serviceWithPermissions("dashboard.grafana.app:update"), ErrServicePermissionMissing},
		"direct service valid grant":   {serviceWithPermissions("dashboard.grafana.app/dashboards:get"), nil},
		"delegated empty grants":       {userWithoutGrants, ErrServiceCannotDelegate},
		"delegated valid grant":        {userWithDelegatedPermissions("dashboard.grafana.app/dashboards:get"), nil},
		"tokenless caller":             {userWithDelegatedPermissions(), nil},
	} {
		t.Run(name, func(t *testing.T) {
			c := newLimitedClient(t)
			req := authlib.CheckRequest{Namespace: "stacks-1", Group: "dashboard.grafana.app", Resource: "dashboards", Verb: utils.VerbGet}
			t.Run("Check", func(t *testing.T) {
				resp, err := c.Check(t.Context(), tc.id, req, "folder-1")
				require.ErrorIs(t, err, tc.wantErr)
				require.Equal(t, tc.wantErr == nil, resp.Allowed)
			})
			t.Run("Compile", func(t *testing.T) {
				checker, _, err := c.Compile(t.Context(), tc.id, authlib.ListRequest{
					Namespace: req.Namespace, Group: req.Group, Resource: req.Resource, Verb: utils.VerbList,
				})
				require.ErrorIs(t, err, tc.wantErr)
				if tc.wantErr == nil {
					require.True(t, checker("dash-1", "folder-1"))
				} else {
					require.Nil(t, checker)
				}
			})
			t.Run("BatchCheck", func(t *testing.T) {
				resp, err := c.BatchCheck(t.Context(), tc.id, authlib.BatchCheckRequest{
					Namespace: req.Namespace,
					Checks:    []authlib.BatchCheckItem{{CorrelationID: "1", Group: req.Group, Resource: req.Resource, Verb: req.Verb}},
				})
				require.ErrorIs(t, err, tc.wantErr)
				if tc.wantErr == nil {
					require.True(t, resp.Results["1"].Allowed)
				} else {
					require.Empty(t, resp.Results)
				}
			})
		})
	}
}

func permissionFailureLabels(group, resource, verb, mode string, exempt bool) prometheus.Labels {
	return prometheus.Labels{
		"group": group, "resource": resource, "verb": verb, "mode": mode, "exempt": strconv.FormatBool(exempt),
	}
}

func requirePermissionFailures(t *testing.T, counter *prometheus.CounterVec, name string, want ...prometheus.Labels) {
	t.Helper()
	registry := prometheus.NewRegistry()
	registry.MustRegister(counter)
	families, err := registry.Gather()
	require.NoError(t, err)
	if len(want) == 0 {
		require.Empty(t, families)
		return
	}
	require.Len(t, families, 1)
	require.Equal(t, name, families[0].GetName())
	require.Contains(t, families[0].GetHelp(), "regardless of RBAC exemption")
	var got []prometheus.Labels
	for _, metric := range families[0].Metric {
		labels := prometheus.Labels{}
		for _, label := range metric.Label {
			labels[label.GetName()] = label.GetValue()
		}
		got = append(got, labels)
		require.Equal(t, 1.0, metric.GetCounter().GetValue())
	}
	require.ElementsMatch(t, want, got)
}

func TestAuthzLimitedClient_ServicePermissionFailures(t *testing.T) {
	const group, resource = "playlist.grafana.app", "playlists"
	for _, mode := range []string{"direct", "delegated"} {
		for _, exemption := range []struct {
			name   string
			opts   AuthzOptions
			exempt bool
		}{
			{"enforced", AuthzOptions{ExemptionEnabled: true}, false},
			{"exempt", AuthzOptions{ExemptionEnabled: true, ExemptResources: []string{group + "/" + resource}}, true},
			{"legacy bypass", AuthzOptions{}, true},
		} {
			for _, scenario := range []string{"missing permission", "valid permission", "tokenless", "namespace mismatch"} {
				for _, method := range []string{"Check", "Compile", "BatchCheck"} {
					t.Run(mode+"/"+exemption.name+"/"+scenario+"/"+method, func(t *testing.T) {
						verb := utils.VerbGet
						if method == "Compile" {
							verb = utils.VerbList
						}
						var permissions []string
						if scenario == "valid permission" {
							permissions = []string{group + "/" + resource + ":" + verb}
						}
						id := serviceWithPermissions(permissions...)
						missingErr := ErrServicePermissionMissing
						if mode == "delegated" {
							id = userWithDelegatedPermissions(permissions...)
							id.AccessToken = "verified-access-token"
							missingErr = ErrServiceCannotDelegate
						}
						if scenario == "tokenless" {
							id.AccessToken = ""
						}
						namespace := "stacks-1"
						var wantErr error
						if scenario == "namespace mismatch" {
							namespace = "stacks-2"
							wantErr = authlib.ErrNamespaceMismatch
						} else if scenario == "missing permission" && !exemption.exempt {
							wantErr = missingErr
						}

						calls := 0
						var inner authlib.AccessClient
						if !exemption.exempt {
							inner = &callbackAccessClient{fn: func(authlib.CheckRequest, string) (authlib.CheckResponse, error) {
								calls++
								return deny()
							}}
						}
						c := NewAuthzLimitedClient(inner, exemption.opts).(*authzLimitedClient)
						logger := &permissionTestLogger{}
						c.logger = logger
						var allowed bool
						var err error
						switch method {
						case "Check":
							var resp authlib.CheckResponse
							resp, err = c.Check(t.Context(), id, authlib.CheckRequest{
								Namespace: namespace, Group: group, Resource: resource, Verb: verb,
							}, "folder")
							allowed = resp.Allowed
						case "Compile":
							var checker authlib.ItemChecker
							checker, _, err = c.Compile(t.Context(), id, authlib.ListRequest{
								Namespace: namespace, Group: group, Resource: resource, Verb: verb,
							})
							if wantErr != nil {
								require.Nil(t, checker)
							} else {
								require.NotNil(t, checker)
								allowed = checker("item", "folder")
							}
						case "BatchCheck":
							var resp authlib.BatchCheckResponse
							resp, err = c.BatchCheck(t.Context(), id, authlib.BatchCheckRequest{
								Namespace: namespace,
								Checks: []authlib.BatchCheckItem{
									{CorrelationID: "1", Group: group, Resource: resource, Verb: verb},
									{CorrelationID: "2", Group: group, Resource: resource, Verb: verb},
								},
							})
							if wantErr != nil {
								require.Empty(t, resp.Results)
							} else {
								require.Len(t, resp.Results, 2)
								require.Equal(t, exemption.exempt, resp.Results["2"].Allowed)
								allowed = resp.Results["1"].Allowed
							}
						}
						require.ErrorIs(t, err, wantErr)
						require.Equal(t, wantErr == nil && exemption.exempt, allowed)
						wantCalls := 0
						if wantErr == nil && !exemption.exempt {
							wantCalls = 1
							if method == "BatchCheck" {
								wantCalls = 2
							}
						}
						require.Equal(t, wantCalls, calls)
						var failures []prometheus.Labels
						if scenario == "missing permission" {
							failures = append(failures, permissionFailureLabels(group, resource, verb, mode, exemption.exempt))
						}
						requirePermissionFailures(t, c.metrics.servicePermissionFailures, "grafana_grpc_authz_limited_client_service_permission_failures_total", failures...)
						wantWarnings := 0
						if errors.Is(wantErr, missingErr) {
							wantWarnings = 1
							require.Contains(t, logger.WarnLogs.Ctx, group+"/"+resource+":"+verb)
						}
						require.Equal(t, wantWarnings, logger.WarnLogs.Calls)
						require.Zero(t, logger.ErrorLogs.Calls)
						wantErrors := 0.0
						if errors.Is(wantErr, ErrServicePermissionMissing) {
							wantErrors = 1
						}
						require.Equal(t, wantErrors, testutil.ToFloat64(c.metrics.errorsTotal.WithLabelValues(group, resource, verb)))
					})
				}
			}
		}
	}
}

func TestAuthzLimitedClient_BatchPermissionFailureCounts(t *testing.T) {
	for mode, id := range map[string]authlib.AuthInfo{
		"direct": serviceWithPermissions(), "delegated": tokenWithoutDelegation(),
	} {
		for _, reject := range []bool{false, true} {
			t.Run(fmt.Sprintf("%s/reject=%t", mode, reject), func(t *testing.T) {
				const group, resource = "playlist.grafana.app", "playlists"
				c := NewAuthzLimitedClient(nil, AuthzOptions{
					ExemptionEnabled: true,
					ExemptResources:  []string{group + "/" + resource, group + "/other", "other.grafana.app/" + resource},
				}).(*authzLimitedClient)
				logger := &permissionTestLogger{}
				c.logger = logger
				checks := []authlib.BatchCheckItem{
					{Group: group, Resource: resource, Verb: utils.VerbGet},
					{Group: group, Resource: resource, Verb: utils.VerbGet},
					{Group: group, Resource: resource, Verb: utils.VerbUpdate},
					{Group: group, Resource: "other", Verb: utils.VerbGet},
					{Group: "other.grafana.app", Resource: resource, Verb: utils.VerbGet},
				}
				failures := []prometheus.Labels{
					permissionFailureLabels(group, resource, utils.VerbGet, mode, true),
					permissionFailureLabels(group, resource, utils.VerbUpdate, mode, true),
					permissionFailureLabels(group, "other", utils.VerbGet, mode, true),
					permissionFailureLabels("other.grafana.app", resource, utils.VerbGet, mode, true),
				}
				if reject {
					checks = append(checks,
						authlib.BatchCheckItem{Group: "dashboard.grafana.app", Resource: "dashboards", Verb: utils.VerbGet},
						authlib.BatchCheckItem{Group: group, Resource: resource, Verb: utils.VerbDelete},
						authlib.BatchCheckItem{Group: "folder.grafana.app", Resource: "folders", Verb: utils.VerbGet},
					)
					failures = append(failures, permissionFailureLabels("dashboard.grafana.app", "dashboards", utils.VerbGet, mode, false))
				}
				for i := range checks {
					checks[i].CorrelationID = strconv.Itoa(i)
				}
				resp, err := c.BatchCheck(t.Context(), id, authlib.BatchCheckRequest{Namespace: "stacks-1", Checks: checks})
				wantWarnings := 0
				if reject {
					wantErr := ErrServicePermissionMissing
					if mode == "delegated" {
						wantErr = ErrServiceCannotDelegate
					}
					require.ErrorIs(t, err, wantErr)
					require.Empty(t, resp.Results)
					wantWarnings = 1
				} else {
					require.NoError(t, err)
					require.Len(t, resp.Results, len(checks))
					for _, check := range checks {
						require.True(t, resp.Results[check.CorrelationID].Allowed)
					}
				}
				requirePermissionFailures(t, c.metrics.servicePermissionFailures, "grafana_grpc_authz_limited_client_service_permission_failures_total", failures...)
				require.Equal(t, wantWarnings, logger.WarnLogs.Calls)
				require.Zero(t, logger.ErrorLogs.Calls)
			})
		}
	}
}

func TestAuthzLimitedClient_BatchExemptionsBypassUnderlyingClient(t *testing.T) {
	const group, resource = "playlist.grafana.app", "playlists"
	for mode, id := range map[string]authlib.AuthInfo{
		"direct":    serviceWithPermissions("dashboard.grafana.app:get"),
		"delegated": userWithDelegatedPermissions("dashboard.grafana.app:get"),
	} {
		t.Run(mode, func(t *testing.T) {
			var checked []string
			inner := &callbackAccessClient{fn: func(req authlib.CheckRequest, _ string) (authlib.CheckResponse, error) {
				require.Equal(t, "dashboard.grafana.app", req.Group)
				require.Equal(t, "dashboards", req.Resource)
				checked = append(checked, req.Name)
				return deny()
			}}
			c := NewAuthzLimitedClient(inner, AuthzOptions{
				ExemptionEnabled: true, ExemptResources: []string{group + "/" + resource},
			}).(*authzLimitedClient)
			logger := &permissionTestLogger{}
			c.logger = logger
			resp, err := c.BatchCheck(t.Context(), id, authlib.BatchCheckRequest{
				Namespace: "stacks-1",
				Checks: []authlib.BatchCheckItem{
					{CorrelationID: "p1", Group: group, Resource: resource, Verb: utils.VerbGet},
					{CorrelationID: "d1", Group: "dashboard.grafana.app", Resource: "dashboards", Verb: utils.VerbGet, Name: "one"},
					{CorrelationID: "p2", Group: group, Resource: resource, Verb: utils.VerbGet},
					{CorrelationID: "d2", Group: "dashboard.grafana.app", Resource: "dashboards", Verb: utils.VerbGet, Name: "two"},
				},
			})
			require.NoError(t, err)
			require.Equal(t, []string{"one", "two"}, checked)
			require.Len(t, resp.Results, 4)
			require.True(t, resp.Results["p1"].Allowed)
			require.True(t, resp.Results["p2"].Allowed)
			require.False(t, resp.Results["d1"].Allowed)
			require.False(t, resp.Results["d2"].Allowed)
			requirePermissionFailures(t, c.metrics.servicePermissionFailures, "grafana_grpc_authz_limited_client_service_permission_failures_total",
				permissionFailureLabels(group, resource, utils.VerbGet, mode, true))
			require.Zero(t, logger.WarnLogs.Calls)
			require.Zero(t, logger.ErrorLogs.Calls)
			require.Zero(t, testutil.ToFloat64(c.metrics.errorsTotal.WithLabelValues(group, resource, utils.VerbGet)))
		})
	}
}

func TestAuthzLimitedClient_BatchCheckReturnsItemErrors(t *testing.T) {
	recorder := recordPermissionSpans(t)
	logger := &permissionTestLogger{}
	boom := errors.New("authorization failed")
	inner := &callbackAccessClient{fn: func(authlib.CheckRequest, string) (authlib.CheckResponse, error) {
		return authlib.CheckResponse{}, boom
	}}
	c := newLimitedClient(t)
	c.client = inner
	c.logger = logger
	resp, err := c.BatchCheck(t.Context(), userWithDelegatedPermissions("dashboard.grafana.app:get"), authlib.BatchCheckRequest{
		Namespace: "stacks-1",
		Checks:    []authlib.BatchCheckItem{{CorrelationID: "1", Group: "dashboard.grafana.app", Resource: "dashboards", Verb: utils.VerbGet}},
	})
	require.ErrorIs(t, err, boom)
	require.Empty(t, resp.Results)
	require.Equal(t, 1.0, testutil.ToFloat64(c.metrics.errorsTotal.WithLabelValues("", "", "batch_check")))
	require.Equal(t, 1, logger.ErrorLogs.Calls)
	require.Len(t, recorder.Ended(), 1)
	require.Equal(t, otelcodes.Error, recorder.Ended()[0].Status().Code)
}

func TestSearchServicePermissions(t *testing.T) {
	for name, tc := range map[string]struct {
		permissions    []string
		mutate         func(*resourcepb.ResourceSearchRequest)
		wantPermission string
	}{
		"read":         {permissions: []string{"dashboard.grafana.app:get"}},
		"missing read": {wantPermission: "dashboard.grafana.app/dashboards:get"},
		"edit requires update": {
			permissions:    []string{"dashboard.grafana.app:get"},
			mutate:         func(req *resourcepb.ResourceSearchRequest) { req.Permission = int64(dashboardaccess.PERMISSION_EDIT) },
			wantPermission: "dashboard.grafana.app/dashboards:update",
		},
		"create on folders requires dashboards create": {
			permissions: []string{"folder.grafana.app:get"},
			mutate: func(req *resourcepb.ResourceSearchRequest) {
				req.Options.Key.Group, req.Options.Key.Resource = "folder.grafana.app", "folders"
				req.Permission = int64(dashboardaccess.PERMISSION_CREATE)
			},
			wantPermission: "dashboard.grafana.app/dashboards:create",
		},
		"create on folders valid grant": {
			permissions: []string{"dashboard.grafana.app:create"},
			mutate: func(req *resourcepb.ResourceSearchRequest) {
				req.Options.Key.Group, req.Options.Key.Resource = "folder.grafana.app", "folders"
				req.Permission = int64(dashboardaccess.PERMISSION_CREATE)
			},
		},
		"create on deleted folders keeps set_permissions": {
			permissions: []string{"dashboard.grafana.app:create"},
			mutate: func(req *resourcepb.ResourceSearchRequest) {
				req.Options.Key.Group, req.Options.Key.Resource = "folder.grafana.app", "folders"
				req.Permission = int64(dashboardaccess.PERMISSION_CREATE)
				req.IsDeleted = true
			},
			wantPermission: "folder.grafana.app/folders:set_permissions",
		},
		"create on dashboards stays read": {
			permissions: []string{"dashboard.grafana.app:get"},
			mutate:      func(req *resourcepb.ResourceSearchRequest) { req.Permission = int64(dashboardaccess.PERMISSION_CREATE) },
		},
		"trash requires folder admin check": {
			permissions:    []string{"dashboard.grafana.app:get"},
			mutate:         func(req *resourcepb.ResourceSearchRequest) { req.IsDeleted = true },
			wantPermission: "dashboard.grafana.app/dashboards:set_permissions",
		},
		"trash valid grants": {
			permissions: []string{"dashboard.grafana.app:set_permissions"},
			mutate:      func(req *resourcepb.ResourceSearchRequest) { req.IsDeleted = true },
		},
		"federated requires both resources": {
			permissions: []string{"dashboard.grafana.app:get"},
			mutate: func(req *resourcepb.ResourceSearchRequest) {
				req.Federated = []*resourcepb.ResourceKey{{Group: "folder.grafana.app", Resource: "folders"}}
			},
			wantPermission: "folder.grafana.app/folders:get",
		},
	} {
		for _, mode := range []string{"direct", "delegated"} {
			t.Run(mode+"/"+name, func(t *testing.T) {
				req := &resourcepb.ResourceSearchRequest{Options: &resourcepb.ListOptions{Key: &resourcepb.ResourceKey{
					Namespace: "stacks-1", Group: "dashboard.grafana.app", Resource: "dashboards",
				}}}
				if tc.mutate != nil {
					tc.mutate(req)
				}
				logger := &permissionTestLogger{}
				s := newPermissionTestSearchServer(newLimitedClient(t))
				s.log = logger
				id := serviceWithPermissions(tc.permissions...)
				if mode == "delegated" {
					id = userWithDelegatedPermissions(tc.permissions...)
					id.AccessToken = "verified-access-token"
				}
				ctx := authlib.WithAuthInfo(t.Context(), id)
				if tc.wantPermission == "" {
					_, err := checkPermissions(s, ctx, req)
					require.NoError(t, err)
					requirePermissionFailures(t, s.indexMetrics.SearchServicePermissionFailures, "grafana_index_server_search_service_permission_failures_total")
					require.Zero(t, logger.WarnLogs.Calls)
					require.Zero(t, logger.ErrorLogs.Calls)
					return
				}
				// No index is configured: the failure must precede any index lookup.
				resp, err := s.Search(ctx, req)
				require.NoError(t, err)
				require.Equal(t, int32(http.StatusInternalServerError), resp.Error.GetCode())
				require.Contains(t, resp.Error.GetMessage(), tc.wantPermission)
				group, rest, _ := strings.Cut(tc.wantPermission, "/")
				resource, verb, _ := strings.Cut(rest, ":")
				requirePermissionFailures(t, s.indexMetrics.SearchServicePermissionFailures, "grafana_index_server_search_service_permission_failures_total",
					permissionFailureLabels(group, resource, verb, mode, false))
				require.Equal(t, 1, logger.WarnLogs.Calls)
				require.Zero(t, logger.ErrorLogs.Calls)
			})
		}
	}
}

func TestSearchServicePermissionExemptions(t *testing.T) {
	const group, resource = "playlist.grafana.app", "playlists"
	for mode, id := range map[string]authlib.AuthInfo{
		"direct":    serviceWithPermissions(),
		"delegated": tokenWithoutDelegation(),
	} {
		for _, tc := range []struct {
			name            string
			opts            AuthzOptions
			requestGroup    string
			requestResource string
			federated       bool
			validPermission bool
			tokenless       bool
			namespace       string
			wantErr         error
			wantExempt      float64
		}{
			{name: "exempt", opts: AuthzOptions{ExemptionEnabled: true, ExemptResources: []string{group + "/" + resource}}, wantExempt: 1},
			{name: "legacy bypass", wantExempt: 1},
			{name: "not exempt", opts: AuthzOptions{ExemptionEnabled: true}, wantErr: ErrServicePermissionMissing},
			{name: "sibling resource", opts: AuthzOptions{ExemptionEnabled: true, ExemptResources: []string{group + "/other"}}, wantErr: ErrServicePermissionMissing},
			{name: "always enforced", requestGroup: "dashboard.grafana.app", requestResource: "dashboards", opts: AuthzOptions{ExemptionEnabled: true, ExemptResources: []string{group + "/" + resource}}, wantErr: ErrServicePermissionMissing},
			{name: "federated enforced resource", opts: AuthzOptions{ExemptionEnabled: true, ExemptResources: []string{group + "/" + resource}}, federated: true, wantExempt: 1, wantErr: ErrServicePermissionMissing},
			{name: "namespace mismatch", opts: AuthzOptions{ExemptionEnabled: true, ExemptResources: []string{group + "/" + resource}}, namespace: "stacks-2", wantErr: authlib.ErrNamespaceMismatch},
			{name: "enforced namespace mismatch", opts: AuthzOptions{ExemptionEnabled: true}, namespace: "stacks-2", wantErr: authlib.ErrNamespaceMismatch},
			{name: "exempt valid permission", opts: AuthzOptions{ExemptionEnabled: true, ExemptResources: []string{group + "/" + resource}}, validPermission: true},
			{name: "enforced valid permission", opts: AuthzOptions{ExemptionEnabled: true}, validPermission: true},
			{name: "exempt tokenless", opts: AuthzOptions{ExemptionEnabled: true, ExemptResources: []string{group + "/" + resource}}, tokenless: true},
			{name: "enforced tokenless", opts: AuthzOptions{ExemptionEnabled: true}, tokenless: true},
		} {
			t.Run(mode+"/"+tc.name, func(t *testing.T) {
				requestGroup, requestResource := tc.requestGroup, tc.requestResource
				if requestGroup == "" {
					requestGroup, requestResource = group, resource
				}
				namespace := tc.namespace
				if namespace == "" {
					namespace = "stacks-1"
				}
				logger := &permissionTestLogger{}
				s := newPermissionTestSearchServer(NewAuthzLimitedClient(nil, tc.opts))
				s.log = logger
				req := &resourcepb.ResourceSearchRequest{Options: &resourcepb.ListOptions{Key: &resourcepb.ResourceKey{
					Namespace: namespace, Group: requestGroup, Resource: requestResource,
				}}}
				if tc.federated {
					req.Federated = []*resourcepb.ResourceKey{{Group: "folder.grafana.app", Resource: "folders"}}
				}
				wantErr := tc.wantErr
				if mode == "delegated" && errors.Is(wantErr, ErrServicePermissionMissing) {
					wantErr = ErrServiceCannotDelegate
				}
				testID := id
				if tc.validPermission {
					permission := group + "/" + resource + ":" + utils.VerbGet
					if mode == "direct" {
						testID = serviceWithPermissions(permission)
					} else {
						testID = userWithDelegatedPermissions(permission)
					}
				}
				if tc.tokenless {
					if mode == "direct" {
						testID = &identity.StaticRequester{Type: authlib.TypeAccessPolicy, Namespace: "stacks-1"}
					} else {
						testID = userWithDelegatedPermissions()
					}
				}
				_, err := checkPermissions(s, authlib.WithAuthInfo(t.Context(), testID), req)
				require.ErrorIs(t, err, wantErr)
				var failures []prometheus.Labels
				if tc.wantExempt > 0 {
					failures = append(failures, permissionFailureLabels(group, resource, utils.VerbGet, mode, true))
				}
				wantWarnings := 0
				if wantErr != nil && !errors.Is(wantErr, authlib.ErrNamespaceMismatch) {
					wantWarnings = 1
					if tc.federated {
						requestGroup, requestResource = "folder.grafana.app", "folders"
					}
					failures = append(failures, permissionFailureLabels(requestGroup, requestResource, utils.VerbGet, mode, false))
				}
				requirePermissionFailures(t, s.indexMetrics.SearchServicePermissionFailures, "grafana_index_server_search_service_permission_failures_total", failures...)
				require.Equal(t, wantWarnings, logger.WarnLogs.Calls)
				require.Zero(t, logger.ErrorLogs.Calls)
			})
		}
	}
}

func TestAuthzLimitedClient_UserDenialRemainsDenial(t *testing.T) {
	c := NewAuthzLimitedClient(authlib.FixedAccessClient(false), AuthzOptions{})
	id := userWithDelegatedPermissions("dashboard.grafana.app:get")
	resp, err := c.BatchCheck(t.Context(), id, authlib.BatchCheckRequest{
		Namespace: "stacks-1",
		Checks:    []authlib.BatchCheckItem{{CorrelationID: "1", Group: "dashboard.grafana.app", Resource: "dashboards", Verb: utils.VerbGet}},
	})
	require.NoError(t, err)
	require.Contains(t, resp.Results, "1")
	require.False(t, resp.Results["1"].Allowed)
}

func TestSearchServicePermissionsIdentityErrors(t *testing.T) {
	for name, tc := range map[string]struct {
		id       authlib.AuthInfo
		wantCode int32
	}{
		"missing identity": {wantCode: http.StatusUnauthorized},
		"wrong namespace":  {id: &identity.StaticRequester{Namespace: "stacks-2"}, wantCode: http.StatusForbidden},
	} {
		t.Run(name, func(t *testing.T) {
			ctx := t.Context()
			if tc.id != nil {
				ctx = authlib.WithAuthInfo(ctx, tc.id)
			}
			s := newPermissionTestSearchServer(newLimitedClient(t))
			resp, err := s.Search(ctx, &resourcepb.ResourceSearchRequest{Options: &resourcepb.ListOptions{Key: &resourcepb.ResourceKey{
				Namespace: "stacks-1", Group: "dashboard.grafana.app", Resource: "dashboards",
			}}})
			require.NoError(t, err)
			require.Equal(t, tc.wantCode, resp.Error.GetCode())
		})
	}
}

type incompleteAccessClient struct{ authlib.AccessClient }

func (incompleteAccessClient) BatchCheck(context.Context, authlib.AuthInfo, authlib.BatchCheckRequest) (authlib.BatchCheckResponse, error) {
	return authlib.BatchCheckResponse{Results: map[string]authlib.BatchCheckResult{}}, nil
}

func TestAuthzLimitedClient_BatchCheckReturnsMissingResultError(t *testing.T) {
	recorder := recordPermissionSpans(t)
	logger := &permissionTestLogger{}
	c := newLimitedClient(t)
	c.client = incompleteAccessClient{}
	c.logger = logger
	resp, err := c.BatchCheck(t.Context(), userWithDelegatedPermissions("dashboard.grafana.app:get"), authlib.BatchCheckRequest{
		Namespace: "stacks-1",
		Checks:    []authlib.BatchCheckItem{{CorrelationID: "1", Group: "dashboard.grafana.app", Resource: "dashboards", Verb: utils.VerbGet}},
	})
	require.ErrorContains(t, err, "missing authorization result")
	require.Empty(t, resp.Results)
	require.Equal(t, 1.0, testutil.ToFloat64(c.metrics.errorsTotal.WithLabelValues("", "", "batch_check")))
	require.Equal(t, 1, logger.ErrorLogs.Calls)
	require.Len(t, recorder.Ended(), 1)
	require.Equal(t, otelcodes.Error, recorder.Ended()[0].Status().Code)
}

// checkPermissions checks req as Search does, returning the types a global
// search leaves out.
func checkPermissions(s *searchServer, ctx context.Context, req *resourcepb.ResourceSearchRequest) ([]string, error) {
	key := NamespacedResource{Namespace: req.Options.Key.Namespace, Group: req.Options.Key.Group, Resource: req.Options.Key.Resource}
	_, skipped, err := s.checkSearchServicePermissions(ctx, req, s.indexSources(key))
	return skipped, err
}

func newPermissionTestSearchServer(client authlib.AccessClient) *searchServer {
	return &searchServer{access: client, indexMetrics: ProvideIndexMetrics(nil), log: log.NewNopLogger()}
}

// uncheckedTypeClient stands in for a deployment that exempts one type from
// checking each result against the user.
type uncheckedTypeClient struct {
	*authzLimitedClient
	unchecked string
}

func (c uncheckedTypeClient) IsCompatibleWithRBAC(group, resource string) bool {
	return group+"/"+resource != c.unchecked
}

type allUncheckedClient struct{ *authzLimitedClient }

func (allUncheckedClient) IsCompatibleWithRBAC(string, string) bool { return false }

// recordingIndex answers every search with no hits and keeps the last request.
type recordingIndex struct {
	*MockResourceIndex
	req     *resourcepb.ResourceSearchRequest
	indexes *SearchIndexes
	// duringSearch, if set, runs while the index is searched.
	duringSearch func()
}

func (r *recordingIndex) Search(_ context.Context, _ authlib.AccessClient, req *resourcepb.ResourceSearchRequest, indexes *SearchIndexes, _ *SearchStats) (*resourcepb.ResourceSearchResponse, error) {
	r.req = req
	r.indexes = indexes
	if r.duringSearch != nil {
		r.duringSearch()
	}
	return &resourcepb.ResourceSearchResponse{}, nil
}

// One type the calling service cannot search must not break a global search of
// the others, and a type whose results are not checked against the user must not
// be searched at all.
func TestGlobalSearchLeavesOutTypesItCannotSearch(t *testing.T) {
	const dashboards, folders = "dashboard.grafana.app/dashboards", "folder.grafana.app/folders"
	globalRequest := func() *resourcepb.ResourceSearchRequest {
		return &resourcepb.ResourceSearchRequest{Options: &resourcepb.ListOptions{Key: &resourcepb.ResourceKey{
			Namespace: "stacks-1", Group: GlobalSearchGroup, Resource: GlobalSearchResource,
		}}}
	}

	for mode, withPermissions := range map[string]func(...string) *identity.StaticRequester{
		"direct": serviceWithPermissions,
		"delegated": func(permissions ...string) *identity.StaticRequester {
			id := userWithDelegatedPermissions(permissions...)
			id.AccessToken = "verified-access-token"
			return id
		},
	} {
		t.Run(mode+"/a type without a grant is skipped and reported", func(t *testing.T) {
			logger := &permissionTestLogger{}
			s := newPermissionTestSearchServer(newLimitedClient(t))
			s.log = logger
			ctx := authlib.WithAuthInfo(t.Context(), withPermissions("dashboard.grafana.app:get"))

			excluded, err := checkPermissions(s, ctx, globalRequest())
			require.NoError(t, err)
			assert.Equal(t, []string{folders}, excluded)
			requirePermissionFailures(t, s.indexMetrics.SearchServicePermissionFailures, "grafana_index_server_search_service_permission_failures_total",
				permissionFailureLabels("folder.grafana.app", "folders", utils.VerbGet, mode, false))
			assert.Equal(t, 1, logger.WarnLogs.Calls)
		})

		t.Run(mode+"/the search fails when no type is left", func(t *testing.T) {
			s := newPermissionTestSearchServer(newLimitedClient(t))
			ctx := authlib.WithAuthInfo(t.Context(), withPermissions("playlist.grafana.app:get"))

			excluded, err := checkPermissions(s, ctx, globalRequest())
			require.Error(t, err)
			assert.Equal(t, []string{dashboards, folders}, excluded)
		})
	}

	t.Run("a type whose results are not checked is left out, and logged once", func(t *testing.T) {
		logger := &permissionTestLogger{}
		s := newPermissionTestSearchServer(uncheckedTypeClient{authzLimitedClient: newLimitedClient(t), unchecked: folders})
		s.log = logger
		ctx := authlib.WithAuthInfo(t.Context(), serviceWithPermissions("dashboard.grafana.app:get", "folder.grafana.app:get"))

		for range 2 {
			excluded, err := checkPermissions(s, ctx, globalRequest())
			require.NoError(t, err)
			assert.Equal(t, []string{folders}, excluded)
		}
		assert.Equal(t, 1, logger.WarnLogs.Calls)
	})

	t.Run("the search fails when every type is unchecked", func(t *testing.T) {
		s := newPermissionTestSearchServer(uncheckedTypeClient{authzLimitedClient: newLimitedClient(t), unchecked: folders})
		ctx := authlib.WithAuthInfo(t.Context(), serviceWithPermissions("folder.grafana.app:get"))

		// Dashboards are skipped for the missing grant, folders for being unchecked.
		_, err := checkPermissions(s, ctx, globalRequest())
		require.Error(t, err)

		s = newPermissionTestSearchServer(allUncheckedClient{newLimitedClient(t)})
		_, err = checkPermissions(s, ctx, globalRequest())
		require.ErrorContains(t, err, "no type whose results this server checks")
	})

	t.Run("a type dropped from the coverage is not searched while the index still holds it", func(t *testing.T) {
		yes := true
		pages := testGlobalManifest("x.ext.grafana.app", testGlobalKind("Page", "Pages", &yes))
		index := &recordingIndex{MockResourceIndex: &MockResourceIndex{}}
		// The index holds pages, and type sync has not removed them yet.
		require.NoError(t, index.RecordCompletedTypeBuild(schema.GroupResource{Group: "x.ext.grafana.app", Resource: "pages"}, TypeBuild{}))
		s := newPermissionTestSearchServer(newLimitedClient(t))
		s.globalIndexEnabled = true
		s.search = &mockSearchBackend{cache: map[NamespacedResource]ResourceIndex{GlobalSearchKey("stacks-1"): index}}
		s.globalCoverage = NewGlobalSearchCoverageRegistry(testBuiltinManifests())
		s.globalCoverage.Reload(testBuiltinManifests(), []*app.ManifestData{pages})
		s.globalCoverage.Reload(testBuiltinManifests(), nil)
		ctx := authlib.WithAuthInfo(t.Context(), serviceWithPermissions("dashboard.grafana.app:get", "folder.grafana.app:get", "x.ext.grafana.app:get"))

		rsp, err := s.Search(ctx, globalRequest())
		require.NoError(t, err)
		require.Nil(t, rsp.Error)
		assert.Empty(t, rsp.SkippedTypes)
		require.NotNil(t, index.req)
		assert.Equal(t, []*resourcepb.Requirement{{
			Key: SEARCH_FIELD_GROUP_RESOURCE, Operator: string(selection.In), Values: []string{dashboards, folders},
		}}, index.req.Options.Fields)
	})

	t.Run("the kinds of the covered types are reported, including live ones", func(t *testing.T) {
		yes := true
		index := &recordingIndex{MockResourceIndex: &MockResourceIndex{}}
		s := newPermissionTestSearchServer(newLimitedClient(t))
		s.globalIndexEnabled = true
		s.search = &mockSearchBackend{cache: map[NamespacedResource]ResourceIndex{GlobalSearchKey("stacks-1"): index}}
		s.globalCoverage = NewGlobalSearchCoverageRegistry(testBuiltinManifests())
		s.globalCoverage.Reload(testBuiltinManifests(), []*app.ManifestData{testGlobalManifest("x.ext.grafana.app", testGlobalKind("Page", "Pages", &yes))})
		ctx := authlib.WithAuthInfo(t.Context(), serviceWithPermissions("dashboard.grafana.app:get", "folder.grafana.app:get", "x.ext.grafana.app:get"))

		rsp, err := s.Search(ctx, globalRequest())
		require.NoError(t, err)
		require.Nil(t, rsp.Error)
		assert.Equal(t, map[string]string{
			dashboards:                "Dashboard",
			folders:                   "Folder",
			"x.ext.grafana.app/pages": "Page",
		}, rsp.Kinds)
	})

	t.Run("the kinds reported are those of the types searched, even if the coverage changes meanwhile", func(t *testing.T) {
		yes := true
		index := &recordingIndex{MockResourceIndex: &MockResourceIndex{}}
		s := newPermissionTestSearchServer(newLimitedClient(t))
		s.globalIndexEnabled = true
		s.search = &mockSearchBackend{cache: map[NamespacedResource]ResourceIndex{GlobalSearchKey("stacks-1"): index}}
		s.globalCoverage = NewGlobalSearchCoverageRegistry(testBuiltinManifests())
		s.globalCoverage.Reload(testBuiltinManifests(), []*app.ManifestData{testGlobalManifest("x.ext.grafana.app", testGlobalKind("Page", "Pages", &yes))})
		index.duringSearch = func() { s.globalCoverage.Reload(testBuiltinManifests(), nil) }
		ctx := authlib.WithAuthInfo(t.Context(), serviceWithPermissions("dashboard.grafana.app:get", "folder.grafana.app:get", "x.ext.grafana.app:get"))

		rsp, err := s.Search(ctx, globalRequest())
		require.NoError(t, err)
		require.Nil(t, rsp.Error)
		assert.Equal(t, "Page", rsp.Kinds["x.ext.grafana.app/pages"])
	})

	t.Run("kinds are reported for a global search that also federates another index", func(t *testing.T) {
		index := &recordingIndex{MockResourceIndex: &MockResourceIndex{}}
		s := newPermissionTestSearchServer(newLimitedClient(t))
		s.globalIndexEnabled = true
		s.search = &mockSearchBackend{cache: map[NamespacedResource]ResourceIndex{
			GlobalSearchKey("stacks-1"): index,
			{Namespace: "stacks-1", Group: "dashboard.grafana.app", Resource: "dashboards"}: &MockResourceIndex{},
		}}
		ctx := authlib.WithAuthInfo(t.Context(), serviceWithPermissions("dashboard.grafana.app:get", "folder.grafana.app:get"))
		req := globalRequest()
		req.Federated = []*resourcepb.ResourceKey{{Namespace: "stacks-1", Group: "dashboard.grafana.app", Resource: "dashboards"}}

		rsp, err := s.Search(ctx, req)
		require.NoError(t, err)
		require.Nil(t, rsp.Error)
		assert.Equal(t, map[string]string{dashboards: "Dashboard", folders: "Folder"}, rsp.Kinds)
	})

	t.Run("a global search covering no types fails", func(t *testing.T) {
		// No access client and no caller identity: the permission check passes
		// everything, and a filter on no types would match everything.
		s := &searchServer{indexMetrics: ProvideIndexMetrics(nil), log: log.NewNopLogger(), globalIndexEnabled: true,
			globalCoverage: NewGlobalSearchCoverageRegistry(nil)}
		index := &recordingIndex{MockResourceIndex: &MockResourceIndex{}}
		s.search = &mockSearchBackend{cache: map[NamespacedResource]ResourceIndex{GlobalSearchKey("stacks-1"): index}}

		rsp, err := s.Search(t.Context(), globalRequest())
		require.NoError(t, err)
		require.NotNil(t, rsp.Error)
		assert.Contains(t, rsp.Error.Message, "covers no types")
		assert.Nil(t, index.req, "the index is not searched")
	})

	t.Run("the search names the types it searches and reports the skipped ones", func(t *testing.T) {
		index := &recordingIndex{MockResourceIndex: &MockResourceIndex{}}
		s := newPermissionTestSearchServer(newLimitedClient(t))
		s.globalIndexEnabled = true
		s.search = &mockSearchBackend{cache: map[NamespacedResource]ResourceIndex{GlobalSearchKey("stacks-1"): index}}
		ctx := authlib.WithAuthInfo(t.Context(), serviceWithPermissions("dashboard.grafana.app:get"))

		req := globalRequest()
		rsp, err := s.Search(ctx, req)
		require.NoError(t, err)
		require.Nil(t, rsp.Error)
		assert.Equal(t, []string{folders}, rsp.SkippedTypes)
		require.NotNil(t, index.req)
		assert.Equal(t, []*resourcepb.Requirement{{
			Key: SEARCH_FIELD_GROUP_RESOURCE, Operator: string(selection.In), Values: []string{dashboards},
		}}, index.req.Options.Fields)
		assert.Empty(t, req.Options.Fields, "the caller's request is left as it was")
	})
}

type permissionTestLogger struct{ logtest.Fake }

func (l *permissionTestLogger) FromContext(context.Context) log.Logger { return l }

func recordPermissionSpans(t *testing.T) *tracetest.SpanRecorder {
	t.Helper()
	recorder := tracetest.NewSpanRecorder()
	provider := sdktrace.NewTracerProvider(sdktrace.WithSpanProcessor(recorder))
	original := tracer
	tracer = provider.Tracer("permissions-test")
	t.Cleanup(func() { tracer = original })
	return recorder
}

func TestSearchPermissionFailureMonitoring(t *testing.T) {
	for mode, id := range map[string]authlib.AuthInfo{
		"direct":    serviceWithPermissions("folder.grafana.app:get"),
		"delegated": tokenWithoutDelegation(),
	} {
		t.Run(mode, func(t *testing.T) {
			recorder := recordPermissionSpans(t)
			logger := &permissionTestLogger{}
			s := newPermissionTestSearchServer(authlib.FixedAccessClient(true))
			s.log = logger
			resp, err := s.Search(authlib.WithAuthInfo(t.Context(), id), &resourcepb.ResourceSearchRequest{Options: &resourcepb.ListOptions{Key: &resourcepb.ResourceKey{
				Namespace: "stacks-1", Group: "dashboard.grafana.app", Resource: "dashboards",
			}}})
			require.NoError(t, err)
			require.Equal(t, int32(http.StatusInternalServerError), resp.Error.GetCode())
			require.Equal(t, 1.0, testutil.ToFloat64(s.indexMetrics.SearchServicePermissionFailures.WithLabelValues("dashboard.grafana.app", "dashboards", utils.VerbGet, mode, "false")))
			require.Zero(t, logger.ErrorLogs.Calls)
			require.Equal(t, 1, logger.WarnLogs.Calls)
			require.Contains(t, logger.WarnLogs.Ctx, "dashboard.grafana.app/dashboards:get")
			require.Equal(t, 1, logger.DebugLogs.Calls, "rejected searches still report their stats")
			require.Len(t, recorder.Ended(), 1)
			require.Equal(t, otelcodes.Error, recorder.Ended()[0].Status().Code)
		})
	}
}

func TestSearchServicePermissionsDoesNotDependOnClient(t *testing.T) {
	for name, client := range map[string]authlib.AccessClient{
		"limited client":   newLimitedClient(t),
		"fixed client":     authlib.FixedAccessClient(true),
		"decorated client": struct{ authlib.AccessClient }{newLimitedClient(t)},
		"no client":        nil,
	} {
		t.Run(name, func(t *testing.T) {
			s := newPermissionTestSearchServer(client)
			req := &resourcepb.ResourceSearchRequest{Options: &resourcepb.ListOptions{Key: &resourcepb.ResourceKey{
				Namespace: "stacks-1", Group: "dashboard.grafana.app", Resource: "dashboards",
			}}}
			for mode, id := range map[string]authlib.AuthInfo{
				"direct":    serviceWithPermissions("folder.grafana.app:get"),
				"delegated": tokenWithoutDelegation(),
			} {
				t.Run(mode, func(t *testing.T) {
					resp, err := s.Search(authlib.WithAuthInfo(t.Context(), id), req)
					require.NoError(t, err)
					require.Equal(t, int32(http.StatusInternalServerError), resp.Error.GetCode())
					require.Contains(t, resp.Error.GetMessage(), "dashboard.grafana.app/dashboards:get")
				})
			}
			// Local callers without tokens still use their access client's rules.
			_, err := checkPermissions(s, authlib.WithAuthInfo(t.Context(), userWithDelegatedPermissions()), req)
			require.NoError(t, err)
		})
	}
}
