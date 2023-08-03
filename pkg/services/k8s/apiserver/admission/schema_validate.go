package admission

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"sort"

	"github.com/grafana/kindsys"
	"github.com/grafana/kindsys/encoding"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apiserver/pkg/admission"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/plugins/pfs/corelist"
	"github.com/grafana/grafana/pkg/registry/corekind"
)

const PluginNameSchemaValidate = "SchemaValidate"

// Register registers a plugin
func RegisterSchemaValidate(plugins *admission.Plugins, reg *corekind.Base) {
	plugins.Register(PluginNameSchemaValidate, func(config io.Reader) (admission.Interface, error) {
		return NewSchemaValidate(reg), nil
	})
}

type schemaValidate struct {
	log log.Logger
	reg *distreg
}

var _ admission.ValidationInterface = schemaValidate{}

// Validate makes an admission decision based on the request attributes.  It is NOT allowed to mutate.
func (sv schemaValidate) Validate(ctx context.Context, a admission.Attributes, o admission.ObjectInterfaces) (err error) {
	obj := a.GetObject()
	sv.log.Info(fmt.Sprintf("validating resource of kind %s", a.GetKind().Kind))
	ck := sv.reg.ByName(obj.GetObjectKind().GroupVersionKind().Kind)
	if ck == nil {
		sv.log.Warn(fmt.Sprintf("no kind registered for %s", obj.GetObjectKind().GroupVersionKind().Kind))
		return nil
	}

	j, err := json.Marshal(obj.(*unstructured.Unstructured))
	if err != nil {
		return fmt.Errorf("failed to marshal unstructured to json: %w", err)
	}

	switch a.GetOperation() { //nolint:exhaustive
	case admission.Create, admission.Update:
		// Add in all composable kinds
		// FIXME re-composing on every admission control call is absurd. This is a plugin management responsibility. Fix after https://github.com/grafana/grafana/pull/71184 lands

		// This logic will accept any known version of the kind, not just the
		// current/latest one that is known to the server. Errors may occur when
		// translating to the current/latest version, but that's not this admission
		// handler's responsibility.
		//
		// TODO vanilla k8s CRDs allow specifying a subset of that kind's versions as acceptable on that server. Do we want to do that?
		// TODO this triggers all translation/migrations and throws away the result, which is wasteful. If this ends up being how we want to do this, add a helper or a narrower method in kindsys
		if err := ck.Validate(j, &encoding.KubernetesJSONDecoder{}); err != nil {
			return err
		}
	}
	return nil
}

// Handles returns true if this admission controller can handle the given operation
// where operation can be one of CREATE, UPDATE, DELETE, or CONNECT
func (schemaValidate) Handles(operation admission.Operation) bool {
	switch operation {
	case admission.Create, admission.Update:
		return true
	}
	return false
}

// NewSchemaValidate creates a NewSchemaValidate admission handler
func NewSchemaValidate(reg *corekind.Base) admission.Interface {
	return schemaValidate{
		log: log.New("admission.schema-validate"),
		reg: buildDistRegistry(reg),
	}
}

type distreg struct {
	all []kindsys.Core
}

// All returns a slice of [kindsys.Core] containing all core Grafana kinds.
//
// The returned slice is sorted lexicographically by kind machine name.
func (b *distreg) All() []kindsys.Core {
	ret := make([]kindsys.Core, len(b.all))
	copy(ret, b.all)
	return ret
}

// ByName looks up a kind in the registry by name. If no kind exists for the
// given name, nil is returned.
func (b *distreg) ByName(name string) kindsys.Core {
	i := sort.Search(len(b.all), func(i int) bool {
		return b.all[i].Name() >= name
	})

	if b.all[i].Name() == name {
		return b.all[i]
	}
	return nil
}

func buildDistRegistry(reg *corekind.Base) *distreg {
	dr := &distreg{
		all: make([]kindsys.Core, 0, len(reg.All())),
	}

	coreplugins := corelist.New(nil)
	for _, corek := range reg.All() {
		for _, slot := range corek.Props().(kindsys.CoreProperties).Slots {
			var toCompose []kindsys.Composable
			for _, pp := range coreplugins {
				for _, compok := range pp.ComposableKinds {
					if compok.Implements().Name() == slot.SchemaInterface {
						toCompose = append(toCompose, compok)
					}
				}
			}
			var err error
			corek, err = corek.Compose(slot, toCompose...)
			if err != nil {
				// should be unreachable, panic for now, err once this is separated out
				panic(err)
			}
		}
		dr.all = append(dr.all, corek)
	}

	return dr
}
