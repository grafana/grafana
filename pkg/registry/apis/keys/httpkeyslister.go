package keys

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

// httpLister reads keys through this package's list-keys route, for a caller with
// no storage connection of its own.
type httpLister struct {
	client rest.Interface
	gvr    schema.GroupVersionResource
	cfg    ListerConfig
}

// NewHTTPKeysLister returns a Lister backed by POST
// {group}/{version}/{resource}/list-keys, the route this package serves.
//
// Authentication comes with the client: a caller derives it from the config its
// clientset already uses, so the same exchanged access token is sent here. The
// cluster-wide read needs that token to be an access policy scoped to every
// namespace; see ListKeysFor.
func NewHTTPLister(client rest.Interface, gvr schema.GroupVersionResource, opts ...ListerOption) Lister {
	return httpLister{client: client, gvr: gvr, cfg: NewListerConfig(opts...)}
}

// page posts one request. An absent route answers 404 or 405: the endpoint is
// gated by server config, and a POST to an unmounted path resolves to the object
// handler, so neither status means the request itself was wrong.
func (l httpLister) page(ctx context.Context, token string) (*metav1.PartialObjectMetadataList, error) {
	body, err := json.Marshal(metav1.ListOptions{Limit: l.cfg.PageSize, Continue: token})
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
			return nil, ErrUnsupported
		}
		return nil, err
	}

	var list metav1.PartialObjectMetadataList
	if err := json.Unmarshal(raw, &list); err != nil {
		return nil, fmt.Errorf("decode keys page: %w", err)
	}
	if list.Kind != listKeysKind {
		return nil, fmt.Errorf("%w: answered with %q", ErrUnsupported, list.Kind)
	}
	return &list, nil
}

func (l httpLister) ListKeys(ctx context.Context) (int64, iter.Seq2[Key, error]) {
	fail := func(err error) (int64, iter.Seq2[Key, error]) {
		return 0, func(yield func(Key, error) bool) { yield(Key{}, err) }
	}

	first, err := l.page(ctx, "")
	if err != nil {
		return fail(err)
	}
	// A caller arbitrates its snapshot against this, so a version it cannot read
	// is a failed list rather than a silent zero.
	listRV, err := strconv.ParseInt(first.ResourceVersion, 10, 64)
	if err != nil {
		return fail(fmt.Errorf("keys list resourceVersion %q: %w", first.ResourceVersion, err))
	}

	return listRV, func(yield func(Key, error) bool) {
		for page, err := range l.pages(ctx, first) {
			if err != nil {
				yield(Key{}, err)
				return
			}
			for _, item := range page.Items {
				if item.Name == "" {
					yield(Key{}, ErrUnsupported)
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
		}
	}
}

// pages yields successive list pages, starting from first, until the continue
// token is empty.
func (l httpLister) pages(ctx context.Context, first *metav1.PartialObjectMetadataList) iter.Seq2[*metav1.PartialObjectMetadataList, error] {
	return func(yield func(*metav1.PartialObjectMetadataList, error) bool) {
		for page := first; ; {
			if !yield(page, nil) {
				return
			}
			if page.Continue == "" {
				return
			}
			next, err := l.page(ctx, page.Continue)
			if err != nil {
				yield(nil, err)
				return
			}
			page = next
		}
	}
}
