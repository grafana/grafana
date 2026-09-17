package informer

import (
	"context"
	"encoding/json"
	"fmt"
	"iter"
	"strconv"

	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/client-go/rest"

	"github.com/grafana/grafana/pkg/apimachinery/utils"
)

// listKeysKind is spelled out rather than taken from the response, so a body that
// is not the projection cannot pass by agreeing with itself.
const listKeysKind = "PartialObjectMetadataList"

// httpKeysLister reads keys through the apiserver's list-keys endpoint, for a
// caller with no storage connection of its own.
type httpKeysLister struct {
	client rest.Interface
	gvr    schema.GroupVersionResource
}

// NewHTTPKeysLister returns a KeysLister backed by POST
// {group}/{version}/{resource}/list-keys on the apiserver the client points at.
func NewHTTPKeysLister(client rest.Interface, gvr schema.GroupVersionResource) KeysLister {
	return httpKeysLister{client: client, gvr: gvr}
}

// page posts one request. An absent route answers 404 or 405: the endpoint is
// gated by server config, and a POST to an unmounted path resolves to the object
// handler, so neither status means the request itself was wrong.
func (l httpKeysLister) page(ctx context.Context, token string) (*metav1.PartialObjectMetadataList, error) {
	body, err := json.Marshal(metav1.ListOptions{Limit: keysListerPageLimit, Continue: token})
	if err != nil {
		return nil, err
	}

	raw, err := l.client.Post().
		AbsPath("/apis", l.gvr.Group, l.gvr.Version, l.gvr.Resource, utils.ListKeysPathSegment).
		SetHeader("Content-Type", "application/json").
		Body(body).
		DoRaw(ctx)
	if err != nil {
		if apierrors.IsNotFound(err) || apierrors.IsMethodNotSupported(err) {
			return nil, ErrKeysOnlyUnsupported
		}
		return nil, err
	}

	var list metav1.PartialObjectMetadataList
	if err := json.Unmarshal(raw, &list); err != nil {
		return nil, fmt.Errorf("decode keys page: %w", err)
	}
	if list.Kind != listKeysKind {
		return nil, fmt.Errorf("%w: answered with %q", ErrKeysOnlyUnsupported, list.Kind)
	}
	return &list, nil
}

func (l httpKeysLister) ListKeys(ctx context.Context) (int64, iter.Seq2[Key, error]) {
	fail := func(err error) (int64, iter.Seq2[Key, error]) {
		return 0, func(yield func(Key, error) bool) { yield(Key{}, err) }
	}

	first, err := l.page(ctx, "")
	if err != nil {
		return fail(err)
	}
	// The informer arbitrates the snapshot against this, so a version it cannot
	// read is a failed tick rather than a silent zero.
	listRV, err := strconv.ParseInt(first.ResourceVersion, 10, 64)
	if err != nil {
		return fail(fmt.Errorf("keys list resourceVersion %q: %w", first.ResourceVersion, err))
	}

	return listRV, func(yield func(Key, error) bool) {
		for page := first; ; {
			for _, item := range page.Items {
				if item.Name == "" {
					yield(Key{}, ErrKeysOnlyUnsupported)
					return
				}
				k := Key{
					Namespace:       item.Namespace,
					Name:            item.Name,
					ResourceVersion: item.ResourceVersion,
					Folder:          item.Annotations[utils.AnnoKeyFolder],
				}
				if !yield(k, nil) {
					return
				}
			}
			if page.Continue == "" {
				return
			}
			next, err := l.page(ctx, page.Continue)
			if err != nil {
				yield(Key{}, err)
				return
			}
			page = next
		}
	}
}
