package dashboard

import (
	"context"
	"testing"

	"github.com/stretchr/testify/require"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime/schema"
	k8srequest "k8s.io/apiserver/pkg/endpoints/request"
)

// storedFolderHandler simulates a folder store that resolves a folder UID
// case-insensitively: Get returns a folder object whose metadata.name is the
// stored casing, mirroring how a mis-cased reference still resolves to the real
// folder on a case-insensitive backend.
type storedFolderHandler struct {
	variableFolderAccessHandler
	storedName string
	notFound   bool
}

func (h *storedFolderHandler) Get(_ context.Context, name string, _ int64, _ metav1.GetOptions, _ ...string) (*unstructured.Unstructured, error) {
	if h.notFound {
		return nil, apierrors.NewNotFound(schema.GroupResource{Group: "folder.grafana.app", Resource: "folders"}, name)
	}
	return &unstructured.Unstructured{Object: map[string]any{
		"metadata": map[string]any{"name": h.storedName},
	}}, nil
}

func TestDashboardAPIBuilder_ValidateFolderExists(t *testing.T) {
	tests := []struct {
		name           string
		folderUID      string
		handler        *storedFolderHandler
		expectNotFound bool
	}{
		{
			name:      "accepts a reference whose casing matches the stored folder",
			folderUID: "GrafanaCom",
			handler:   &storedFolderHandler{storedName: "GrafanaCom"},
		},
		{
			name:           "rejects a mis-cased reference to prevent a dangling folder ref",
			folderUID:      "grafanacom",
			handler:        &storedFolderHandler{storedName: "GrafanaCom"},
			expectNotFound: true,
		},
		{
			name:           "rejects when the folder does not exist",
			folderUID:      "grafanacom",
			handler:        &storedFolderHandler{notFound: true},
			expectNotFound: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			ctx := k8srequest.WithNamespace(context.Background(), "stacks-1")
			b := &DashboardsAPIBuilder{
				folderClientProvider: &staticHandlerProvider{handler: tt.handler},
			}

			folder, err := b.validateFolderExists(ctx, tt.folderUID, 1)

			if tt.expectNotFound {
				require.True(t, apierrors.IsNotFound(err), "expected a NotFound error, got %v", err)
				return
			}
			require.NoError(t, err)
			require.Equal(t, tt.folderUID, folder.GetName())
		})
	}
}
