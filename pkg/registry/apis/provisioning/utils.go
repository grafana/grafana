package provisioning

import (
	"encoding/json"
	"fmt"
	"io"

	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apimachinery/pkg/runtime/serializer/yaml"
	yamlutil "k8s.io/apimachinery/pkg/util/yaml"
)

func FallbackResourceLoader(data []byte) (*unstructured.Unstructured, *schema.GroupVersionKind, error) {
	// Try parsing as JSON
	if data[0] == '{' {
		var value map[string]any
		err := json.Unmarshal(data, &value)
		if err != nil {
			return nil, nil, err
		}

		// regular version headers exist
		if value["apiVersion"] != nil && value["Kind"] != nil {
			gv, err := schema.ParseGroupVersion(value["apiVersion"].(string))
			if err != nil {
				return nil, nil, fmt.Errorf("invalid apiVersion")
			}
			gvk := gv.WithKind(value["Kind"].(string))
			return &unstructured.Unstructured{Object: value}, &gvk, nil
		}

		// If this is a dashboard, convert it
		if value["panels"] != nil &&
			value["schemaVersion"] != nil &&
			value["tags"] != nil {
			gvk := &schema.GroupVersionKind{
				Group:   "dashboards.grafana.app",
				Version: "v0alpha1",
				Kind:    "Dashboard"}
			return &unstructured.Unstructured{
				Object: map[string]interface{}{
					"apiVersion": gvk.GroupVersion().String(),
					"metadata": map[string]any{
						"name": value["uid"],
					},
					"spec": value,
				},
			}, gvk, nil
		}
	}

	return nil, nil, fmt.Errorf("unable to convert")
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
