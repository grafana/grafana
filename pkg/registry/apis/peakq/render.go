package peakq

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"
	"sort"
	"strings"

	v1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apiserver/pkg/registry/rest"

	"github.com/grafana/grafana/pkg/apis/common/v0alpha1"
	peakq "github.com/grafana/grafana/pkg/apis/peakq/v0alpha1"
	"github.com/spyzhov/ajson"
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

type replacement struct {
	*peakq.Position
	*peakq.TemplateVariable
}

func getReplacementMap(qt peakq.QueryTemplateSpec) map[int]map[string][]replacement {
	byTargetPath := make(map[int]map[string][]replacement)

	varMap := make(map[string]*peakq.TemplateVariable, len(qt.Variables))
	for i, v := range qt.Variables {
		varMap[v.Key] = &qt.Variables[i]
	}

	for i, target := range qt.Targets {
		if byTargetPath[i] == nil {
			byTargetPath[i] = make(map[string][]replacement)
		}
		for k, vReps := range target.Variables {
			for rI, rep := range vReps {
				byTargetPath[i][rep.Path] = append(byTargetPath[i][rep.Path],
					replacement{
						Position:         vReps[rI].Position,
						TemplateVariable: varMap[k],
					},
				)
			}
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

func Render(qt peakq.QueryTemplateSpec, selectedValues map[string][]string) (*peakq.RenderedQuery, error) {
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
			nodes, err := o.JSONPath(path)
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
				if r.Position == nil {
					return nil, fmt.Errorf("nil position not support yet, will be full replacement")
				}
				if len(selectedValues[r.Key]) != 1 {
					return nil, fmt.Errorf("selected value missing, or more then one provided")
				}
				value := selectedValues[r.Key][0]
				s = s[:r.Start+offSet] + value + s[r.End+offSet:]
				offSet = int64(len(value)+int(offSet)) - (r.End - r.Start)
			}
			if err = n.SetString(s); err != nil {
				return nil, err
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
