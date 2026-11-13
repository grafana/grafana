package folder

import (
	"github.com/grafana/grafana-app-sdk/operator"
	"k8s.io/apimachinery/pkg/runtime/schema"

	foldersv1 "github.com/grafana/grafana/apps/folder/pkg/apis/folder/v1"
	"github.com/grafana/grafana/pkg/infra/nats"
	keysapi "github.com/grafana/grafana/pkg/services/apiserver/keys"
	"github.com/grafana/grafana/pkg/services/apiserver/keys/keyslister"
	"github.com/grafana/grafana/pkg/services/folder/cascadedelete"
	usinformer "github.com/grafana/grafana/pkg/storage/unified/informer"
)

// queueGroup is the NATS queue group the controllers' subscriptions join, so each live notification
// reaches one replica.
const queueGroup = "folder-controller"

// folderResourceInfo names the kind for the app-sdk's schema and the resource for the subject the bus publishes on.
type folderResourceInfo struct{}

func (folderResourceInfo) GroupVersionKind() schema.GroupVersionKind {
	return folderGVR.GroupVersion().WithKind("Folder")
}

func (folderResourceInfo) GroupVersionResource() schema.GroupVersionResource { return folderGVR }

// newFolderInformer follows folders from a keys-only snapshot plus live notifications. It starts in
// re-list-only mode when the subscription cannot open, rather than blocking readiness on it.
//
// A live event carries the version the change was announced at, so the controller can tell a resync
// of a folder it already handled from a new change.
func newFolderInformer(subscriber nats.Subscriber, keys keysapi.Lister, page operator.PageFunc) (usinformer.BusSource, error) {
	return usinformer.NewBusDeltaSource(subscriber, &foldersv1.Folder{}, folderResourceInfo{},
		cascadedelete.ResyncPeriod, page, usinformer.BusSourceOptions{
			Group: queueGroup,
			// Identities and no bodies where the server serves them; the paged list is the fallback.
			Keys: keyslister.New(keys),
		})
}
