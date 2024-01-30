package peakq

import (
	"context"
	"fmt"
	"net/http"

	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apiserver/pkg/registry/rest"

	peakq "github.com/grafana/grafana/pkg/apis/peakq/v0alpha1"
)

type renderREST struct {
	getter rest.Getter
}

var _ = rest.Connecter(&renderREST{})

func (r *renderREST) New() runtime.Object {
	return &peakq.RenderedQuery{}
}

func (r *renderREST) Destroy() {
}

func (r *renderREST) ConnectMethods() []string {
	return []string{"GET"}
}

func (r *renderREST) NewConnectOptions() (runtime.Object, bool, string) {
	return nil, false, "" // true means you can use the trailing path as a variable
}

func (r *renderREST) Connect(ctx context.Context, name string, opts runtime.Object, responder rest.Responder) (http.Handler, error) {
	obj, err := r.getter.Get(ctx, name, nil)
	if err != nil {
		return nil, err
	}
	template, ok := obj.(*peakq.QueryTemplate)
	if !ok {
		return nil, fmt.Errorf("expected template")
	}

	return http.HandlerFunc(func(w http.ResponseWriter, req *http.Request) {
		input := map[string]string{}
		for key, vals := range req.URL.Query() {
			if len(vals) > 0 {
				input[key] = vals[0] // ignore second values?
			}
		}

		rq, err := Render(template.Spec, nil)
		if err != nil {
			responder.Error(fmt.Errorf("failed to render: %w", err))
			return
		}
		responder.Object(http.StatusOK, rq)
	}), nil
}

func Render(qt peakq.QueryTemplateSpec, selectedValues map[string]string) (*peakq.RenderedQuery, error) {
	// Note: The following is super stupid, will only work with one var, no sanity checking etc
	// selectedValues is for GET
	targets := qt.DeepCopy().Targets
	for _, qVar := range qt.Variables {
		value, ok := selectedValues[qVar.Key]
		if !ok {
			continue // or use default?
		}

		var offSet int64
		for _, pos := range qVar.Positions {
			// TODO: track offset after replacement
			s, f, err := unstructured.NestedString(targets[pos.TargetIdx].Properties.Object, pos.TargetKey)
			if err != nil {
				return nil, err
			}
			if !f {
				return nil, fmt.Errorf("property %q not found targetIdx %v", pos.TargetKey, pos.TargetIdx)
			}

			// I think breaks with utf...something...?
			s = s[:pos.Start+offSet] + value + s[pos.End+offSet:]
			offSet = int64(len(value)) - pos.End - pos.Start

			err = unstructured.SetNestedField(targets[pos.TargetIdx].Properties.Object, s, pos.TargetKey)
			if err != nil {
				return nil, err
			}
		}
	}
	return &peakq.RenderedQuery{
		Targets: targets,
	}, nil
}
