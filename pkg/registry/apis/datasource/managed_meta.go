package datasource

import (
	"context"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apiserver/pkg/registry/rest"

	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/apis/datasource/v0alpha1"
	grafanarest "github.com/grafana/grafana/pkg/apiserver/rest"
	"github.com/grafana/grafana/pkg/infra/log"
)

// managedMetaStore fills a read with the labels and annotations the data_source row cannot hold.
//
// Below unified mode every read goes to the legacy row, which has no column for them, so a
// provisioned data source comes back looking unmanaged. That is not only a missing badge: the
// provisioning ownership guard reads the existing object to decide whether its repository may write
// it, and an unmanaged-looking resource is refused as one it cannot take over.
//
// The collection is the only store that has them, so the read falls back to it -- but only for an
// object that came back without manager annotations, so a managed data source costs one extra read
// and nothing else changes.
type managedMetaStore struct {
	grafanarest.Storage
	collection rest.Getter
	logger     log.Logger
}

// newManagedMetaStore wraps store so reads carry the metadata the legacy row drops.
func newManagedMetaStore(store grafanarest.Storage, collection rest.Getter) grafanarest.Storage {
	return &managedMetaStore{
		Storage:    store,
		collection: collection,
		logger:     log.New("datasource.managedmeta"),
	}
}

// Get implements [rest.Getter].
func (s *managedMetaStore) Get(ctx context.Context, name string, options *metav1.GetOptions) (runtime.Object, error) {
	obj, err := s.Storage.Get(ctx, name, options)
	if err != nil {
		return nil, err
	}

	found, ok := obj.(*v0alpha1.DataSource)
	if !ok {
		return obj, nil
	}
	meta, err := utils.MetaAccessor(found)
	if err != nil {
		return obj, nil
	}
	if _, managed := meta.GetManagerProperties(); managed {
		return obj, nil
	}

	stored, err := s.collection.Get(ctx, name, options)
	if err != nil {
		// The data source itself read fine; only the provisioning surfaces are worse off.
		s.logger.Warn("could not read the stored data source metadata", "name", name, "error", err)
		return obj, nil
	}
	if storedDS, ok := stored.(*v0alpha1.DataSource); ok {
		restoreUnstorableMeta(storedDS, found)
	}
	return found, nil
}
