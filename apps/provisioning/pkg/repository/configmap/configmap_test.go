package configmap

import (
	"context"
	"strings"
	"testing"

	"github.com/stretchr/testify/require"
	corev1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/client-go/kubernetes/fake"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/apps/provisioning/pkg/repository"
)

func TestEncodeDecodeKey(t *testing.T) {
	key, err := encodeKey("folder/dash.json", "pfx_")
	require.NoError(t, err)
	require.Equal(t, "pfx_folder__dash.json", key)

	path, ok := decodeKey(key, "pfx_")
	require.True(t, ok)
	require.Equal(t, "folder/dash.json", path)
}

func TestEnsureUnderLimit(t *testing.T) {
	require.NoError(t, ensureUnderLimit(map[string]string{"a": "b"}))
	big := strings.Repeat("x", MaxConfigMapBytes)
	require.Error(t, ensureUnderLimit(map[string]string{"k": big}))
}

func TestConfigMapRepositoryCRUD(t *testing.T) {
	client := fake.NewSimpleClientset(&corev1.ConfigMap{
		ObjectMeta: metav1.ObjectMeta{Name: "dashboards", Namespace: "default"},
		Data:       map[string]string{},
	})
	repo := NewRepository(&provisioning.Repository{
		ObjectMeta: metav1.ObjectMeta{Name: "cm-repo", Namespace: "default"},
		Spec: provisioning.RepositorySpec{
			Type: provisioning.ConfigMapRepositoryType,
			ConfigMap: &provisioning.ConfigMapRepositoryConfig{
				Name: "dashboards",
			},
		},
	}, StaticClientProvider(client))

	ctx := context.Background()
	require.NoError(t, repo.Create(ctx, "folder/a.json", "", []byte(`{"title":"a"}`), ""))
	info, err := repo.Read(ctx, "folder/a.json", "")
	require.NoError(t, err)
	require.Equal(t, `{"title":"a"}`, string(info.Data))

	tree, err := repo.ReadTree(ctx, "")
	require.NoError(t, err)
	var foundBlob, foundDir bool
	for _, e := range tree {
		if e.Path == "folder/" && !e.Blob {
			foundDir = true
		}
		if e.Path == "folder/a.json" && e.Blob {
			foundBlob = true
		}
	}
	require.True(t, foundDir)
	require.True(t, foundBlob)

	require.NoError(t, repo.Update(ctx, "folder/a.json", "", []byte(`{"title":"b"}`), ""))
	info, err = repo.Read(ctx, "folder/a.json", "")
	require.NoError(t, err)
	require.Equal(t, `{"title":"b"}`, string(info.Data))

	require.NoError(t, repo.Move(ctx, "folder/a.json", "folder/b.json", "", ""))
	_, err = repo.Read(ctx, "folder/a.json", "")
	require.ErrorIs(t, err, repository.ErrFileNotFound)
	info, err = repo.Read(ctx, "folder/b.json", "")
	require.NoError(t, err)
	require.Equal(t, `{"title":"b"}`, string(info.Data))

	require.NoError(t, repo.Delete(ctx, "folder/b.json", "", ""))
	_, err = repo.Read(ctx, "folder/b.json", "")
	require.ErrorIs(t, err, repository.ErrFileNotFound)
}

func TestValidate(t *testing.T) {
	errs := Validate(context.Background(), &provisioning.Repository{
		Spec: provisioning.RepositorySpec{Type: provisioning.ConfigMapRepositoryType},
	})
	require.NotEmpty(t, errs)

	errs = Validate(context.Background(), &provisioning.Repository{
		Spec: provisioning.RepositorySpec{
			Type:      provisioning.ConfigMapRepositoryType,
			ConfigMap: &provisioning.ConfigMapRepositoryConfig{Name: "x", LabelSelector: "a=b"},
		},
	})
	require.NotEmpty(t, errs)

	errs = Validate(context.Background(), &provisioning.Repository{
		Spec: provisioning.RepositorySpec{
			Type:      provisioning.ConfigMapRepositoryType,
			ConfigMap: &provisioning.ConfigMapRepositoryConfig{Name: "x"},
		},
	})
	require.Empty(t, errs)
}
