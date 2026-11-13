// Package keyslister adapts this repository's keys-only list to the app-sdk's operator.ResourceKeyLister, so that a
// bus informer's periodic re-list reads identities — namespace, name and resource version — instead of whole objects.
//
// It is a subpackage so that the keys client itself stays free of the SDK.
package keyslister

import (
	"context"
	"errors"
	"fmt"
	"iter"
	"strconv"

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

// Enabled reports whether the keys-only re-list is switched on. With it off a caller supplies no key lister and the
// informer re-lists full objects, which is correct but reads every body.
func Enabled(cfg *setting.Cfg) bool {
	return cfg.SectionWithEnvOverrides(ConfigSection).Key(ConfigKey).MustBool(false)
}

// ListerFor builds the keys lister for one resource, so that a caller chooses between the gRPC and the HTTP keys
// client without this package depending on either.
type ListerFor func(schema.GroupVersionResource) keysapi.Lister

// Factory returns a key lister factory for simple.BusInformerConfig, resolving each kind to its resource.
//
// A keys-only list carries the identity and nothing else, so it can serve neither a namespace nor a selector: a
// scoped or filtered re-list reports the projection unsupported, which leaves it the full-object list rather than
// handing the informer objects the app never asked to watch.
func Factory(listerFor ListerFor) func(resource.Kind, operator.ListWatchOptions) (operator.ResourceKeyLister, error) {
	return func(kind resource.Kind, opts operator.ListWatchOptions) (operator.ResourceKeyLister, error) {
		if opts.Namespace != "" || len(opts.LabelFilters) > 0 || len(opts.FieldSelectors) > 0 {
			return nil, fmt.Errorf("%w: a keys-only list applies no namespace and no filters", operator.ErrProjectionUnsupported)
		}
		return New(listerFor(kind.GroupVersionResource())), nil
	}
}

// New adapts a keys lister to the contract the SDK's identity lister reads.
func New(keys keysapi.Lister) operator.ResourceKeyLister {
	return keyLister{keys: keys}
}

type keyLister struct {
	keys keysapi.Lister
}

var _ operator.ResourceKeyLister = keyLister{}

func (l keyLister) ListKeys(ctx context.Context) (string, iter.Seq2[operator.ResourceKey, error]) {
	listRV, keys := l.keys.ListKeys(ctx)
	return strconv.FormatInt(listRV, 10), func(yield func(operator.ResourceKey, error) bool) {
		for key, err := range keys {
			if err != nil {
				// Over gRPC the server predates keys_only, over HTTP the route is absent. The SDK's fallback lister
				// keys off its own sentinel to re-list full objects rather than fail the whole re-list.
				if errors.Is(err, keysapi.ErrUnsupported) {
					err = fmt.Errorf("%w: %w", operator.ErrProjectionUnsupported, err)
				}
				yield(operator.ResourceKey{}, err)
				return
			}
			if !yield(operator.ResourceKey{
				Namespace:       key.Namespace,
				Name:            key.Name,
				ResourceVersion: key.ResourceVersion,
			}, nil) {
				return
			}
		}
	}
}
