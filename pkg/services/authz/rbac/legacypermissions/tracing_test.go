package legacypermissions

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/stretchr/testify/require"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/codes"
	sdktrace "go.opentelemetry.io/otel/sdk/trace"
	"go.opentelemetry.io/otel/sdk/trace/tracetest"
	"go.opentelemetry.io/otel/trace"

	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/infra/localcache"
	ac "github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/accesscontrol/resourcepermissions"
	"github.com/grafana/grafana/pkg/services/accesscontrol/shadow"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/licensing"
	"github.com/grafana/grafana/pkg/services/org"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/storage/legacysql"
	"github.com/grafana/grafana/pkg/util/testutil"
)

func recordPermissionSpans(t *testing.T) *tracetest.SpanRecorder {
	t.Helper()
	recorder := tracetest.NewSpanRecorder()
	provider := sdktrace.NewTracerProvider(sdktrace.WithSpanProcessor(recorder))
	previous := tracer
	tracer = provider.Tracer("permission-test")
	t.Cleanup(func() {
		tracer = previous
		require.NoError(t, provider.Shutdown(context.Background()))
	})
	return recorder
}

func permissionSpan(t *testing.T, recorder *tracetest.SpanRecorder, name string) sdktrace.ReadOnlySpan {
	t.Helper()
	var matches []sdktrace.ReadOnlySpan
	for _, span := range recorder.Ended() {
		if span.Name() == "authz.legacypermissions."+name {
			matches = append(matches, span)
		}
	}
	require.Len(t, matches, 1, name)
	return matches[0]
}

func spanAttributes(span sdktrace.ReadOnlySpan) map[attribute.Key]attribute.Value {
	values := make(map[attribute.Key]attribute.Value)
	for _, attr := range span.Attributes() {
		values[attr.Key] = attr.Value
	}
	return values
}

func TestPermissionCacheTracing(t *testing.T) {
	for _, tc := range []struct {
		name                         string
		cached, reload, shadow, fail bool
	}{
		{name: "hit", cached: true},
		{name: "miss"},
		{name: "reload", cached: true, reload: true},
		{name: "shadow miss", shadow: true},
		{name: "shadow reload", cached: true, reload: true, shadow: true},
		{name: "failure", fail: true},
	} {
		t.Run(tc.name, func(t *testing.T) {
			recorder := recordPermissionSpans(t)
			loader := &Loader{cache: localcache.New(0, 0)}
			const key = "private-cache-key"
			old := []ac.Permission{{Action: "private-old-action"}}
			fresh := []ac.Permission{{Action: "private-new-action"}}
			if tc.cached {
				loader.cache.Set(key, old, cacheTTL)
			}
			ctx := t.Context()
			if tc.shadow {
				ctx = shadow.WithContext(ctx)
			}
			var loadParent trace.SpanContext
			failure := errors.New("private-database-error")
			result, err := loader.cached(ctx, "direct", key, ac.Options{ReloadCache: tc.reload}, func(ctx context.Context) ([]ac.Permission, error) {
				loadParent = trace.SpanContextFromContext(ctx)
				if tc.fail {
					return nil, failure
				}
				return fresh, nil
			})
			span := permissionSpan(t, recorder, "cache")
			attrs := spanAttributes(span)
			require.Equal(t, attribute.StringValue("direct"), attrs["cache.source"])
			loaded := !tc.cached || tc.reload
			require.Equal(t, attribute.BoolValue(loaded), attrs["cache.load_executed"])
			require.Equal(t, attribute.BoolValue(tc.shadow), attrs["permission.shadow"])
			if loaded {
				require.Equal(t, span.SpanContext(), loadParent)
			}
			if tc.fail {
				require.ErrorIs(t, err, failure)
				require.Nil(t, result)
				require.Equal(t, codes.Error, span.Status().Code)
			} else {
				require.NoError(t, err)
				if loaded {
					require.Equal(t, fresh, result)
				} else {
					require.Equal(t, old, result)
				}
			}
			require.Len(t, recorder.Ended(), 1)
			if !tc.reload {
				require.Equal(t, attribute.BoolValue(tc.cached), attrs["cache.hit"])
			} else {
				require.NotContains(t, attrs, attribute.Key("cache.hit"))
			}
			if tc.fail {
				require.Len(t, span.Events(), 1)
				require.Equal(t, "exception", span.Events()[0].Name)
				require.Contains(t, span.Events()[0].Attributes, attribute.String("exception.message", failure.Error()))
			} else {
				require.Empty(t, span.Events())
			}
			if tc.shadow {
				value, present := loader.cache.Get(key)
				require.Equal(t, tc.cached, present)
				if present {
					require.Equal(t, old, value)
				}
			}
			for _, span := range recorder.Ended() {
				require.NotContains(t, span.Status().Description, "private-")
				for _, attr := range span.Attributes() {
					require.NotContains(t, attr.Value.String(), "private-")
				}
			}
		})
	}
}

