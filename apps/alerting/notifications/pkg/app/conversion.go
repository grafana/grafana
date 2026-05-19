package app

import (
	"encoding/json"
	"fmt"

	"github.com/grafana/grafana-app-sdk/k8s"
)

// identityConverter converts between two versions of a kind with identical schemas.
// It simply replaces the apiVersion field in the raw JSON.
type identityConverter struct{}

func (c *identityConverter) Convert(obj k8s.RawKind, targetAPIVersion string) ([]byte, error) {
	var raw map[string]any
	if err := json.Unmarshal(obj.Raw, &raw); err != nil {
		return nil, fmt.Errorf("failed to unmarshal object for conversion: %w", err)
	}
	raw["apiVersion"] = targetAPIVersion
	converted, err := json.Marshal(raw)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal converted object: %w", err)
	}
	return converted, nil
}
