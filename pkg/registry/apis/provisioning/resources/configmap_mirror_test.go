package resources

import (
	"context"
	"testing"

	"github.com/stretchr/testify/require"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/client-go/kubernetes/fake"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/apps/provisioning/pkg/repository"
	configmaprepo "github.com/grafana/grafana/apps/provisioning/pkg/repository/configmap"
)

type stubFileReader struct {
	data []byte
	cfg  *provisioning.Repository
}

func (s *stubFileReader) Config() *provisioning.Repository { return s.cfg }
func (s *stubFileReader) Test(context.Context) (*provisioning.TestResults, error) {
	return nil, nil
}
func (s *stubFileReader) Read(context.Context, string, string) (*repository.FileInfo, error) {
	return &repository.FileInfo{Data: s.data}, nil
}
func (s *stubFileReader) ReadTree(context.Context, string) ([]repository.FileTreeEntry, error) {
	return nil, nil
}
func (s *stubFileReader) Create(context.Context, string, string, []byte, string) error {
	return nil
}
func (s *stubFileReader) Update(context.Context, string, string, []byte, string) error {
	return nil
}
func (s *stubFileReader) Write(context.Context, string, string, []byte, string) error { return nil }
func (s *stubFileReader) Delete(context.Context, string, string, string) error       { return nil }
func (s *stubFileReader) Move(context.Context, string, string, string, string) error {
	return nil
}

func TestConfigMapMirrorUpsertAndDelete(t *testing.T) {
	client := fake.NewSimpleClientset()
	cfg := &provisioning.Repository{
		ObjectMeta: metav1.ObjectMeta{Name: "repo1", Namespace: "ns1"},
		Spec: provisioning.RepositorySpec{
			Sync: provisioning.SyncOptions{
				ConfigMapMirror: &provisioning.ConfigMapMirrorOptions{
					Enabled:      true,
					PerDashboard: true,
					Labels:       map[string]string{"grafana_dashboard": "1"},
				},
			},
		},
	}
	m := &configMapMirrorResources{
		RepositoryResources: NewMockRepositoryResources(t),
		repo:                &stubFileReader{data: []byte(`{"uid":"uid1"}`), cfg: cfg},
		cfg:                 cfg,
		clients:             configmaprepo.StaticClientProvider(client),
	}

	dashGVK := schema.GroupVersionKind{Group: "dashboard.grafana.app", Version: "v0alpha1", Kind: "Dashboard"}
	m.mirrorUpsert(context.Background(), "a.json", "", "uid1", dashGVK)

	cm, err := client.CoreV1().ConfigMaps("ns1").Get(context.Background(), "grafana-dashboard-uid1", metav1.GetOptions{})
	require.NoError(t, err)
	require.Equal(t, `{"uid":"uid1"}`, cm.Data[dashboardDataKey])
	require.Equal(t, "1", cm.Labels["grafana_dashboard"])

	m.mirrorDelete(context.Background(), "uid1")
	_, err = client.CoreV1().ConfigMaps("ns1").Get(context.Background(), "grafana-dashboard-uid1", metav1.GetOptions{})
	require.True(t, apierrors.IsNotFound(err))
}

func TestMaybeWrapConfigMapMirrorDisabled(t *testing.T) {
	inner := NewMockRepositoryResources(t)
	cfg := &provisioning.Repository{
		Spec: provisioning.RepositorySpec{Sync: provisioning.SyncOptions{}},
	}
	repo := &stubFileReader{cfg: cfg}
	wrapped := MaybeWrapConfigMapMirror(inner, repo, nil)
	require.Equal(t, inner, wrapped)
}
