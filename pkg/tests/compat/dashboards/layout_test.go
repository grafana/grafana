package dashboards

import (
	"encoding/json"
	"fmt"
	"maps"
	"slices"
)

// A projection checks every listed field, including empty objects and arrays. Maps
// may have additional fields, while array order and membership are part of the fixture.
func checkWireProjection(want, got any, path string) error {
	switch w := want.(type) {
	case map[string]any:
		g, ok := got.(map[string]any)
		if !ok || g == nil {
			return fmt.Errorf("%s: expected an object, got %v", path, got)
		}
		for _, key := range slices.Sorted(maps.Keys(w)) {
			if err := checkWireProjection(w[key], g[key], path+"."+key); err != nil {
				return err
			}
		}
	case []any:
		g, ok := got.([]any)
		if !ok || g == nil || len(w) != len(g) {
			return fmt.Errorf("%s: expected an array of %d items, got %v", path, len(w), got)
		}
		for i := range w {
			if err := checkWireProjection(w[i], g[i], fmt.Sprintf("%s[%d]", path, i)); err != nil {
				return err
			}
		}
	default:
		// The client may represent the same wire integer as an int64 or float64.
		wJSON, err := json.Marshal(want)
		if err != nil {
			return err
		}
		gJSON, err := json.Marshal(got)
		if err != nil {
			return err
		}
		if string(wJSON) != string(gJSON) {
			return fmt.Errorf("%s: expected %s, got %s", path, wJSON, gJSON)
		}
	}
	return nil
}
