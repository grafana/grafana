package apistore

import (
	"testing"

	"github.com/stretchr/testify/require"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apiserver/pkg/endpoints/request"

	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
)

func TestCreateNamespace(t *testing.T) {
	for _, tt := range []struct {
		name             string
		keyNamespace     string
		objectNamespace  string
		requestNamespace string
		wantError        bool
	}{
		{name: "sets missing namespace", keyNamespace: "default"},
		{name: "preserves matching namespace", keyNamespace: "default", objectNamespace: "default"},
		{name: "rejects mismatched namespace", keyNamespace: "default", objectNamespace: "other", wantError: true},
		{name: "allows empty namespaces"},
		{name: "rejects namespace with empty key namespace", objectNamespace: "default", wantError: true},
		{name: "uses key namespace for defaulting", keyNamespace: "default", requestNamespace: "other"},
		{name: "uses key namespace for validation", keyNamespace: "default", objectNamespace: "other", requestNamespace: "other", wantError: true},
	} {
		t.Run(tt.name, func(t *testing.T) {
			ctx := request.WithNamespace(testContext(t), tt.requestNamespace)
			client := &inlineBlobClient{}
			s := testStorage(t, client)
			s.getKey = func(string) (*resourcepb.ResourceKey, error) {
				return &resourcepb.ResourceKey{Namespace: tt.keyNamespace, Group: "example.grafana.app", Resource: "examples", Name: "test"}, nil
			}
			obj := &unstructured.Unstructured{}
			require.NoError(t, obj.UnmarshalJSON(testObject(t)))
			obj.SetNamespace(tt.objectNamespace)
			out := &unstructured.Unstructured{}
			err := s.Create(ctx, "/examples/test", obj, out, 0)
			if tt.wantError {
				require.Error(t, err)
				require.True(t, apierrors.IsBadRequest(err))
				require.ErrorContains(t, err, "namespace mismatch")
				require.Zero(t, client.writes)
				return
			}
			require.NoError(t, err)
			require.Equal(t, 1, client.writes)
			require.Equal(t, tt.keyNamespace, out.GetNamespace())
			stored := &unstructured.Unstructured{}
			require.NoError(t, stored.UnmarshalJSON(client.value))
			require.Equal(t, tt.keyNamespace, stored.GetNamespace())
		})
	}
}
