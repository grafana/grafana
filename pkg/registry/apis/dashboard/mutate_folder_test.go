package dashboard

import (
	"context"
	"testing"

	"github.com/stretchr/testify/require"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apiserver/pkg/admission"
	k8srequest "k8s.io/apiserver/pkg/endpoints/request"

	dashv0 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v0alpha1"
	common "github.com/grafana/grafana/pkg/apimachinery/apis/common/v0alpha1"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
)

// canonicalFolderHandler simulates a folder store that resolves a folder UID
// case-insensitively: any Get returns a folder object whose metadata.name is
// the stored (canonical) casing, mirroring how a mis-cased reference still
// resolves to the real folder on a case-insensitive backend.
type canonicalFolderHandler struct {
	variableFolderAccessHandler
	canonicalName string
	notFound      bool
}

func (h *canonicalFolderHandler) Get(_ context.Context, name string, _ int64, _ metav1.GetOptions, _ ...string) (*unstructured.Unstructured, error) {
	if h.notFound {
		return nil, apierrors.NewNotFound(schema.GroupResource{Group: "folder.grafana.app", Resource: "folders"}, name)
	}
	return &unstructured.Unstructured{Object: map[string]any{
		"metadata": map[string]any{"name": h.canonicalName},
	}}, nil
}

func TestDashboardAPIBuilder_MutateCanonicalizesFolderCase(t *testing.T) {
	tests := []struct {
		name           string
		inputFolder    string
		handler        *canonicalFolderHandler
		expectedFolder string
	}{
		{
			name:           "rewrites a mis-cased folder ref to the folder's real UID",
			inputFolder:    "grafanacom",
			handler:        &canonicalFolderHandler{canonicalName: "GrafanaCom"},
			expectedFolder: "GrafanaCom",
		},
		{
			name:           "no-op when the casing already matches",
			inputFolder:    "GrafanaCom",
			handler:        &canonicalFolderHandler{canonicalName: "GrafanaCom"},
			expectedFolder: "GrafanaCom",
		},
		{
			name:           "leaves the ref unchanged when the folder cannot be resolved",
			inputFolder:    "grafanacom",
			handler:        &canonicalFolderHandler{notFound: true},
			expectedFolder: "grafanacom",
		},
		{
			name:           "no-op when no folder is set",
			inputFolder:    "",
			handler:        &canonicalFolderHandler{canonicalName: "GrafanaCom"},
			expectedFolder: "",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			d := &dashv0.Dashboard{Spec: common.Unstructured{Object: map[string]any{"title": "test"}}}
			meta, err := utils.MetaAccessor(d)
			require.NoError(t, err)
			if tt.inputFolder != "" {
				meta.SetFolder(tt.inputFolder)
			}

			ctx := k8srequest.WithNamespace(context.Background(), "stacks-1")
			ctx = identity.WithRequester(ctx, &identity.StaticRequester{
				OrgRole: identity.RoleEditor,
				OrgID:   1,
			})

			b := &DashboardsAPIBuilder{
				folderClientProvider: &staticHandlerProvider{handler: tt.handler},
			}

			err = b.Mutate(ctx, admission.NewAttributesRecord(
				d,
				nil,
				dashv0.DashboardResourceInfo.GroupVersionKind(),
				"stacks-1",
				d.GetName(),
				dashv0.DashboardResourceInfo.GroupVersionResource(),
				"",
				admission.Create,
				&metav1.CreateOptions{},
				false,
				nil,
			), nil)
			require.NoError(t, err)

			require.Equal(t, tt.expectedFolder, meta.GetFolder())
		})
	}
}

func TestDashboardAPIBuilder_MutateSkipsFolderCanonicalizationOnDryRun(t *testing.T) {
	d := &dashv0.Dashboard{Spec: common.Unstructured{Object: map[string]any{"title": "test"}}}
	meta, err := utils.MetaAccessor(d)
	require.NoError(t, err)
	meta.SetFolder("grafanacom")

	ctx := k8srequest.WithNamespace(context.Background(), "stacks-1")
	ctx = identity.WithRequester(ctx, &identity.StaticRequester{OrgRole: identity.RoleEditor, OrgID: 1})

	b := &DashboardsAPIBuilder{
		folderClientProvider: &staticHandlerProvider{handler: &canonicalFolderHandler{canonicalName: "GrafanaCom"}},
	}

	err = b.Mutate(ctx, admission.NewAttributesRecord(
		d,
		nil,
		dashv0.DashboardResourceInfo.GroupVersionKind(),
		"stacks-1",
		d.GetName(),
		dashv0.DashboardResourceInfo.GroupVersionResource(),
		"",
		admission.Create,
		&metav1.CreateOptions{},
		true, // dryRun
		nil,
	), nil)
	require.NoError(t, err)

	require.Equal(t, "grafanacom", meta.GetFolder(), "dry-run must not mutate the folder ref")
}
