package resources

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"

	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apimachinery/pkg/runtime/serializer/yaml"

	goyaml "go.yaml.in/yaml/v3"

	"github.com/grafana/grafana-app-sdk/logging"
	alertingv0alpha1 "github.com/grafana/grafana/apps/alerting/rules/pkg/apis/alerting/v0alpha1"
	dashboard "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v0alpha1"
	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/apps/provisioning/pkg/repository"
	"github.com/grafana/grafana/pkg/util"
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

	// Strip BOMs from file data before parsing
	cleanData := util.StripBOMFromBytes(info.Data)

	// Try parsing as JSON or YAML
	if len(cleanData) > 0 && cleanData[0] == '{' {
		err := json.Unmarshal(cleanData, &value)
		if err != nil {
			return nil, nil, "", err
		}
	} else {
		err := goyaml.Unmarshal(cleanData, &value)
		if err != nil {
			return nil, nil, "", err
		}
	}
	// Strip BOMs from all string values in the parsed data
	stripped, ok := util.StripBOMFromInterface(value).(map[string]any)
	if !ok {
		return nil, nil, "", fmt.Errorf("unexpected type after BOM stripping")
	}
	value = stripped

	// regular version headers exist
	// TODO: do we intend on this checking Kind or kind? document reasoning.
	if value["apiVersion"] != nil {
		if value["kind"] != nil {
			return nil, nil, "", ErrClassicResourceIsAlreadyK8sForm
		}

		// Handle classic provisioning apiVersion: 1 (e.g. Alerting provisioning)
		var isApiVer1 bool
		if fmt.Sprintf("%v", value["apiVersion"]) == "1" {
			isApiVer1 = true
		}

		if isApiVer1 && (value["groups"] != nil || value["rules"] != nil) {
			var name string
			var ruleSpec map[string]any

			if groups, ok := value["groups"].([]any); ok && len(groups) > 0 {
				if grpMap, ok := groups[0].(map[string]any); ok {
					if n, ok := grpMap["name"].(string); ok && n != "" {
						name = n
					}
					if rules, ok := grpMap["rules"].([]any); ok && len(rules) > 0 {
						if r, ok := rules[0].(map[string]any); ok {
							ruleSpec = r
						}
					}
				}
			}
			if ruleSpec == nil {
				if rules, ok := value["rules"].([]any); ok && len(rules) > 0 {
					if r, ok := rules[0].(map[string]any); ok {
						ruleSpec = r
					}
				}
			}
			if ruleSpec == nil {
				return nil, nil, "", ErrUnableToReadResourceBytes
			}

			kind := "AlertRule"
			if _, ok := ruleSpec["record"]; ok {
				kind = "RecordingRule"
			}

			gvk := &schema.GroupVersionKind{
				Group:   alertingv0alpha1.APIGroup,
				Version: alertingv0alpha1.APIVersion,
				Kind:    kind,
			}

			if uid, ok := ruleSpec["uid"].(string); ok && uid != "" {
				name = uid
			} else if name == "" {
				name = util.GenerateShortUID()
			}

			return &unstructured.Unstructured{
				Object: map[string]any{
					"apiVersion": gvk.GroupVersion().String(),
					"kind":       gvk.Kind,
					"metadata": map[string]any{
						"name": name,
					},
					"spec": ruleSpec,
				},
			}, gvk, provisioning.ClassicAlerting, nil
		}

		logging.FromContext(ctx).Debug("TODO... likely a provisioning",
			"apiVersion", value["apiVersion"],
			"kind", value["Kind"])
		apiVersion, ok := value["apiVersion"].(string)
		if !ok {
			return nil, nil, "", fmt.Errorf("invalid apiVersion: not a string")
		}
		gv, err := schema.ParseGroupVersion(apiVersion)
		if err != nil {
			return nil, nil, "", fmt.Errorf("invalid apiVersion")
		}
		kind, ok := value["Kind"].(string)
		if !ok {
			return nil, nil, "", fmt.Errorf("invalid Kind: not a string")
		}
		gvk := gv.WithKind(kind)
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
			Object: map[string]any{
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

// ParseFileResource parses repository file data into a Kubernetes resource. It first tries the
// standard K8s YAML/JSON decoder, then falls back to classic Grafana formats (e.g. dashboards
// with panels/schemaVersion/tags but no apiVersion/kind).
//
// On success the returned object and GVK are guaranteed to be non-nil.
// Returns a ResourceValidationError when the file does not contain a recognised resource format.
func ParseFileResource(ctx context.Context, info *repository.FileInfo) (*unstructured.Unstructured, *schema.GroupVersionKind, provisioning.ClassicFileType, error) {
	obj, gvk, err := DecodeYAMLObject(bytes.NewReader(info.Data))
	if err == nil && obj != nil && gvk != nil {
		return obj, gvk, "", nil
	}

	logging.FromContext(ctx).Debug("failed to decode as k8s resource, trying classic format", "error", err)
	obj, gvk, classic, classicErr := ReadClassicResource(ctx, info)
	if classicErr == nil && obj != nil && gvk != nil {
		return obj, gvk, classic, nil
	}

	// Neither decoder recognised the file — return a validation error so callers
	// can treat this as a "not a resource" rather than a transient failure.
	if classicErr != nil {
		return nil, nil, "", NewResourceValidationError(fmt.Errorf("file does not contain a valid resource: %w", classicErr))
	}
	return nil, nil, "", NewResourceValidationError(fmt.Errorf("file does not contain a valid resource: %w", err))
}

// DecodeYAMLObject reads the input as YAML and outputs its Kubernetes resource, if it is one.
// Note that all JSON is also valid YAML, so this can also be used for JSON data.
func DecodeYAMLObject(input io.Reader) (*unstructured.Unstructured, *schema.GroupVersionKind, error) {
	data, err := io.ReadAll(input)
	if err != nil {
		return nil, nil, err
	}

	// Strip BOMs before decoding YAML
	data = util.StripBOMFromBytes(data)

	obj, gvk, err := yaml.NewDecodingSerializer(unstructured.UnstructuredJSONScheme).
		Decode(data, nil, nil)
	if err != nil {
		return nil, gvk, err
	}

	// The decoder should put it directly into an unstructured object
	val, ok := obj.(*unstructured.Unstructured)
	if ok {
		// Strip BOMs from all string values in the parsed object
		strippedObj, ok := util.StripBOMFromInterface(val.Object).(map[string]any)
		if !ok {
			return nil, gvk, fmt.Errorf("unexpected type after BOM stripping")
		}
		val.Object = strippedObj
		return val, gvk, err
	}

	unstructuredMap, err := runtime.DefaultUnstructuredConverter.ToUnstructured(obj)
	if err != nil {
		return nil, gvk, err
	}
	// Strip BOMs from all string values in the converted object
	strippedMap, ok := util.StripBOMFromInterface(unstructuredMap).(map[string]any)
	if !ok {
		return nil, gvk, fmt.Errorf("unexpected type after BOM stripping")
	}
	unstructuredMap = strippedMap
	return &unstructured.Unstructured{Object: unstructuredMap}, gvk, err
}
