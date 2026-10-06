package snapshot

import (
	"context"
	"fmt"
	"net/http"

	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apiserver/pkg/registry/rest"

	authlib "github.com/grafana/authlib/types"
	dashv0 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v0alpha1"
	"github.com/grafana/grafana/pkg/apimachinery/apis/common/v0alpha1"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/services/apiserver/endpoints/request"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
)

// Currently only works with v0alpha1
type dashboardREST struct {
	getter rest.Getter
	blobs  resourcepb.BlobStoreClient
}

func NewDashboardREST(
	getter rest.Getter,
	blobs resourcepb.BlobStoreClient,
) (rest.Storage, error) {
	return &dashboardREST{
		getter: getter,
		blobs:  blobs,
	}, nil
}

var (
	_ rest.Connecter       = (*dashboardREST)(nil)
	_ rest.StorageMetadata = (*dashboardREST)(nil)
)

func (r *dashboardREST) New() runtime.Object {
	return &dashv0.Dashboard{}
}

func (r *dashboardREST) Destroy() {
}

func (r *dashboardREST) ConnectMethods() []string {
	return []string{"GET"}
}

func (r *dashboardREST) NewConnectOptions() (runtime.Object, bool, string) {
	return nil, false, ""
}

func (r *dashboardREST) ProducesMIMETypes(verb string) []string {
	return nil
}

func (r *dashboardREST) ProducesObject(verb string) interface{} {
	return r.New()
}

func (r *dashboardREST) Connect(ctx context.Context, name string, opts runtime.Object, responder rest.Responder) (http.Handler, error) {
	ns, err := request.NamespaceInfoFrom(ctx, true)
	if err != nil {
		return nil, err
	}

	// Get the snapshot from unified storage
	obj, err := r.getter.Get(ctx, name, &metav1.GetOptions{})
	if err != nil {
		return nil, err
	}

	snap, ok := obj.(*dashv0.Snapshot)
	if !ok {
		return nil, fmt.Errorf("expected Snapshot, got %T", obj)
	}

	if snap.Namespace != ns.Value {
		return nil, apierrors.NewNotFound(dashv0.SnapshotResourceInfo.GroupResource(), name)
	}

	content := snap.Spec.Dashboard
	blobCtx := ctx
	if snap.Blobs.Dashboard != nil && snap.Blobs.Dashboard.Uid != "" {
		caller, ok := authlib.AuthInfoFrom(ctx)
		if !ok || caller == nil || !authlib.NamespaceMatches(caller.GetNamespace(), ns.Value) {
			// The public GET was already authorized. Anonymous and cross-org callers
			// need a namespace-scoped identity for the delegated blob read.
			blobCtx = authlib.WithAuthInfo(ctx, &identity.StaticRequester{Type: authlib.TypeAnonymous, Namespace: ns.Value})
		}
	}
	if fromBlob, ok, err := readDashboardBlob(blobCtx, r.blobs, snap); err != nil {
		return nil, err
	} else if ok {
		content = fromBlob
	}

	return http.HandlerFunc(func(w http.ResponseWriter, req *http.Request) {
		// TODO... support conversions (not required in v0)
		dash := &dashv0.Dashboard{
			ObjectMeta: metav1.ObjectMeta{
				Namespace: ns.Value,
			},
			Spec: v0alpha1.Unstructured{
				Object: content,
			},
		}
		responder.Object(200, dash)
	}), nil
}
