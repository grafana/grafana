package peakq

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"
	"strconv"

	"github.com/spyzhov/ajson"
	v1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apiserver/pkg/registry/rest"

	"github.com/grafana/grafana/pkg/apis/common/v0alpha1"
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
	obj, err := r.getter.Get(ctx, name, &v1.GetOptions{})
	if err != nil {
		return nil, err
	}
	template, ok := obj.(*peakq.QueryTemplate)
	if !ok {
		return nil, fmt.Errorf("expected template")
	}

	return http.HandlerFunc(func(w http.ResponseWriter, req *http.Request) {
		input, err := makeVarMapFromParams(req.URL.Query())
		if err != nil {
			responder.Error(err)
			return
		}
		rq, err := Render(template.Spec, input)
		if err != nil {
			responder.Error(fmt.Errorf("failed to render: %w", err))
			return
		}
		responder.Object(http.StatusOK, rq)
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
	results, err := Render(qT.Spec, input)
	if err != nil {
		_, _ = w.Write([]byte("ERROR: " + err.Error()))
		w.WriteHeader(500)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	_ = json.NewEncoder(w).Encode(results)
}

func makeVarMapFromParams(v url.Values) (map[string]string, error) {
	var input map[string]string
	keys := v["varName"]
	values := v["varValue"]
	if len(keys) > 0 || len(values) > 0 {
		if len(keys) != len(values) {
			return nil, fmt.Errorf("mismatched parameter lengths for varName and varValue")
		}
		input = make(map[string]string, len(keys))
		for i, key := range keys {
			// TODO check for dup keys
			input[key] = values[i]
		}
	}

	for i, k := range keys {
		input[k] = values[i] // ignore second values?
	}
	return input, nil
}

func Render(qt peakq.QueryTemplateSpec, selectedValues map[string]string) (*peakq.RenderedQuery, error) {
	// Note: The following is super stupid, will only work with one var, no sanity checking etc
	// selectedValues is for GET
	targets := qt.DeepCopy().Targets

	rawTargetObjects := make([]*ajson.Node, len(qt.Targets))
	for i, t := range qt.Targets {
		b, err := t.Properties.MarshalJSON()
		if err != nil {
			return nil, err
		}
		rawTargetObjects[i], err = ajson.Unmarshal(b)
		if err != nil {
			return nil, err
		}
	}

	for _, qVar := range qt.Variables {
		value, ok := selectedValues[qVar.Key]
		if !ok {
			continue // or use default?
		}

		for targetIdx, pathMap := range qVar.Positions {
			for path, positions := range pathMap {
				idx, err := strconv.Atoi(targetIdx)
				if err != nil {
					return nil, err
				}
				o := rawTargetObjects[idx]
				nodes, err := o.JSONPath(string(path))
				if err != nil {
					return nil, err
				}
				if len(nodes) != 1 {
					return nil, fmt.Errorf("expected one lead node at path %v but got %v", path, len(nodes))
				}
				n := nodes[0]
				if !n.IsString() {
					return nil, fmt.Errorf("only string type leaf notes supported currently, %v is not a string", path)
				}
				s := n.String()
				s = s[1 : len(s)-1]
				// I think breaks with utf...something...?
				// TODO: Probably simpler to store the non-template parts and insert the values into that, then don't have to track
				// offsets
				var offSet int64
				for _, pos := range positions {
					s = s[:pos.Start+offSet] + value + s[pos.End+offSet:]
					offSet = int64(len(value)) - pos.End - pos.Start
				}
				n.SetString(s)
			}
		}
	}

	for i, aT := range rawTargetObjects {
		raw, err := ajson.Marshal(aT)
		if err != nil {
			return nil, err
		}
		u := v0alpha1.Unstructured{}
		err = u.UnmarshalJSON(raw)
		if err != nil {
			return nil, err
		}
		targets[i].Properties = u
	}

	return &peakq.RenderedQuery{
		Targets: targets,
	}, nil
}
