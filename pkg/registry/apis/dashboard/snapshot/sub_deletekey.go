package snapshot

import (
	"context"
	"fmt"
	"net/http"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apiserver/pkg/registry/rest"

	dashv0 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v0alpha1"
)

// deleteKeyREST exposes the plaintext deleteKey via a dedicated subresource
// endpoint: GET /snapshots/{name}/deletekey
// It reads from the unwrapped inner storage which retains the deleteKey in the spec,
// unlike the public-facing storage wrapper which strips it on GET/LIST.
type deleteKeyREST struct {
	getter rest.Getter
}

// NewDeleteKeyREST creates a new subresource handler for the deleteKey endpoint.
func NewDeleteKeyREST(getter rest.Getter) (rest.Storage, error) {
	return &deleteKeyREST{getter: getter}, nil
}

var (
	_ rest.Connecter       = (*deleteKeyREST)(nil)
	_ rest.StorageMetadata = (*deleteKeyREST)(nil)
)

func (r *deleteKeyREST) New() runtime.Object {
	return &dashv0.DashboardSnapshotWithDeleteKey{}
}

func (r *deleteKeyREST) Destroy() {}

func (r *deleteKeyREST) ConnectMethods() []string {
	return []string{"GET"}
}

func (r *deleteKeyREST) NewConnectOptions() (runtime.Object, bool, string) {
	return nil, false, ""
}

func (r *deleteKeyREST) ProducesMIMETypes(verb string) []string {
	return nil
}

func (r *deleteKeyREST) ProducesObject(verb string) interface{} {
	return r.New()
}

func (r *deleteKeyREST) Connect(ctx context.Context, name string, opts runtime.Object, responder rest.Responder) (http.Handler, error) {
	// Read from the inner (unwrapped) storage which retains deleteKey in the spec.
	obj, err := r.getter.Get(ctx, name, &metav1.GetOptions{})
	if err != nil {
		return nil, err
	}

	snap, ok := obj.(*dashv0.Snapshot)
	if !ok {
		return nil, fmt.Errorf("expected Snapshot, got %T", obj)
	}

	deleteKey := ""
	if snap.Spec.DeleteKey != nil {
		deleteKey = *snap.Spec.DeleteKey
	}

	return http.HandlerFunc(func(w http.ResponseWriter, req *http.Request) {
		// Return the snapshot with deleteKey, but strip it from the embedded spec
		result := snap.DeepCopy()
		result.Spec.DeleteKey = nil

		responder.Object(http.StatusOK, &dashv0.DashboardSnapshotWithDeleteKey{
			Snapshot:  *result,
			DeleteKey: deleteKey,
		})
	}), nil
}
