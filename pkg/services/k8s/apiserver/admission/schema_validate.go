package admission

import (
	"context"
	"encoding/json"
	"fmt"
	"io"

	"cuelang.org/go/cue"
	"github.com/grafana/grafana/pkg/registry/corekind"
	"github.com/grafana/thema/vmux"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apiserver/pkg/admission"

	"github.com/grafana/grafana/pkg/cuectx"
	"github.com/grafana/grafana/pkg/infra/log"
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
	reg *corekind.Base
}

var _ admission.ValidationInterface = schemaValidate{}

// Validate makes an admission decision based on the request attributes.  It is NOT allowed to mutate.
func (sv schemaValidate) Validate(ctx context.Context, a admission.Attributes, o admission.ObjectInterfaces) (err error) {
	obj := a.GetObject()
	sv.log.Info(fmt.Sprintf("validating resource of kind %s", a.GetKind().Kind))
	ck := sv.reg.ByName(obj.GetObjectKind().GroupVersionKind().Kind)
	if ck == nil {
		sv.log.Info(fmt.Sprintf("did not match %s", obj.GetObjectKind().GroupVersionKind().Kind))
		return nil
	}
	cv, err := unstructuredToCUE(ck.MachineName()+".json", obj.(*unstructured.Unstructured))
	if err != nil {
		// TODO wrap error as k8s expects
		return err
	}

	switch a.GetOperation() { //nolint:exhaustive
	case admission.Create, admission.Update:
		// This logic will accept any known version of the kind, not just the
		// current/latest one that is known to the server. Errors may occur when
		// translating to the current/latest version, but that's not this admission
		// handler's responsibility.
		//
		// TODO vanilla k8s CRDs allow specifying a subset of that kind's versions as acceptable on that server. Do we want to do that?
		if ck.Lineage().ValidateAny(cv) != nil {
			// TODO stop duplicating work once the ValidateAny error return is added https://github.com/grafana/thema/issues/156
			_, err := ck.Lineage().Latest().Validate(cv)
			// TODO wrap error as k8s expects
			return err
		}
	}
	return nil
}

// Handles returns true if this admission controller can handle the given operation
// where operation can be one of CREATE, UPDATE, DELETE, or CONNECT
func (schemaValidate) Handles(operation admission.Operation) bool {
	switch operation {
	case admission.Connect, admission.Delete:
		return false
	default:
		return true
	}
}

// NewSchemaValidate creates a NewSchemaValidate admission handler
func NewSchemaValidate(reg *corekind.Base) admission.Interface {
	return schemaValidate{
		log: log.New("admission.schema-validate"),
		reg: reg,
	}
}

// unstructuredToCUE converts an [*unstructured.Unstructured] to a [cue.Value]
// by first converting it to JSON, then decoding that JSON into CUE.
//
// TODO if this is more widely useful, put it somewhere else
func unstructuredToCUE(path string, u *unstructured.Unstructured) (cue.Value, error) {
	j, err := json.Marshal(u.Object)
	if err != nil {
		return cue.Value{}, fmt.Errorf("failed to marshal unstructured to json: %w", err)
	}

	return vmux.NewJSONCodec(path).Decode(cuectx.GrafanaCUEContext(), j)
}
