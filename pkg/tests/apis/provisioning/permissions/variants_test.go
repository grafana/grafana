package permissions

import (
	"io"
	"net/http"
	"testing"

	"github.com/google/uuid"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
	pt "github.com/grafana/grafana/pkg/tests/apis/provisioning/permissions/testutil"
)

// A valid render URL serves its blob to an ungranted None user. With ordinary anonymous
// access disabled, record the v0alpha1 authentication exception separately from v1beta1.
func TestIntegrationProvisioning_NoneRender(t *testing.T) {
	h := sharedHelper(t)
	repo := pt.LocalRepo(t, h, "folder")
	ctx := identity.WithRequester(t.Context(), h.Org1.Admin.Identity)
	png := []byte("\x89PNG\r\n\x1a\nseeded-render")
	blob, err := h.GetEnv().ResourceClient.PutBlob(ctx, &resourcepb.PutBlobRequest{Resource: &resourcepb.ResourceKey{Namespace: h.Namespace, Group: "provisioning.grafana.app", Resource: "repositories", Name: repo}, Method: resourcepb.PutBlobRequest_GRPC, ContentType: "image/png", Value: png})
	require.NoError(t, err)
	require.Nil(t, blob.Error)
	require.NotEmpty(t, blob.Uid)
	u := pt.None(t, h)
	for _, version := range pt.Versions {
		t.Run(version, func(t *testing.T) {
			path := "repositories/" + repo + "/render/"
			rsp := pt.Do(t, u, "GET", version, path+blob.Uid, nil).Require(t, 200)
			require.Equal(t, png, rsp.Body)
			pt.Do(t, u, "GET", version, path+uuid.NewString(), nil).Require(t, 404)
			req, err := http.NewRequestWithContext(t.Context(), "GET", u.NewRestConfig().Host+pt.Path(version, path+blob.Uid), nil)
			require.NoError(t, err)
			res, err := http.DefaultClient.Do(req)
			require.NoError(t, err)
			defer func() { require.NoError(t, res.Body.Close()) }()
			data, err := io.ReadAll(res.Body)
			require.NoError(t, err)
			if version == "v0alpha1" {
				require.Equal(t, 200, res.StatusCode)
				require.Equal(t, png, data)
			} else {
				require.Equal(t, 401, res.StatusCode, string(data))
			}
		})
	}
}
