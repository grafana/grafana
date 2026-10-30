package snapshot

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/stretchr/testify/require"

	dashv0 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v0alpha1"
	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/services/apiserver/endpoints/request"
	"github.com/grafana/grafana/pkg/services/dashboardsnapshots"
)

func TestExternalSnapshotUsesReturnedDeleteURL(t *testing.T) {
	for _, kubernetes := range []bool{false, true} {
		t.Run(map[bool]string{false: "legacy", true: "kubernetes"}[kubernetes], func(t *testing.T) {
			setExternalSnapshotsK8SAPIPushToggle(t, kubernetes)
			called := false
			server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				called = true
				require.Equal(t, "/private/secret?token=original", r.URL.RequestURI())
				if kubernetes {
					require.Equal(t, http.MethodDelete, r.Method)
				} else {
					require.Equal(t, http.MethodGet, r.Method)
				}
				w.WriteHeader(http.StatusOK)
			}))
			defer server.Close()

			cmd := &dashboardsnapshots.CreateDashboardSnapshotCommand{
				External: true, ExternalURL: "https://public.example.com/share/key",
				ExternalDeleteURL: server.URL + "/private/secret?token=original", DeleteKey: "secret",
			}
			snap := convertCreateCmdToK8sSnapshot(cmd, "default")
			deleteURL, err := deleteSnapshotFromExternalHost(context.Background(), snap, dashv0.SnapshotSharingOptions{})
			require.NoError(t, err)
			require.Equal(t, cmd.ExternalDeleteURL, deleteURL)
			require.True(t, called)
		})
	}
}

func TestLegacySnapshotPreservesExternalDeleteURL(t *testing.T) {
	original := &dashboardsnapshots.DashboardSnapshot{
		External: true, ExternalURL: "https://public.example.com/share/key",
		ExternalDeleteURL: "https://delete.example.com/private/secret?token=original",
		DeleteKey:         "secret", Dashboard: simplejson.New(),
	}
	snap := convertSnapshotToK8sResource(original, request.GetNamespaceMapper(nil))
	require.Equal(t, original.ExternalDeleteURL, snap.GetExternalDeleteURL())
}
