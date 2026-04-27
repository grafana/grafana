package app

import (
	"encoding/json"
	"fmt"

	"k8s.io/apimachinery/pkg/runtime/schema"

	"github.com/grafana/grafana-app-sdk/k8s"
	"github.com/grafana/grafana-app-sdk/simple"
	v1 "github.com/grafana/grafana/apps/playlist/pkg/apis/playlist/v1"
)

var _ simple.Converter = NewExampleConverter()

type ExampleConverter struct{}

func NewExampleConverter() *ExampleConverter {
	return &ExampleConverter{}
}

// Convert converts an object from an arbitrary input version slice of bytes
// to a target version, and returns the JSON bytes of that version.
func (e *ExampleConverter) Convert(obj k8s.RawKind, targetAPIVersion string) ([]byte, error) {
	srcGVK := schema.FromAPIVersionAndKind(obj.APIVersion, obj.Kind)
	dstGVK := schema.FromAPIVersionAndKind(targetAPIVersion, v1.PlaylistKind().Kind())
	if srcGVK.Group != v1.APIGroup {
		// This should never happen, but check just in case
		return nil, fmt.Errorf("wrong group to convert example.grafana.app, got %s", srcGVK.Group)
	}
	if srcGVK.Kind != v1.PlaylistKind().Kind() {
		// This should also never happen, but check just in case
		return nil, fmt.Errorf("wrong kind to convert Example, got %s", srcGVK.Kind)
	}
	if srcGVK == dstGVK {
		// This should never happen, but if it does no conversion is necessary, we can return the input
		return obj.Raw, nil
	}

	// This conversion is dump... since both objects are identical just remove the apiVersion
	out := &v1.Playlist{}
	err := json.Unmarshal(obj.Raw, out)
	if err != nil {
		return nil, fmt.Errorf("unable to unmarshal JSON bytes into Playlist: %w", err)
	}
	out.APIVersion = "" // empty... filled in later
	return json.Marshal(out)
}
