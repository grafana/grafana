package kindstore

import (
	"bytes"
	"context"
	"errors"
	"fmt"
	"io"
	"slices"

	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apiserver/pkg/warning"
	sigsjson "sigs.k8s.io/json"
	"sigs.k8s.io/yaml"
	yamlv2 "sigs.k8s.io/yaml/goyaml.v2"

	appclientv3 "github.com/grafana/grafana-app-sdk/plugin/client/v3"
)

// WriteDecoder prepares unstructured writes before admission and storage.
// Its configuration is immutable; request context and namespace are supplied to Decode.
type WriteDecoder struct {
	target          schema.GroupVersionKind
	convertibleFrom []schema.GroupVersion
	client          appclientv3.ConversionClient
}

// NewWriteDecoder accepts the endpoint's target kind and the source versions
// its caller permits converting. Writes already at the target version need no conversion.
func NewWriteDecoder(target schema.GroupVersionKind, convertibleFrom []schema.GroupVersion, client appclientv3.ConversionClient) *WriteDecoder {
	return &WriteDecoder{target: target, convertibleFrom: slices.Clone(convertibleFrom), client: client}
}

// Decode returns the object in the endpoint's version so admission and field
// management see the same representation that will be saved.
func (d *WriteDecoder) Decode(ctx context.Context, namespace string, raw []byte, mediaType, validation string) (*unstructured.Unstructured, error) {
	obj, err := decodeWrite(ctx, raw, mediaType, validation)
	if err != nil {
		return nil, err
	}
	return d.normalize(ctx, namespace, obj)
}

func (d *WriteDecoder) normalize(ctx context.Context, namespace string, obj *unstructured.Unstructured) (*unstructured.Unstructured, error) {
	// Unstructured accessors silently ignore fields of the wrong type. Validate
	// metadata before those accessors or conversion can hide malformed input.
	if value, found := obj.Object["metadata"]; found {
		metadata, ok := value.(map[string]any)
		if !ok {
			return nil, apierrors.NewBadRequest("metadata must be an object")
		}
		if err := runtime.DefaultUnstructuredConverter.FromUnstructured(metadata, &metav1.ObjectMeta{}); err != nil {
			return nil, apierrors.NewBadRequest("invalid metadata: " + err.Error())
		}
	}
	target := d.target
	for field, fallback := range map[string]string{"apiVersion": target.GroupVersion().String(), "kind": target.Kind} {
		value, found := obj.Object[field]
		if !found {
			obj.Object[field] = fallback
		} else if s, ok := value.(string); !ok || s == "" {
			return nil, apierrors.NewBadRequest(field + " must be a non-empty string")
		}
	}
	if obj.GetKind() != target.Kind {
		return nil, apierrors.NewBadRequest(fmt.Sprintf("expected kind %q, got %q", target.Kind, obj.GetKind()))
	}
	source, err := schema.ParseGroupVersion(obj.GetAPIVersion())
	if err != nil || source.Group != target.Group {
		return nil, apierrors.NewBadRequest(fmt.Sprintf("unsupported apiVersion %q for %s", obj.GetAPIVersion(), target.Kind))
	}
	if source != target.GroupVersion() {
		if !slices.Contains(d.convertibleFrom, source) {
			return nil, apierrors.NewBadRequest(fmt.Sprintf("cannot convert %s from %s to %s", target.Kind, source, target.GroupVersion()))
		}
		// The URL supplies the namespace even when the body omits it. Reject a
		// conflicting namespace before invoking the plugin in that tenant's context.
		objectNamespace, _, err := unstructured.NestedString(obj.Object, "metadata", "namespace")
		if err != nil || (objectNamespace != "" && objectNamespace != namespace) {
			return nil, apierrors.NewBadRequest("metadata.namespace does not match the request namespace")
		}
		obj.SetNamespace(namespace)
		obj, err = convertObject(ctx, d.client, target, obj)
		if err != nil {
			return nil, apierrors.NewInternalError(err)
		}
	}
	return obj, nil
}

func decodeWrite(ctx context.Context, raw []byte, mediaType, validation string) (*unstructured.Unstructured, error) {
	var strictErrors []error
	if mediaType == "application/yaml" {
		// YAMLToJSON reads only the first document; reject trailing input rather
		// than silently dropping part of a write.
		decoder := yamlv2.NewDecoder(bytes.NewReader(raw))
		var document any
		if err := decoder.Decode(&document); err != nil {
			return nil, err
		}
		if err := decoder.Decode(&document); err != io.EOF {
			return nil, fmt.Errorf("request body must contain exactly one YAML document")
		}
		if validation != metav1.FieldValidationIgnore {
			if _, err := yaml.YAMLToJSONStrict(raw); err != nil {
				strictErrors = append(strictErrors, err)
			}
		}
		var err error
		raw, err = yaml.YAMLToJSON(raw)
		if err != nil {
			return nil, err
		}
	}
	var content map[string]any
	if validation == metav1.FieldValidationIgnore {
		if err := sigsjson.UnmarshalCaseSensitivePreserveInts(raw, &content); err != nil {
			return nil, err
		}
	} else {
		duplicates, err := sigsjson.UnmarshalStrict(raw, &content, sigsjson.DisallowDuplicateFields)
		if err != nil {
			return nil, err
		}
		strictErrors = append(strictErrors, duplicates...)
	}
	if content == nil {
		return nil, fmt.Errorf("request body must be an object")
	}
	// Once decoded into a map, duplicate keys are no longer observable by the
	// resource handler. Report them using the request's field validation mode.
	if len(strictErrors) > 0 && validation == metav1.FieldValidationStrict {
		return nil, errors.Join(strictErrors...)
	}
	for _, err := range strictErrors {
		warning.AddWarning(ctx, "", err.Error())
	}
	return &unstructured.Unstructured{Object: content}, nil
}
