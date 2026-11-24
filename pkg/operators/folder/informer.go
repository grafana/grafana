package folder

import (
	"context"
	"strconv"

	"github.com/grafana/grafana-app-sdk/operator"
	"github.com/grafana/grafana-app-sdk/resource"
	"k8s.io/apimachinery/pkg/api/meta"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime"

	"github.com/grafana/grafana/pkg/services/apiserver/informers"
	keysapi "github.com/grafana/grafana/pkg/services/apiserver/keys"
	"github.com/grafana/grafana/pkg/services/folder/cascadedelete"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
)

// newFolderSource returns the folder delta source the supplier selects. The cascade-delete handler
// reads folders as unstructured objects, as the dynamic informer delivered them.
func newFolderSource(supplier operator.InformerSupplier, clients resource.ClientGenerator) (informers.DeltaSource, error) {
	return informers.NewDeltaSource(operator.InformerRequest{
		Kind:     informers.UntypedKind(folderGVR, "Folder"),
		Clients:  clients,
		Supplier: supplier,
		Options:  operator.InformerOptions{WatchNeeds: informers.KeyedNeeds, CacheResyncInterval: cascadedelete.ResyncPeriod},
	}, func() runtime.Object { return &unstructured.Unstructured{} })
}

// stampResourceVersion gives a live event the version a re-list reports for the same change, so the
// controller can tell a resync of a folder it already handled from a new one.
func stampResourceVersion(obj runtime.Object, evt *resourcepb.WatchNotification) runtime.Object {
	if acc, err := meta.Accessor(obj); err == nil && evt.ResourceVersion > 0 {
		acc.SetResourceVersion(strconv.FormatInt(evt.ResourceVersion, 10))
	}
	return obj
}

// listFolderKeys projects a keys snapshot to the objects the informer diffs.
func listFolderKeys(ctx context.Context, keys keysapi.Lister) ([]runtime.Object, int64, error) {
	listRV, seq := keys.ListKeys(ctx)
	var out []runtime.Object
	for key, err := range seq {
		if err != nil {
			// A partial snapshot would report the remaining folders as deleted.
			return nil, 0, err
		}
		out = append(out, &metav1.PartialObjectMetadata{ObjectMeta: metav1.ObjectMeta{
			Namespace:       key.Namespace,
			Name:            key.Name,
			ResourceVersion: key.ResourceVersion,
		}})
	}
	return out, listRV, nil
}
