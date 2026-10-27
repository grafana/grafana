package acimpl

import (
	"context"
	"errors"
	"fmt"
	"testing"
	"time"

	"github.com/grafana/authlib/types"
	"github.com/open-feature/go-sdk/openfeature"
	"github.com/open-feature/go-sdk/openfeature/memprovider"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/testutil"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	ac "github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/accesscontrol/actest"
	"github.com/grafana/grafana/pkg/services/accesscontrol/resourcepermissions"
	"github.com/grafana/grafana/pkg/services/authz/legacyclient"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/setting"
)

type shadowLegacyClient struct {
	legacyclient.Service
	get func(context.Context, legacyclient.LegacyGetUserPermissionsRequest) (legacyclient.LegacyGetUserPermissionsResponse, error)
}

func (c shadowLegacyClient) LegacyGetUserPermissions(ctx context.Context, _ types.AuthInfo, req legacyclient.LegacyGetUserPermissionsRequest) (legacyclient.LegacyGetUserPermissionsResponse, error) {
	return c.get(ctx, req)
}

func shadowRequester() *identity.StaticRequester {
	return &identity.StaticRequester{Type: types.TypeUser, UserID: 1, UserUID: "user", OrgID: 1, Namespace: types.OrgNamespaceFormatter(1), Groups: []string{"group"}}
}

func waitForShadow(t *testing.T, s *LegacyUserPermissionsShadow, result string) {
	t.Helper()
	require.Eventually(t, func() bool { return testutil.ToFloat64(s.results.WithLabelValues(result)) == 1 }, time.Second, time.Millisecond)
}

func TestPermissionSetDifference(t *testing.T) {
	for _, tc := range []struct {
		name            string
		old, new        []ac.Permission
		missing, gained []permissionKey
	}{
		{name: "empty"},
		{name: "order and duplicates", old: []ac.Permission{{Action: "read", Scope: "one"}, {Action: "write"}, {Action: "read", Scope: "one"}}, new: []ac.Permission{{Action: "write"}, {Action: "read", Scope: "one"}}},
		{name: "scope differs", old: []ac.Permission{{Action: "read", Scope: "one"}}, new: []ac.Permission{{Action: "read", Scope: "two"}}, missing: []permissionKey{{"read", "one"}}, gained: []permissionKey{{"read", "two"}}},
		{name: "action differs", old: []ac.Permission{{Action: "read"}}, new: []ac.Permission{{Action: "write"}}, missing: []permissionKey{{"read", ""}}, gained: []permissionKey{{"write", ""}}},
		{name: "wildcard is not equivalent", old: []ac.Permission{{Action: "read", Scope: "*"}}, new: []ac.Permission{{Action: "read", Scope: "one"}}, missing: []permissionKey{{"read", "*"}}, gained: []permissionKey{{"read", "one"}}},
	} {
		t.Run(tc.name, func(t *testing.T) {
			missing, gained := permissionSetDifference(tc.old, tc.new)
			require.ElementsMatch(t, tc.missing, missing)
			require.ElementsMatch(t, tc.gained, gained)
		})
	}
}

func TestPermissionShadowDoesNotBlockAndSnapshotsInput(t *testing.T) {
	registry := prometheus.NewRegistry()
	s := NewLegacyUserPermissionsShadow(registry)
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	usr := shadowRequester()
	permissions := []ac.Permission{{Action: "read", Scope: "one"}}
	release := make(chan struct{})
	observed := make(chan legacyclient.LegacyGetUserPermissionsRequest, 1)
	client := shadowLegacyClient{get: func(ctx context.Context, req legacyclient.LegacyGetUserPermissionsRequest) (legacyclient.LegacyGetUserPermissionsResponse, error) {
		<-release
		if ctx.Err() != nil {
			return legacyclient.LegacyGetUserPermissionsResponse{}, ctx.Err()
		}
		if deadline, ok := ctx.Deadline(); !ok || time.Until(deadline) > 10*time.Second {
			return legacyclient.LegacyGetUserPermissionsResponse{}, errors.New("shadow timeout is missing")
		}
		observed <- req
		return legacyclient.LegacyGetUserPermissionsResponse{Permissions: []types.Permission{{Action: "read", Scope: "one"}}}, nil
	}}
	returned := make(chan struct{})
	go func() {
		_, _ = s.GetUserPermissions(ctx, client, usr, ac.Options{ReloadCache: true}, setting.NewCfg(), func() ([]ac.Permission, error) { return permissions, nil })
		close(returned)
	}()
	select {
	case <-returned:
	case <-time.After(time.Second):
		t.Fatal("The primary call waited for the shadow call")
	}
	cancel()
	usr.Groups[0] = "changed"
	usr.UserUID = "changed"
	permissions[0].Scope = "changed"
	close(release)
	waitForShadow(t, s, "ok")
	req := <-observed
	require.Equal(t, []string{"group"}, req.Identity.Groups)
	require.Equal(t, "user", req.Identity.UID)
	require.True(t, req.ReloadCache)
	families, err := registry.Gather()
	require.NoError(t, err)
	for _, family := range families {
		if family.GetName() == "grafana_accesscontrol_user_permissions_duration_milliseconds" {
			require.Len(t, family.Metric, 2)
			for _, metric := range family.Metric {
				require.Equal(t, uint64(1), metric.GetHistogram().GetSampleCount())
				require.Greater(t, metric.GetHistogram().GetSampleSum(), float64(0))
			}
		}
	}
}