func TestPermissionTeamCacheTracing(t *testing.T) {
	recorder := recordPermissionSpans(t)
	loader := &Loader{cache: localcache.New(0, 0)}
	requester := &user.SignedInUser{OrgID: 1}
	requester.TeamIDs = []int64{10, 11} //nolint:staticcheck // The legacy team permission cache uses numeric team IDs.
	for _, teamID := range requester.GetTeams() {
		loader.cache.Set(ac.GetTeamPermissionCacheKey(teamID, 1), []ac.Permission{{Action: "users:read"}}, cacheTTL)
	}
	permissions, err := loader.cachedTeams(t.Context(), requester, ac.Options{}, loadSettings{})
	require.NoError(t, err)
	require.Len(t, permissions, 2)
	span := permissionSpan(t, recorder, "cache.teams")
	require.Equal(t, attribute.IntValue(2), spanAttributes(span)["cache.hits"])
	require.Equal(t, attribute.IntValue(0), spanAttributes(span)["cache.misses"])
	require.Len(t, recorder.Ended(), 1)
}

func TestIntegrationPermissionSQLTracing(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)
	for _, team := range []bool{false, true} {
		name := "permissions"
		if team {
			name = "teams"
		}
		t.Run(name, func(t *testing.T) {
			database := db.NewTestStore(t)
			now := time.Now()
			role := ac.Role{Name: "managed:trace-test", UID: "trace-test", OrgID: 1, Created: now, Updated: now}
			require.NoError(t, database.WithDbSession(t.Context(), func(sess *db.Session) error {
				_, err := sess.Insert(&role)
				if err != nil {
					return err
				}
				if _, err = sess.Insert(&ac.UserRole{RoleID: role.ID, OrgID: 1, UserID: 7, Created: now}); err != nil {
					return err
				}
				if _, err = sess.Insert(&ac.TeamRole{RoleID: role.ID, OrgID: 1, TeamID: 10, Created: now}); err != nil {
					return err
				}
				for _, scope := range []string{"dashboards:uid:one", "dashboards:uid:two"} {
					if _, err = sess.Insert(&ac.Permission{RoleID: role.ID, Action: "dashboards:read", Scope: scope, Created: now, Updated: now}); err != nil {
						return err
					}
				}
				return nil
			}))
			recorder := recordPermissionSpans(t)
			store := permissionStore{database: legacysql.NewDatabaseProvider(database)}
			var got []ac.Permission
			if team {
				result, err := store.teams(t.Context(), ac.GetUserPermissionsQuery{OrgID: 1, TeamIDs: []int64{10}})
				require.NoError(t, err)
				got = result[10]
			} else {
				var err error
				got, err = store.permissions(t.Context(), ac.GetUserPermissionsQuery{OrgID: 1, UserID: 7})
				require.NoError(t, err)
			}
			require.ElementsMatch(t, []ac.Permission{{Action: "dashboards:read", Scope: "dashboards:uid:one"}, {Action: "dashboards:read", Scope: "dashboards:uid:two"}}, got)
			parent := permissionSpan(t, recorder, "sql."+name)
			scan := permissionSpan(t, recorder, "sql.scan")
			require.Equal(t, attribute.IntValue(1), spanAttributes(parent)["query.count"])
			require.Equal(t, attribute.IntValue(2), spanAttributes(scan)["result_count"])
			require.Equal(t, parent.SpanContext().SpanID(), scan.Parent().SpanID())
			require.False(t, scan.StartTime().Before(parent.StartTime()))
			require.False(t, scan.EndTime().After(parent.EndTime()))
			require.Len(t, recorder.Ended(), 2)
		})
	}
}

