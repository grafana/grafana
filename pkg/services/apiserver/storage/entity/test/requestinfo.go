package test

import (
	"context"
	"fmt"
	"strings"

	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apimachinery/pkg/watch"
	"k8s.io/apiserver/pkg/endpoints/request"
	"k8s.io/apiserver/pkg/storage"

	"github.com/grafana/grafana/pkg/infra/appcontext"
	"github.com/grafana/grafana/pkg/services/user"
)

var _ storage.Interface = &RequestInfoWrapper{}

type RequestInfoWrapper struct {
	store storage.Interface
	gr    schema.GroupResource
}

func (r *RequestInfoWrapper) setRequestInfo(ctx context.Context, key string) (context.Context, error) {
	pkey, err := convertToParsedKey(key)
	if err != nil {
		return nil, err
	}

	ctx = appcontext.WithUser(ctx, &user.SignedInUser{
		Login:  "admin",
		UserID: 1,
		OrgID:  1,
	})

	return request.WithRequestInfo(ctx, &request.RequestInfo{
		APIGroup:          pkey.Group,
		APIVersion:        "v1",
		Resource:          pkey.Resource,
		Subresource:       "",
		Namespace:         pkey.Namespace,
		Name:              pkey.Name,
		Parts:             strings.Split(key, "/"),
		IsResourceRequest: true,
	}), nil
}

func (r *RequestInfoWrapper) Create(ctx context.Context, key string, obj runtime.Object, out runtime.Object, ttl uint64) error {
	ctx, err := r.setRequestInfo(ctx, key)
	if err != nil {
		return err
	}

	return r.store.Create(ctx, key, obj, out, ttl)
}

func (r *RequestInfoWrapper) Delete(ctx context.Context, key string, out runtime.Object, preconditions *storage.Preconditions, validateDeletion storage.ValidateObjectFunc, cachedExistingObject runtime.Object) error {
	ctx, err := r.setRequestInfo(ctx, key)
	if err != nil {
		return err
	}

	return r.store.Delete(ctx, key, out, preconditions, validateDeletion, cachedExistingObject)
}

func (r *RequestInfoWrapper) Watch(ctx context.Context, key string, opts storage.ListOptions) (watch.Interface, error) {
	ctx, err := r.setRequestInfo(ctx, key)
	if err != nil {
		return nil, err
	}

	return r.store.Watch(ctx, key, opts)
}

func (r *RequestInfoWrapper) Get(ctx context.Context, key string, opts storage.GetOptions, objPtr runtime.Object) error {
	ctx, err := r.setRequestInfo(ctx, key)
	if err != nil {
		return err
	}

	return r.store.Get(ctx, key, opts, objPtr)
}

func (r *RequestInfoWrapper) GetList(ctx context.Context, key string, opts storage.ListOptions, listObj runtime.Object) error {
	ctx, err := r.setRequestInfo(ctx, key)
	if err != nil {
		return err
	}

	return r.store.GetList(ctx, key, opts, listObj)
}

func (r *RequestInfoWrapper) GuaranteedUpdate(ctx context.Context, key string, destination runtime.Object, ignoreNotFound bool, preconditions *storage.Preconditions, tryUpdate storage.UpdateFunc, cachedExistingObject runtime.Object) error {
	ctx, err := r.setRequestInfo(ctx, key)
	if err != nil {
		return err
	}

	return r.store.GuaranteedUpdate(ctx, key, destination, ignoreNotFound, preconditions, tryUpdate, cachedExistingObject)
}

func (r *RequestInfoWrapper) Count(key string) (int64, error) {
	return r.store.Count(key)
}

func (r *RequestInfoWrapper) Versioner() storage.Versioner {
	return r.store.Versioner()
}

func (r *RequestInfoWrapper) RequestWatchProgress(ctx context.Context) error {
	return r.store.RequestWatchProgress(ctx)
}

type Key struct {
	Group     string
	Resource  string
	Namespace string
	Name      string
}

func convertToParsedKey(key string) (*Key, error) {
	// NOTE: the following supports the watcher tests that run against v1/pods
	// Other than that, there are ambiguities in the key format that only field selector
	// when set to use metadata.name can be used to bring clarity in the 3-segment case

	// Cases handled below:
	// namespace scoped:
	// /<resource>/[<namespace>]/[<name>]
	// /<resource>/[<namespace>]
	//
	// cluster scoped:
	// /<resource>/[<name>]
	// /<resource>
	k := &Key{}

	if !strings.HasPrefix(key, "/") {
		key = "/" + key
	}

	parts := strings.SplitN(key, "/", 5)
	if len(parts) < 2 {
		return nil, fmt.Errorf("invalid key format: %s", key)
	}

	k.Resource = parts[1]
	if len(parts) < 3 {
		return k, nil
	}

	// figure out whether the key is namespace scoped or cluster scoped
	if isTestNs(parts[2]) {
		k.Namespace = parts[2]
		if len(parts) >= 4 {
			k.Name = parts[3]
		}
	} else {
		k.Name = parts[2]
	}

	return k, nil
}

func isTestNs(part string) bool {
	return strings.HasPrefix(part, "test-ns-") || strings.HasPrefix(part, "ns-") || strings.Index(part, "-ns") > 0
}