func TestPermissionShadowFailures(t *testing.T) {
	for _, mode := range []string{"mismatch", "shadow error", "primary error", "missing client", "panic"} {
		t.Run(mode, func(t *testing.T) {
			s := NewLegacyUserPermissionsShadow(prometheus.NewRegistry())
			primaryErr := error(nil)
			if mode == "primary error" {
				primaryErr = errors.New("primary failed")
			}
			var client legacyclient.Service = shadowLegacyClient{get: func(context.Context, legacyclient.LegacyGetUserPermissionsRequest) (legacyclient.LegacyGetUserPermissionsResponse, error) {
				if mode == "panic" {
					panic("shadow panic")
				}
				if mode == "shadow error" {
					return legacyclient.LegacyGetUserPermissionsResponse{}, errors.New("shadow failed")
				}
				return legacyclient.LegacyGetUserPermissionsResponse{}, nil
			}}
			if mode == "missing client" {
				client = nil
			}
			want := []ac.Permission{{Action: "read"}}
			got, err := s.GetUserPermissions(t.Context(), client, shadowRequester(), ac.Options{}, setting.NewCfg(), func() ([]ac.Permission, error) { return want, primaryErr })
			require.Equal(t, want, got)
			require.ErrorIs(t, err, primaryErr)
			waitForShadow(t, s, "error")
		})
	}
}

func TestPermissionShadowRouting(t *testing.T) {
	for _, shadow := range []bool{false, true} {
		for _, replacement := range []bool{false, true} {
			t.Run(fmt.Sprintf("shadow=%t/replacement=%t", shadow, replacement), func(t *testing.T) {
				require.NoError(t, openfeature.SetProviderAndWait(memprovider.NewInMemoryProvider(map[string]memprovider.InMemoryFlag{
					featuremgmt.FlagAuthzLegacyUserPermissions:       {State: memprovider.Enabled, Variants: map[string]any{"value": replacement}, DefaultVariant: "value"},
					featuremgmt.FlagAuthzLegacyUserPermissionsShadow: {State: memprovider.Enabled, Variants: map[string]any{"value": shadow}, DefaultVariant: "value"},
				})))
				t.Cleanup(func() { require.NoError(t, openfeature.SetProviderAndWait(openfeature.NoopProvider{})) })
				s := &Service{
					cfg: setting.NewCfg(), features: featuremgmt.WithFeatures(),
					store:          actest.FakeStore{},
					actionResolver: resourcepermissions.NewActionSetService(),
					legacyShadow:   NewLegacyUserPermissionsShadow(nil),
					legacyClient: shadowLegacyClient{get: func(context.Context, legacyclient.LegacyGetUserPermissionsRequest) (legacyclient.LegacyGetUserPermissionsResponse, error) {
						return legacyclient.LegacyGetUserPermissionsResponse{}, nil
					}},
				}
				got, err := s.GetUserPermissions(t.Context(), shadowRequester(), ac.Options{})
				require.NoError(t, err)
				if shadow || !replacement {
					require.Equal(t, []ac.Permission{SharedWithMeFolderPermission}, got)
				} else {
					require.Empty(t, got)
				}
				if shadow {
					waitForShadow(t, s.legacyShadow, "error")
				}
				s.cfg.RBAC.SingleOrganization = true
				s.userPermissionsAPIEnabled = true
				delegated := []ac.Permission{{Action: "delegated"}}
				client := &fakeUserPermissionsClient{permissions: delegated}
				s.SetUserPermissionsClient(client)
				got, err = s.GetUserPermissions(t.Context(), shadowRequester(), ac.Options{})
				require.NoError(t, err)
				require.Equal(t, delegated, got)
				require.Equal(t, 1, client.calls)
			})
		}
	}
}

func TestPermissionShadowConcurrencyLimit(t *testing.T) {
	s := NewLegacyUserPermissionsShadow(nil)
	for range cap(s.inFlight) {
		s.inFlight <- struct{}{}
	}
	want := []ac.Permission{{Action: "read"}}
	got, err := s.GetUserPermissions(t.Context(), nil, shadowRequester(), ac.Options{}, setting.NewCfg(), func() ([]ac.Permission, error) { return want, nil })
	require.NoError(t, err)
	require.Equal(t, want, got)
	require.Equal(t, float64(1), testutil.ToFloat64(s.skipped))
}
