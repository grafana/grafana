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

	"github.com/grafana/grafana-app-sdk/logging"
	dashboard "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v0alpha1"
	provisioning "github.com/grafana/grafana/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/repository"
)

var (
	ErrUnableToReadResourceBytes        = errors.New("unable to read bytes as a resource")
	ErrUnableToReadPanelsMissing        = errors.New("panels property is required")
	ErrUnableToReadSchemaVersionMissing = errors.New("schemaVersion property is required")
	ErrUnableToReadTagsMissing          = errors.New("tags property is required")
	ErrClassicResourceIsAlreadyK8sForm  = errors.New("classic resource is already structured with apiVersion and kind")
)

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
		return nil, nil, "", fmt.Errorf("unable to read file")
	}

	// regular version headers exist
	// TODO: do we intend on this checking Kind or kind? document reasoning.
	if value["apiVersion"] != nil {
		if value["kind"] != nil {
			return nil, nil, "", ErrClassicResourceIsAlreadyK8sForm
		}

		logging.FromContext(ctx).Debug("TODO... likely a provisioning",
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
			Version: "v0alpha1", // no schema
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

// DecodeYAMLObject reads the input as YAML and outputs its Kubernetes resource, if it is one.
// Note that all JSON is also valid YAML, so this can also be used for JSON data.
func DecodeYAMLObject(input io.Reader) (*unstructured.Unstructured, *schema.GroupVersionKind, error) {
	data, err := io.ReadAll(input)
	if err != nil {
		return nil, nil, err
	}

	obj, gvk, err := yaml.NewDecodingSerializer(unstructured.UnstructuredJSONScheme).
		Decode(data, nil, nil)
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
