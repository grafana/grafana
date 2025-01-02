package resources

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"

	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apimachinery/pkg/runtime/serializer/yaml"
	yamlutil "k8s.io/apimachinery/pkg/util/yaml"

	dashboard "github.com/grafana/grafana/pkg/apis/dashboard/v1alpha1"
	provisioning "github.com/grafana/grafana/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/repository"
	"github.com/grafana/grafana/pkg/slogctx"
)

var ErrUnableToReadResourceBytes = errors.New("unable to read bytes as a resource")
var ErrClassicResourceIsAlreadyK8sForm = errors.New("classic resource is already structured with apiVersion and kind")

// This reads a "classic" file format and will convert it to an unstructured k8s resource
// The file path may determine how the resource is parsed
//
// The context and logger are both only used for logging purposes. They do not control any logic.
func ReadClassicResource(ctx context.Context, info *repository.FileInfo) (*unstructured.Unstructured, *schema.GroupVersionKind, provisioning.ClassicFileType, error) {
	var value map[string]any

	// Try parsing as JSON
	if info.Data[0] == '{' {
		err := json.Unmarshal(info.Data, &value)
		if err != nil {
			return nil, nil, "", err
		}
	} else {
		return nil, nil, "", fmt.Errorf("yaml not yet implemented")
	}

	// regular version headers exist
	// TODO: do we intend on this checking Kind or kind? document reasoning.
	if value["apiVersion"] != nil {
		if value["kind"] != nil {
			return nil, nil, "", ErrClassicResourceIsAlreadyK8sForm
		}

		slogctx.From(ctx).DebugContext(ctx, "TODO... likely a provisioning",
			"apiVersion", value["apiVersion"],
			"kind", value["Kind"])
		gv, err := schema.ParseGroupVersion(value["apiVersion"].(string))
		if err != nil {
			return nil, nil, "", fmt.Errorf("invalid apiVersion")
		}
		gvk := gv.WithKind(value["Kind"].(string))
		return &unstructured.Unstructured{Object: value}, &gvk, "", nil
	}

	// If this is a dashboard, convert it
	if value["panels"] != nil &&
		value["schemaVersion"] != nil &&
		value["tags"] != nil {
		gvk := &schema.GroupVersionKind{
			Group:   dashboard.GROUP,
			Version: dashboard.VERSION, // v1
			Kind:    "Dashboard"}
		return &unstructured.Unstructured{
			Object: map[string]interface{}{
				"apiVersion": gvk.GroupVersion().String(),
				"kind":       gvk.Kind,
				"metadata": map[string]any{
					"name": value["uid"],
				},
				"spec": value,
			},
		}, gvk, provisioning.ClassicDashboard, nil
	}

	return nil, nil, "", ErrUnableToReadResourceBytes
}

func LoadYAMLOrJSON(input io.Reader) (*unstructured.Unstructured, *schema.GroupVersionKind, error) {
	decoder := yamlutil.NewYAMLOrJSONDecoder(input, 1024)
	var rawObj runtime.RawExtension
	err := decoder.Decode(&rawObj)
	if err != nil {
		return nil, nil, err
	}

	obj, gvk, err := yaml.NewDecodingSerializer(unstructured.UnstructuredJSONScheme).
		Decode(rawObj.Raw, nil, nil)
	if err != nil {
		return nil, gvk, err
	}

	// The decoder should put it directly into an unstructured object
	val, ok := obj.(*unstructured.Unstructured)
	if ok {
		return val, gvk, err
	}

	unstructuredMap, err := runtime.DefaultUnstructuredConverter.ToUnstructured(obj)
	if err != nil {
		return nil, gvk, err
	}
	return &unstructured.Unstructured{Object: unstructuredMap}, gvk, err
}
