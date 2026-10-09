package service

import (
	"errors"
	authlib "github.com/grafana/authlib/types"
	resourcestorage "github.com/grafana/grafana/pkg/storage/unified/resource"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
	"github.com/prometheus/client_golang/prometheus/testutil"
	"github.com/stretchr/testify/require"
	"testing"
)

func TestSearchServicePermissionExemptions(t *testing.T) {
	const group, resource = "playlist.grafana.app", "playlists"
	for mode, id := range map[string]authlib.AuthInfo{
		"direct":    serviceWithPermissions(),
		"delegated": tokenWithoutDelegation(),
	} {
		for _, tc := range []struct {
			name            string
			opts            resourcestorage.AuthzOptions
			requestGroup    string
			requestResource string
			federated       bool
			namespace       string
			wantErr         error
			wantExempt      float64
		}{
			{name: "exempt", opts: resourcestorage.AuthzOptions{ExemptionEnabled: true, ExemptResources: []string{group + "/" + resource}}, wantExempt: 1},
			{name: "legacy bypass", wantExempt: 1},
			{name: "not exempt", opts: resourcestorage.AuthzOptions{ExemptionEnabled: true}, wantErr: resourcestorage.ErrServicePermissionMissing},
			{name: "sibling resource", opts: resourcestorage.AuthzOptions{ExemptionEnabled: true, ExemptResources: []string{group + "/other"}}, wantErr: resourcestorage.ErrServicePermissionMissing},
			{name: "always enforced", requestGroup: "dashboard.grafana.app", requestResource: "dashboards", opts: resourcestorage.AuthzOptions{ExemptionEnabled: true, ExemptResources: []string{group + "/" + resource}}, wantErr: resourcestorage.ErrServicePermissionMissing},
			{name: "federated enforced resource", opts: resourcestorage.AuthzOptions{ExemptionEnabled: true, ExemptResources: []string{group + "/" + resource}}, federated: true, wantExempt: 1, wantErr: resourcestorage.ErrServicePermissionMissing},
			{name: "namespace mismatch", opts: resourcestorage.AuthzOptions{ExemptionEnabled: true, ExemptResources: []string{group + "/" + resource}}, namespace: "stacks-2", wantErr: authlib.ErrNamespaceMismatch},
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
				s := newPermissionTestSearchServer(resourcestorage.NewAuthzLimitedClient(authlib.FixedAccessClient(false), tc.opts))
				s.log = logger
				req := &resourcepb.ResourceSearchRequest{Options: &resourcepb.ListOptions{Key: &resourcepb.ResourceKey{
					Namespace: namespace, Group: requestGroup, Resource: requestResource,
				}}}
				if tc.federated {
					req.Federated = []*resourcepb.ResourceKey{{Group: "folder.grafana.app", Resource: "folders"}}
				}
				wantErr := tc.wantErr
				if mode == "delegated" && errors.Is(wantErr, resourcestorage.ErrServicePermissionMissing) {
					wantErr = resourcestorage.ErrServiceCannotDelegate
				}
				err := s.checkSearchServicePermissions(authlib.WithAuthInfo(t.Context(), id), req)
				require.ErrorIs(t, err, wantErr)
				require.Equal(t, tc.wantExempt, testutil.ToFloat64(s.indexMetrics.SearchServicePermissionExemptions.WithLabelValues(group, resource, mode)))
				wantFailures := 0
				if wantErr != nil && !errors.Is(wantErr, authlib.ErrNamespaceMismatch) {
					wantFailures = 1
				}
				require.Equal(t, float64(wantFailures), testutil.ToFloat64(s.indexMetrics.SearchServicePermissionFailures.WithLabelValues(mode)))
				require.Equal(t, wantFailures, logger.ErrorLogs.Calls)
			})
		}
	}
}
