// Package informerstest serves objects to the informers the supplier builds,
// without an apiserver.
package informerstest

import (
	"context"
	"encoding/json"
	"errors"
	"sync"

	"github.com/grafana/grafana-app-sdk/resource"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"
)

// Clients serves the same Client for every kind.
type Clients struct {
	resource.ClientGenerator
	Client *Client
}

// NewClients serves objs, whatever their type, as untyped objects.
func NewClients(objs ...runtime.Object) *Clients {
	c := &Client{}
	for _, obj := range objs {
		c.objs = append(c.objs, untyped(obj))
	}
	return &Clients{Client: c}
}

func (c *Clients) ClientFor(resource.Kind) (resource.Client, error) {
	return c.Client, nil
}

// Client lists its objects in one page and watches nothing: an informer built on
// it delivers each object on its initial list and on every re-list.
type Client struct {
	resource.Client
	mu    sync.Mutex
	objs  []*resource.UntypedObject
	lists int
}

// Lists is how many LIST requests the client has served.
func (c *Client) Lists() int {
	c.mu.Lock()
	defer c.mu.Unlock()
	return c.lists
}

func (c *Client) List(ctx context.Context, namespace string, opts resource.ListOptions) (resource.ListObject, error) {
	list := &resource.UntypedList{}
	return list, c.ListInto(ctx, namespace, opts, list)
}

func (c *Client) ListInto(_ context.Context, namespace string, _ resource.ListOptions, into resource.ListObject) error {
	c.mu.Lock()
	defer c.mu.Unlock()
	c.lists++
	items := make([]resource.Object, 0, len(c.objs))
	for _, obj := range c.objs {
		if namespace == "" || obj.GetNamespace() == namespace {
			items = append(items, obj.Copy())
		}
	}
	into.SetItems(items)
	return nil
}

// Watch refuses streaming lists, so that client-go falls back to List.
func (c *Client) Watch(_ context.Context, _ string, opts resource.WatchOptions) (resource.WatchResponse, error) {
	if opts.SendInitialEvents != nil && *opts.SendInitialEvents {
		return nil, errors.New("informerstest: streaming lists are not supported")
	}
	return &idleWatch{events: make(chan resource.WatchEvent)}, nil
}

type idleWatch struct {
	once   sync.Once
	events chan resource.WatchEvent
}

func (w *idleWatch) Stop()                                   { w.once.Do(func() { close(w.events) }) }
func (w *idleWatch) WatchEvents() <-chan resource.WatchEvent { return w.events }

func untyped(obj runtime.Object) *resource.UntypedObject {
	// UntypedObject refuses JSON without an apiVersion, which typed objects built
	// in tests seldom set; the placeholder is cleared again after decoding.
	gvk := obj.GetObjectKind().GroupVersionKind()
	if gvk.Empty() {
		obj = obj.DeepCopyObject()
		obj.GetObjectKind().SetGroupVersionKind(schema.GroupVersionKind{Version: "unset", Kind: "Unset"})
	}
	data, err := json.Marshal(obj)
	if err != nil {
		panic(err)
	}
	out := &resource.UntypedObject{}
	if err := json.Unmarshal(data, out); err != nil {
		panic(err)
	}
	out.SetGroupVersionKind(gvk)
	return out
}
