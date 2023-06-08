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

const PluginNameSchemaTranslate = "TranslateSchema"

// Register registers a plugin
func RegisterSchemaTranslate(plugins *admission.Plugins) {
	plugins.Register(PluginNameSchemaTranslate, func(config io.Reader) (admission.Interface, error) {
		return NewSchemaTranslate(), nil
	})
}

type schemaTranslate struct {
	log log.Logger
	*admission.Handler
}

var _ admission.MutationInterface = schemaTranslate{}

// Admit makes an admission decision based on the request attributes.
func (st schemaTranslate) Admit(ctx context.Context, a admission.Attributes, o admission.ObjectInterfaces) (err error) {
	obj := a.GetObject()

	if obj.GetObjectKind().GroupVersionKind().Kind == "Dashboard" {
		uobj := obj.(*unstructured.Unstructured)
		spec, err := json.Marshal(uobj.Object["spec"])
		if err != nil {
			st.log.Error("failed to marshal spec", "err", err)
		}
		dk, err := dashboard.NewKind(cuectx.GrafanaThemaRuntime())
		if err != nil {
			st.log.Info("failed to create dashboard kind", "err", err)
			return nil
		}
		sch, err := dk.Lineage().Schema(thema.LatestVersion(dk.Lineage()))
		if err != nil {
			st.log.Error("failed to get latest schema", "err", err)
			return nil
		}

		switch a.GetOperation() {
		case admission.Create, admission.Update:
			cueVal, _ := vmux.NewJSONCodec("dashboard.json").Decode(cuectx.GrafanaCUEContext(), spec)
			inst, err := sch.Validate(cueVal)
			if err != nil {
				st.log.Info("failed to validate dashboard", "err", err)
			}

			// Translate doesn't return an error, so we just hope it doesn't panic.
			ti, lacunas := inst.Translate(thema.LatestVersion(dk.Lineage()))
			if ti == nil {
				st.log.Info("failed to translate dashboard")
				return nil
			}
			// not clear what to do if there are lacunas, so we just log them.
			if lacunas != nil {
				st.log.Info("failed to translate dashboard", "lacunas", lacunas)
				return nil
			}

			// how do I get from a thema instance back to a spec?
			// for that matter, where do I put the translated spec?
		case admission.Delete:
			return nil
		}
	}
	return nil
}

// NewAddDefaultFields creates an always deny admission handler
func NewSchemaTranslate() admission.Interface {
	return schemaTranslate{
		Handler: admission.NewHandler(admission.Create, admission.Update, admission.Delete),
		log:     log.New("admission.schema-translate"),
	}
}
