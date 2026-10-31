package datasource

import (
	"context"
	"errors"
	"testing"

	"github.com/stretchr/testify/require"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	"github.com/grafana/grafana/pkg/apis/datasource/v0alpha1"
	"github.com/grafana/grafana/pkg/services/datasources"
)

// The provider returns datasources.ErrDataSourceNotFound, a plain error. Every apiserver caller
// branches on apierrors.IsNotFound, so without translation a missing data source reads as a real
// failure -- provisioning abandons the sync rather than falling through to create.
func TestLegacyStorageTranslatesNotFound(t *testing.T) {
	ri := v0alpha1.DataSourceResourceInfo.WithGroupAndShortName("prometheus.datasource.grafana.app", "prometheus")
	store := &legacyStorage{
		datasources:  &notFoundDatasourceProvider{},
		resourceInfo: &ri,
	}

	t.Run("Get", func(t *testing.T) {
		_, err := store.Get(context.Background(), "missing", &metav1.GetOptions{})
		require.True(t, apierrors.IsNotFound(err), "expected a Kubernetes NotFound, got %v", err)
	})

	t.Run("Delete", func(t *testing.T) {
		_, _, err := store.Delete(context.Background(), "missing", nil, &metav1.DeleteOptions{})
		require.True(t, apierrors.IsNotFound(err), "expected a Kubernetes NotFound, got %v", err)
	})

	t.Run("leaves every other error alone", func(t *testing.T) {
		boom := errors.New("boom")
		other := &legacyStorage{datasources: &notFoundDatasourceProvider{err: boom}, resourceInfo: &ri}
		_, err := other.Get(context.Background(), "whatever", &metav1.GetOptions{})
		require.ErrorIs(t, err, boom)
		require.False(t, apierrors.IsNotFound(err))
	})
}

// notFoundDatasourceProvider answers every call with err, defaulting to the store's not-found.
type notFoundDatasourceProvider struct {
	PluginDatasourceProvider
	err error
}

func (p *notFoundDatasourceProvider) failure() error {
	if p.err != nil {
		return p.err
	}
	return datasources.ErrDataSourceNotFound
}

func (p *notFoundDatasourceProvider) GetDataSource(context.Context, string) (*v0alpha1.DataSource, error) {
	return nil, p.failure()
}

func (p *notFoundDatasourceProvider) DeleteDataSource(context.Context, string) error {
	return p.failure()
}
