package admission

import (
	"context"
	"encoding/json"
	"io"

	"github.com/grafana/thema"
	"github.com/grafana/thema/vmux"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apiserver/pkg/admission"

	"github.com/grafana/grafana/pkg/cuectx"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/kinds/dashboard"
)

const PluginNameSchemaValidate = "SchemaValidate"

// Register registers a plugin
func RegisterSchemaValidate(plugins *admission.Plugins) {
	plugins.Register(PluginNameSchemaValidate, func(config io.Reader) (admission.Interface, error) {
		return NewSchemaValidate(), nil
	})
}

type schemaValidate struct {
	log log.Logger
}

var _ admission.ValidationInterface = schemaValidate{}

// Validate makes an admission decision based on the request attributes.  It is NOT allowed to mutate.
func (sv schemaValidate) Validate(ctx context.Context, a admission.Attributes, o admission.ObjectInterfaces) (err error) {
	// pretending only dashboards exist
	obj := a.GetObject()
	uobj := obj.(*unstructured.Unstructured)
	spec, err := json.Marshal(uobj.Object["spec"])
	if err != nil {
		sv.log.Info("failed to marshal spec", "err", err)
		return nil
	}

	// this can be generic, but for now, just do it for dashboards
	if obj.GetObjectKind().GroupVersionKind().Kind == "Dashboard" {
		// should NewKind be a singleton? it seems heavy to run each time
		dk, err := dashboard.NewKind(cuectx.GrafanaThemaRuntime())
		if err != nil {
			sv.log.Info("failed to create dashboard kind", "err", err)
			return nil
		}

		// TODO thema (or codegen, or both) request: rename JSONValueMux to
		// something that's a bit clearer; it's unmarshalling the JSON bytes to
		// a dashboard and validating that against any schema
		_, _, err = dk.JSONValueMux(spec)
		if err != nil {
			sv.log.Error("failed to validate dashboard", "err", err)
			return nil
		}

		// JSONValueMux validates that the dashboard matches *any* schema, so we
		// may need to translate to latest.
		//
		// TODO: None of this feels correct; there should be a dashboard.Kind
		// "validate latest" function, or something like that.
		sch, err := dk.Lineage().Schema(thema.LatestVersion(dk.Lineage()))
		if err != nil {
			sv.log.Error("failed to get latest schema", "err", err)
			return nil
		}
		cueVal, _ := vmux.NewJSONCodec("dashboard.json").Decode(cuectx.GrafanaCUEContext(), spec)
		_, err = sch.Validate(cueVal)
		if err != nil {
			sv.log.Info("failed to validate dashboard", "err", err)
		}

		/*  This chunk needs to move to a mutating webhook
		// Translate doesn't return an error, so we just hope it doesn't panic.
		_, _ = inst.Translate(thema.LatestVersion(dk.Lineage()))
		return nil
		*/
	}
	return nil
}

// Handles returns true if this admission controller can handle the given operation
// where operation can be one of CREATE, UPDATE, DELETE, or CONNECT
func (schemaValidate) Handles(operation admission.Operation) bool {
	return true
}

// NewSchemaValidate creates a NewSchemaValidate admission handler
func NewSchemaValidate() admission.Interface {
	return schemaValidate{
		log: log.New("validate"),
	}
}
