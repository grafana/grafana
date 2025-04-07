package readonly

import (
	"context"
	"errors"
	"net/http"

	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metainternalversion "k8s.io/apimachinery/pkg/apis/meta/internalversion"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/watch"
	"k8s.io/apiserver/pkg/registry/rest"
)

var (
	// ErrOperationUnsupported is returned when a read operation is not supported by the underlying storage.
	// If you wish to check for this, call IsOperationUnsupported instead.
	//
	// Some methods may even include the name of the object that caused the error.
	ErrOperationUnsupported = &apierrors.StatusError{
		ErrStatus: metav1.Status{
			Message: "Operation not supported",
			Code:    http.StatusMethodNotAllowed,
			Status:  metav1.StatusFailure,
			Reason:  metav1.StatusReasonMethodNotAllowed,
			Details: &metav1.StatusDetails{
				Causes: []metav1.StatusCause{
					{
						Type:    "OperationNotImplementedByInner",
						Message: "Operation not supported by the wrapped storage",
					},
				},
			},
		},
	}

	_ rest.Storage              = readOnly{}
	_ rest.Scoper               = readOnly{}
	_ rest.SingularNameProvider = readOnly{}
	_ rest.StorageWithReadiness = readOnly{}
	_ rest.Getter               = readOnly{}
	_ rest.Lister               = readOnlyLister{}
	_ rest.TableConvertor       = readOnlyLister{} // due to rest.Lister
	_ rest.Watcher              = readOnly{}
)

// ReadOnly wraps a storage interface and makes all methods read-only.
//
// One write operation is passed through: Destroy. This allows you to not have to have some complex clean up setup.
type readOnly struct {
	inner rest.Storage
}

// ReadOnlyLister is like ReadOnly, but also implements rest.Lister.
type readOnlyLister struct {
	readOnly
	inner rest.Lister
}

func Wrap(store rest.Storage) rest.Storage {
	ro := readOnly{inner: store}
	if l, ok := store.(rest.Lister); ok {
		return readOnlyLister{readOnly: ro, inner: l}
	}
	return ro
}

func (ro readOnly) New() runtime.Object {
	return ro.inner.New()
}

func (ro readOnlyLister) NewList() runtime.Object {
	return ro.inner.NewList()
}

func (ro readOnly) Destroy() {
	ro.inner.Destroy()
}

func (ro readOnly) NamespaceScoped() bool {
	if s, ok := ro.inner.(rest.Scoper); ok {
		return s.NamespaceScoped()
	}
	return false
}

func (ro readOnly) GetSingularName() string {
	if s, ok := ro.inner.(rest.SingularNameProvider); ok {
		return s.GetSingularName()
	}
	return ""
}

// ReadinessCheck does not check for readiness if the inner storage does not implement it.
// In that case, the inner storage is always considered ready.
func (ro readOnly) ReadinessCheck() error {
	if r, ok := ro.inner.(rest.StorageWithReadiness); ok {
		return r.ReadinessCheck()
	}
	return nil
}

func (ro readOnly) Get(ctx context.Context, name string, options *metav1.GetOptions) (runtime.Object, error) {
	if r, ok := ro.inner.(rest.Getter); ok {
		return r.Get(ctx, name, options)
	}

	return nil, ro.unsupported(name)
}

func (ro readOnlyLister) List(ctx context.Context, options *metainternalversion.ListOptions) (runtime.Object, error) {
	return ro.inner.List(ctx, options)
}

func (ro readOnlyLister) ConvertToTable(ctx context.Context, object runtime.Object, tableOptions runtime.Object) (*metav1.Table, error) {
	return ro.inner.ConvertToTable(ctx, object, tableOptions)
}

func (ro readOnly) Watch(ctx context.Context, options *metainternalversion.ListOptions) (watch.Interface, error) {
	if r, ok := ro.inner.(rest.Watcher); ok {
		return r.Watch(ctx, options)
	}

	return nil, ro.unsupported("")
}

func (ro readOnly) unsupported(name string) error {
	obj := ro.New()
	gvk := obj.GetObjectKind().GroupVersionKind()
	err := *ErrOperationUnsupported
	err.ErrStatus.Details.Kind = gvk.Kind
	err.ErrStatus.Details.Group = gvk.Group
	err.ErrStatus.Details.Name = name

	return &err
}

// IsOperationUnsupported checks the error for its reasoning. If it originated from the read-only wrapper, it will return true.
// When this returns true, it indicates the underlying storage does not support the operation despite us "announcing" it (by implementing an interface).
func IsOperationUnsupported(err error) bool {
	var statusErr *apierrors.StatusError
	if !errors.As(err, &statusErr) {
		return false
	}

	if statusErr.Status().Reason != metav1.StatusReasonMethodNotAllowed ||
		statusErr.Status().Details == nil ||
		len(statusErr.Status().Details.Causes) == 0 {
		return false
	}

	for _, detail := range statusErr.Status().Details.Causes {
		if detail.Type == "OperationNotImplementedByInner" {
			return true
		}
	}

	return false
}
