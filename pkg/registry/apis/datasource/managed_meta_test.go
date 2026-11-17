package datasource

import (
	"context"
	"errors"
	"testing"

	"github.com/stretchr/testify/require"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"

	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/apis/datasource/v0alpha1"
	grafanarest "github.com/grafana/grafana/pkg/apiserver/rest"
)

type stubGetter struct {
	obj   runtime.Object
	err   error
	calls int
}

func (s *stubGetter) Get(context.Context, string, *metav1.GetOptions) (runtime.Object, error) {
	s.calls++
	return s.obj, s.err
}

type stubStorage struct {
	grafanarest.Storage
	getter *stubGetter
}

func (s *stubStorage) Get(ctx context.Context, name string, options *metav1.GetOptions) (runtime.Object, error) {
	return s.getter.Get(ctx, name, options)
}

func managedDataSource() *v0alpha1.DataSource {
	return &v0alpha1.DataSource{ObjectMeta: metav1.ObjectMeta{
		Name:        "prom-uid",
		Labels:      map[string]string{"team": "platform"},
		Annotations: map[string]string{utils.AnnoKeyManagerKind: "repo", utils.AnnoKeyManagerIdentity: "my-repo"},
	}}
}

func TestManagedMetaStoreGet(t *testing.T) {
	// The provisioning ownership guard reads the existing object to decide whether a repository may
	// write it, so a managed data source that reads back unmanaged is refused as a take-over.
	t.Run("fills the manager annotations the legacy row dropped", func(t *testing.T) {
		primary := &stubGetter{obj: &v0alpha1.DataSource{ObjectMeta: metav1.ObjectMeta{Name: "prom-uid"}}}
		collection := &stubGetter{obj: managedDataSource()}

		got, err := newManagedMetaStore(&stubStorage{getter: primary}, collection).
			Get(context.Background(), "prom-uid", &metav1.GetOptions{})
		require.NoError(t, err)

		found := got.(*v0alpha1.DataSource)
		require.Equal(t, "repo", found.Annotations[utils.AnnoKeyManagerKind])
		require.Equal(t, "my-repo", found.Annotations[utils.AnnoKeyManagerIdentity])
		require.Equal(t, "platform", found.Labels["team"])
	})

	t.Run("does not read the collection when the object is already managed", func(t *testing.T) {
		primary := &stubGetter{obj: managedDataSource()}
		collection := &stubGetter{obj: managedDataSource()}

		_, err := newManagedMetaStore(&stubStorage{getter: primary}, collection).
			Get(context.Background(), "prom-uid", &metav1.GetOptions{})
		require.NoError(t, err)
		require.Zero(t, collection.calls)
	})

	// The data source itself read fine; only the provisioning surfaces are worse off.
	t.Run("returns the object when the collection read fails", func(t *testing.T) {
		primary := &stubGetter{obj: &v0alpha1.DataSource{ObjectMeta: metav1.ObjectMeta{Name: "prom-uid"}}}
		collection := &stubGetter{err: errors.New("boom")}

		got, err := newManagedMetaStore(&stubStorage{getter: primary}, collection).
			Get(context.Background(), "prom-uid", &metav1.GetOptions{})
		require.NoError(t, err)
		require.Equal(t, "prom-uid", got.(*v0alpha1.DataSource).Name)
	})

	t.Run("propagates the primary error", func(t *testing.T) {
		primary := &stubGetter{err: errors.New("boom")}
		collection := &stubGetter{}

		_, err := newManagedMetaStore(&stubStorage{getter: primary}, collection).
			Get(context.Background(), "prom-uid", &metav1.GetOptions{})
		require.Error(t, err)
		require.Zero(t, collection.calls)
	})
}
