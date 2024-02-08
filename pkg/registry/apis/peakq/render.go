package peakq

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"
	"strings"

	v1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apiserver/pkg/registry/rest"

	peakq "github.com/grafana/grafana/pkg/apis/peakq/v0alpha1"
	"github.com/grafana/grafana/pkg/apis/query/v0alpha1/template"
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
	obj, err := r.getter.Get(ctx, name, &v1.GetOptions{})
	if err != nil {
		return nil, err
	}
	t, ok := obj.(*peakq.QueryTemplate)
	if !ok {
		return nil, fmt.Errorf("expected template")
	}

	return http.HandlerFunc(func(w http.ResponseWriter, req *http.Request) {
		input, err := makeVarMapFromParams(req.URL.Query())
		if err != nil {
			responder.Error(err)
			return
		}
		out, err := template.RenderTemplate(t.Spec, input)
		if err != nil {
			responder.Error(fmt.Errorf("failed to render: %w", err))
			return
		}
		responder.Object(http.StatusOK, &peakq.RenderedQuery{
			Targets: out,
		})
	}), nil
}

func renderPOSTHandler(w http.ResponseWriter, req *http.Request) {
	input, err := makeVarMapFromParams(req.URL.Query())
	if err != nil {
		_, _ = w.Write([]byte("ERROR: " + err.Error()))
		w.WriteHeader(500)
		return
	}

	var qT peakq.QueryTemplate
	err = json.NewDecoder(req.Body).Decode(&qT.Spec)
	if err != nil {
		_, _ = w.Write([]byte("ERROR: " + err.Error()))
		w.WriteHeader(500)
		return
	}
	results, err := template.RenderTemplate(qT.Spec, input)
	if err != nil {
		_, _ = w.Write([]byte("ERROR: " + err.Error()))
		w.WriteHeader(500)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	_ = json.NewEncoder(w).Encode(peakq.RenderedQuery{
		Targets: results,
	})
}

// Replicate the grafana dashboard URL syntax
// &var-abc=1&var=abc=2&var-xyz=3...
func makeVarMapFromParams(v url.Values) (map[string][]string, error) {
	input := make(map[string][]string, len(v))
	for key, vals := range v {
		if !strings.HasPrefix(key, "var-") {
			continue
		}
		input[key[4:]] = vals
	}
	return input, nil
}
