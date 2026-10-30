package folder

import (
	"context"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"

	foldersv1 "github.com/grafana/grafana/apps/folder/pkg/apis/folder/v1"
	"github.com/grafana/grafana/pkg/infra/nats"
	keysapi "github.com/grafana/grafana/pkg/services/apiserver/keys"
	"github.com/grafana/grafana/pkg/services/folder/cascadedelete"
	usinformer "github.com/grafana/grafana/pkg/storage/unified/informer"
)

// queueGroup is the NATS queue group the controllers' subscriptions join, so each live notification
// reaches one replica.
const queueGroup = "folder-controller"

// newFolderInformer follows folders from a keys-only snapshot plus live notifications. It starts in
// re-list-only mode when the subscription cannot open, rather than blocking readiness on it.
func newFolderInformer(subscriber nats.Subscriber, keys keysapi.Lister) *usinformer.Informer {
	newObject := func(ns, name string) runtime.Object {
		return &foldersv1.Folder{ObjectMeta: metav1.ObjectMeta{Namespace: ns, Name: name}}
	}
	list := func(ctx context.Context) ([]runtime.Object, int64, error) {
		return listFolderKeys(ctx, keys)
	}
	inf := usinformer.NewInformer(subscriber, folderGVR, "", cascadedelete.ResyncPeriod, queueGroup, nil, newObject, list)
	inf.AllowDegradedStart()
	return inf
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
