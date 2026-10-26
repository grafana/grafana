// Package keyslister implements the app-sdk's operator.ResourceLister over this repository's keys-only list, so that
// an informer's periodic re-list reads identities — namespace, name and resource version — instead of whole objects.
//
// It is a subpackage so that the keys client itself stays free of the SDK.
package keyslister

import (
	"context"
	"errors"
	"strconv"

	"github.com/grafana/grafana-app-sdk/logging"
	"github.com/grafana/grafana-app-sdk/operator"
	"github.com/grafana/grafana-app-sdk/resource"
	"k8s.io/apimachinery/pkg/runtime/schema"

	keysapi "github.com/grafana/grafana/pkg/services/apiserver/keys"
	"github.com/grafana/grafana/pkg/setting"
)

// ConfigSection and ConfigKey name the ini setting that switches an app's re-list to the keys-only projection. The
// key is the one the provisioning controllers already read, so an operator turns the projection on by one name.
const (
	ConfigSection = "grafana-apiserver"
	ConfigKey     = "keys_only_relist"
)

// Enabled reports whether the keys-only re-list is switched on. With it off a caller supplies no lister and the
// informer re-lists full objects, which is correct but reads every body.
func Enabled(cfg *setting.Cfg) bool {
	return cfg.SectionWithEnvOverrides(ConfigSection).Key(ConfigKey).MustBool(false)
}

// ListerFor builds the keys lister for one resource, so that a caller chooses between the gRPC and the HTTP keys
// client without this package depending on either.
type ListerFor func(schema.GroupVersionResource) keysapi.Lister

// Factory returns a lister factory for simple.BusInformerConfig, serving a re-list from identities where the server
// has them and from a paginated full-object list where it does not.
//
// A keys-only list carries the identity and nothing else, so it cannot be scoped or filtered: a kind the informer
// watches in one namespace, or with selectors, gets the full-object lister.
func Factory(listerFor ListerFor) func(resource.Kind, resource.Client, operator.ClientListerOptions) (operator.ResourceLister, error) {
	return func(kind resource.Kind, client resource.Client, opts operator.ClientListerOptions) (operator.ResourceLister, error) {
		objects, err := operator.NewClientLister(client, kind, opts)
		if err != nil {
			return nil, err
		}
		if opts.ListWatchOptions.Namespace != "" ||
			len(opts.ListWatchOptions.LabelFilters) > 0 ||
			len(opts.ListWatchOptions.FieldSelectors) > 0 {
			return objects, nil
		}
		return New(listerFor(kind.GroupVersionResource()), kind, objects, opts.Recorder), nil
	}
}

// New returns an operator.ResourceLister which reads kind's identities through keys, falling back to objects when the
// server does not serve that projection.
func New(keys keysapi.Lister, kind resource.Kind, objects operator.ResourceLister, recorder operator.RelistRecorder) operator.ResourceLister {
	return &lister{keys: keys, kind: kind, objects: objects, recorder: recorder}
}

type lister struct {
	keys     keysapi.Lister
	kind     resource.Kind
	objects  operator.ResourceLister
	recorder operator.RelistRecorder
}

var _ operator.ResourceLister = (*lister)(nil)

func (l *lister) List(ctx context.Context) ([]resource.Object, string, error) {
	objs, listRV, err := l.listKeys(ctx)
	switch {
	case err == nil:
		l.recorder.Projection(operator.ProjectionIdentities)
		return objs, listRV, nil
	case !errors.Is(err, keysapi.ErrUnsupported):
		return nil, "", err
	}
	// Over gRPC the server predates keys_only, over HTTP the route is absent. The full list is still a correct
	// snapshot, and failing the re-list would stop the informer reconciling altogether.
	logging.FromContext(ctx).Warn("server did not serve a keys-only list, re-listing full objects", "error", err)
	return l.objects.List(ctx)
}

// listKeys drains the keys list into identity objects. The informer diffs the snapshot whole, so an error part-way
// through fails the re-list rather than returning a shorter list, which would diff as a mass deletion.
func (l *lister) listKeys(ctx context.Context) ([]resource.Object, string, error) {
	l.recorder.Request()
	listRV, keys := l.keys.ListKeys(ctx)
	var objs []resource.Object
	for key, err := range keys {
		if err != nil {
			return nil, "", err
		}
		obj := l.kind.ZeroValue()
		obj.SetGroupVersionKind(l.kind.GroupVersionKind())
		obj.SetNamespace(key.Namespace)
		obj.SetName(key.Name)
		obj.SetResourceVersion(key.ResourceVersion)
		objs = append(objs, obj)
	}
	return objs, strconv.FormatInt(listRV, 10), nil
}