type tracingLicense struct{ licensing.OSSLicensingService }

func (tracingLicense) FeatureEnabled(feature string) bool {
	return feature == "accesscontrol.enforcement"
}

func TestIntegrationPermissionTracingColdAndWarmCache(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)
	database := db.NewTestStore(t)
	seedPermissionStoreGrants(t, database, "managed:trace-cache", 1, 7,
		ac.Permission{Action: "dashboards:read", Scope: "dashboards:uid:one"},
		ac.Permission{Action: "dashboards:read", Scope: "dashboards:uid:two"})
	cfg := setting.NewCfg()
	cfg.RBAC.PermissionCache = true
	loader := NewLoader(database, NewRoleCatalog(), resourcepermissions.NewActionSetService(), localcache.New(0, 0), cfg, featuremgmt.WithFeatures(), &tracingLicense{}, nil)
	requester := &user.SignedInUser{UserID: 7, UserUID: "seven", OrgID: 1, OrgRole: org.RoleViewer}
	recorder := recordPermissionSpans(t)
	cold, err := loader.GetUserPermissions(t.Context(), requester, ac.Options{})
	require.NoError(t, err)
	require.Len(t, cold, 3)
	queryCount := 0
	for _, span := range recorder.Ended() {
		queryCount += int(spanAttributes(span)["query.count"].AsInt64())
	}
	require.Equal(t, 2, queryCount, "cold basic-role and direct caches each execute one query")
	start := len(recorder.Ended())
	warm, err := loader.GetUserPermissions(t.Context(), requester, ac.Options{})
	require.NoError(t, err)
	require.Equal(t, cold, warm)
	hits, copies := 0, 0
	for _, span := range recorder.Ended()[start:] {
		require.Zero(t, spanAttributes(span)["query.count"].AsInt64())
		if spanAttributes(span)["cache.hit"].AsBool() {
			hits++
		}
		if span.Name() == "authz.legacypermissions.assemble.copy" {
			copies++
			require.Equal(t, attribute.IntValue(3), spanAttributes(span)["result_count"])
		}
	}
	require.Equal(t, 2, hits)
	require.Equal(t, 1, copies)
}

func TestIntegrationPermissionSQLTracingCancellation(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)
	database := db.NewTestStore(t)
	recorder := recordPermissionSpans(t)
	ctx, cancel := context.WithCancel(t.Context())
	cancel()
	result, err := (permissionStore{database: legacysql.NewDatabaseProvider(database)}).permissions(ctx, ac.GetUserPermissionsQuery{OrgID: 1, UserID: 7})
	require.ErrorIs(t, err, context.Canceled)
	require.Nil(t, result)
	parent := permissionSpan(t, recorder, "sql.permissions")
	require.Equal(t, attribute.IntValue(1), spanAttributes(parent)["query.count"])
	require.Equal(t, codes.Error, parent.Status().Code)
	require.Len(t, parent.Events(), 1)
	require.Equal(t, "exception", parent.Events()[0].Name)
	require.Contains(t, parent.Events()[0].Attributes, attribute.String("exception.message", context.Canceled.Error()))
	require.Len(t, recorder.Ended(), 1)
}

func TestPermissionSQLTracingEmptyQuery(t *testing.T) {
	recorder := recordPermissionSpans(t)
	store := permissionStore{}
	_, err := store.permissions(t.Context(), ac.GetUserPermissionsQuery{})
	require.NoError(t, err)
	_, err = store.teams(t.Context(), ac.GetUserPermissionsQuery{})
	require.NoError(t, err)
	for _, name := range []string{"sql.permissions", "sql.teams"} {
		require.Equal(t, attribute.IntValue(0), spanAttributes(permissionSpan(t, recorder, name))["query.count"])
	}
	require.Len(t, recorder.Ended(), 2)
}
