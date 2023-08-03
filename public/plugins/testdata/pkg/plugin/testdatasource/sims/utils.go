package sims

import (
	"encoding/json"
	"net/http"

	"github.com/grafana/grafana-plugin-sdk-go/data"
)

// updateConfigObjectFromJSON will use json serialization to update any properties
func updateConfigObjectFromJSON(cfg interface{}, input interface{}) error {
	current, err := asStringMap(cfg)
	if err != nil {
		return err
	}
	next, err := asStringMap(input)
	if err != nil {
		return err
	}

	for k, v := range next {
		if v == nil {
			delete(current, k)
		} else {
			current[k] = v
		}
	}

	b, err := json.Marshal(current)
	if err != nil {
		return err
	}
	return json.Unmarshal(b, cfg)
}

func asStringMap(input interface{}) (map[string]interface{}, error) {
	v, ok := input.(map[string]interface{})
	if ok {
		return v, nil
	}
	v = make(map[string]interface{})
	b, err := json.Marshal(input)
	if err != nil {
		return nil, err
	}
	err = json.Unmarshal(b, &v)
	return v, err
}

func setFrameRow(frame *data.Frame, idx int, values map[string]interface{}) {
	for _, field := range frame.Fields {
		v, ok := values[field.Name]
		if ok {
			field.Set(idx, v)
		}
	}
}

func appendFrameRow(frame *data.Frame, values map[string]interface{}) {
	for _, field := range frame.Fields {
		v, ok := values[field.Name]
		if ok {
			field.Append(v)
		} else {
			field.Extend(1) // fill with nullable value
		}
	}
}

func getBodyFromRequest(req *http.Request) (map[string]interface{}, error) {
	result := make(map[string]interface{}, 10)

	err := json.NewDecoder(req.Body).Decode(&result)
	// TODO? create the map based on form parameters not JSON post
	return result, err
}
