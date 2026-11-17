package datasource

import (
	"context"
	"errors"
	"testing"

	"github.com/stretchr/testify/require"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	"github.com/grafana/grafana/pkg/apimachinery/utils"
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

// Under dual write it is the object the legacy store returns, not the request, that is written to
// unified storage -- so metadata the data_source row cannot hold has to survive the round trip or
// it is lost for good. Manager annotations are the case that matters.
func TestRestoreUnstorableMeta(t *testing.T) {
	t.Run("puts back what the row dropped and keeps what it derived", func(t *testing.T) {
		from := &v0alpha1.DataSource{ObjectMeta: metav1.ObjectMeta{
			Labels:      map[string]string{"team": "platform", "env": "prod"},
			Annotations: map[string]string{utils.AnnoKeyManagerKind: "repo", utils.AnnoKeyManagerIdentity: "my-repo"},
		}}
		to := &v0alpha1.DataSource{ObjectMeta: metav1.ObjectMeta{
			Labels:      map[string]string{"default": "true", utils.LabelKeyDeprecatedInternalID: "12"},
			Annotations: map[string]string{utils.AnnoKeyUpdatedTimestamp: "2026-11-03T00:00:00Z"},
		}}

		restoreUnstorableMeta(from, to)

		require.Equal(t, map[string]string{
			"team": "platform", "env": "prod",
			"default": "true", utils.LabelKeyDeprecatedInternalID: "12",
		}, to.Labels)
		require.Equal(t, map[string]string{
			utils.AnnoKeyManagerKind:      "repo",
			utils.AnnoKeyManagerIdentity:  "my-repo",
			utils.AnnoKeyUpdatedTimestamp: "2026-11-03T00:00:00Z",
		}, to.Annotations)
	})

	// The row is the authority for anything it does store.
	t.Run("does not overwrite a key the row set", func(t *testing.T) {
		from := &v0alpha1.DataSource{ObjectMeta: metav1.ObjectMeta{
			Labels: map[string]string{"default": "false"},
		}}
		to := &v0alpha1.DataSource{ObjectMeta: metav1.ObjectMeta{
			Labels: map[string]string{"default": "true"},
		}}

		restoreUnstorableMeta(from, to)

		require.Equal(t, "true", to.Labels["default"])
	})

	t.Run("fills empty maps", func(t *testing.T) {
		from := &v0alpha1.DataSource{ObjectMeta: metav1.ObjectMeta{
			Annotations: map[string]string{utils.AnnoKeyManagerKind: "repo"},
		}}
		to := &v0alpha1.DataSource{}

		restoreUnstorableMeta(from, to)

		require.Equal(t, map[string]string{utils.AnnoKeyManagerKind: "repo"}, to.Annotations)
		require.Nil(t, to.Labels)
	})
}
