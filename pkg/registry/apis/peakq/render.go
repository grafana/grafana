package peakq

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"
	"sort"

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

type replacement struct {
	*peakq.Position
	*peakq.QueryVariable
}

func getReplacementMap(qt peakq.QueryTemplateSpec) map[int]map[string][]replacement {
	// int = targetIdx, string = Path
	byTargetPath := make(map[int]map[string][]replacement)
	for _, qVar := range qt.Variables {
		for _, pos := range qVar.Positions {
			if byTargetPath[pos.TargetIdx] == nil {
				byTargetPath[pos.TargetIdx] = make(map[string][]replacement)
			}
			qVar, pos := qVar, pos
			byTargetPath[pos.TargetIdx][pos.Path] = append(byTargetPath[pos.TargetIdx][pos.Path],
				replacement{
					Position:      &pos,
					QueryVariable: &qVar,
				},
			)
		}
	}
	for idx, byTargetIdx := range byTargetPath {
		for path := range byTargetIdx {
			sort.Slice(byTargetPath[idx][path], func(i, j int) bool {
				return byTargetPath[idx][path][i].Start < byTargetPath[idx][path][j].Start
			})
		}
	}
	return byTargetPath
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

	rm := getReplacementMap(qt)
	for targetIdx, byTargetIdx := range rm {
		for path, reps := range byTargetIdx {
			o := rawTargetObjects[targetIdx]
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
			var offSet int64
			for _, r := range reps {
				// I think breaks with utf...something...?
				// TODO: Probably simpler to store the non-template parts and insert the values into that, then don't have to track
				// offsets
				value := selectedValues[r.Key]
				s = s[:r.Start+offSet] + value + s[r.End+offSet:]
				offSet = int64(len(value)) - r.End - r.Start
			}
			n.SetString(s)
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
