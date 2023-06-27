package admission

import (
	"context"
	"encoding/json"
	"io"

	"github.com/grafana/thema/vmux"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apiserver/pkg/admission"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/registry/corekind"
)

const PluginNameSchemaTranslate = "TranslateSchema"

// Register registers a plugin
func RegisterSchemaTranslate(plugins *admission.Plugins, reg *corekind.Base) {
	plugins.Register(PluginNameSchemaTranslate, func(config io.Reader) (admission.Interface, error) {
		return NewSchemaTranslate(reg), nil
	})
}

type schemaTranslate struct {
	log log.Logger
	*admission.Handler
	reg *corekind.Base
}

var _ admission.MutationInterface = schemaTranslate{}

// Admit makes an admission decision based on the request attributes.
func (st schemaTranslate) Admit(ctx context.Context, a admission.Attributes, o admission.ObjectInterfaces) (err error) {
	obj := a.GetObject()
	ck := st.reg.ByName(obj.GetObjectKind().GroupVersionKind().Kind)
	if ck == nil {
		return nil
	}

	uobj := obj.(*unstructured.Unstructured)
	j, err := json.Marshal(uobj.Object)
	if err != nil {
		st.log.Error("failed to marshal spec to json", "err", err)
		return nil
	}

	switch a.GetOperation() {
	case admission.Create, admission.Update:
		// TODO should we actually translate here? it won't guarantee resources are the current version in general, and we don't necessarily care. Should look at when webhook conversions are called...then be better, b/c those are terrible

		// JSON bytes in, translated JSON bytes out.
		mux := vmux.NewByteMux(ck.Lineage().Latest(), vmux.NewJSONCodec(ck.MachineName()+".json"))
		b, lac, err := mux(j)

		if err != nil {
			// For now, err will only ever be nil, because the validation handler already
			// ensured the validity of the bytes. Once
			// https://github.com/grafana/thema/issues/167 is in, errs will become possible
			// directly from the translate call that happens in the vmuxer. (Currently,
			// those error cases just panic :scream:)
			return err
		}

		if lac != nil {
			// TODO once we add a call that wraps in Go funcs to do lacuna handling, the only lacunas left here should be ones that are expected to make it to the user
			st.log.Info("lacunas encountered during translation", lac)
		}
		uobj.Object = make(map[string]interface{})
		json.Unmarshal(b, uobj.Object)

		return nil
	}
	return nil
}

// NewSchemaTranslate creates an always deny admission handler
func NewSchemaTranslate(reg *corekind.Base) admission.Interface {
	return schemaTranslate{
		Handler: admission.NewHandler(admission.Create, admission.Update, admission.Delete),
		log:     log.New("admission.schema-translate"),
		reg:     reg,
	}
}
