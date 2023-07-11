package admission

import (
	"context"
	"encoding/json"
	"fmt"
	"io"

	"github.com/grafana/kindsys/encoding"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apiserver/pkg/admission"

	"github.com/grafana/grafana/pkg/infra/log"
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
	reg *corekind.Base
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
		reg: reg,
	}
}
