package template

import (
	"fmt"
	"sort"

	data "github.com/grafana/grafana-plugin-sdk-go/experimental/apis/data/v0alpha1"
	"github.com/spyzhov/ajson"
)

// RenderTemplate applies selected values into a query template
func RenderTemplate(qt QueryTemplate, selectedValues map[string][]string) ([]Target, error) {
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
				return nil, fmt.Errorf("failed to find path %v: %w", path, err)
			}
			if len(nodes) != 1 {
				return nil, fmt.Errorf("expected one lead node at path %v but got %v", path, len(nodes))
			}
			n := nodes[0]
			if !n.IsString() {
				return nil, fmt.Errorf("only string type leaf notes supported currently, %v is not a string", path)
			}
			s := []rune(n.String())
			s = s[1 : len(s)-1]
			var offSet int64
			for _, r := range reps {
				value := []rune(FormatVariables(r.format, selectedValues[r.Key]))
				if r.Position == nil {
					return nil, fmt.Errorf("nil position not support yet, will be full replacement")
				}
				s = append(s[:r.Start+offSet], append(value, s[r.End+offSet:]...)...)
				offSet += int64(len(value)) - (r.End - r.Start)
			}
			if err = n.SetString(string(s)); err != nil {
				return nil, err
			}
		}
	}

	for i, aT := range rawTargetObjects {
		raw, err := ajson.Marshal(aT)
		if err != nil {
			return nil, err
		}
		u := data.DataQuery{}
		err = u.UnmarshalJSON(raw)
		if err != nil {
			return nil, err
		}
		targets[i].Properties = u
	}

	return targets, nil
}

type replacement struct {
	*Position
	*TemplateVariable
	format VariableFormat
}

func getReplacementMap(qt QueryTemplate) map[int]map[string][]replacement {
	byTargetPath := make(map[int]map[string][]replacement)

	varMap := make(map[string]*TemplateVariable, len(qt.Variables))
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
						format:           rep.Format,
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
