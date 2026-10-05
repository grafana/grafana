package kindstore

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"slices"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apimachinery/pkg/util/managedfields"
	"k8s.io/apimachinery/pkg/util/uuid"
	"k8s.io/apiserver/pkg/warning"

	appclientv3 "github.com/grafana/grafana-app-sdk/plugin/client/v3"
	pluginv3 "github.com/grafana/grafana-app-sdk/plugin/genproto/grafana/plugin/v3"
)

type conversionSerializer struct {
	// Target
	gvk schema.GroupVersionKind

	// The callback
	client appclientv3.ConversionClient
}

func (c *conversionSerializer) Encode(ctx context.Context, obj runtime.Object) (json.RawMessage, error) {
	var buf bytes.Buffer
	if err := json.NewEncoder(&buf).Encode(obj); err != nil {
		return nil, err
	}
	return buf.Bytes(), nil
}

func (s *conversionSerializer) Decode(ctx context.Context, data []byte, into runtime.Object) (runtime.Object, error) {
	var ok bool
	var target *unstructured.Unstructured
	if into == nil {
		target = &unstructured.Unstructured{}
	} else {
		if target, ok = into.(*unstructured.Unstructured); !ok {
			return nil, fmt.Errorf("expected *unstructured.Unstructured, found %T", into)
		}
	}

	var original unstructured.Unstructured
	if err := original.UnmarshalJSON(data); err != nil {
		return nil, err
	}

	source := original.GroupVersionKind()
	if source == s.gvk {
		*target = original
		return target, nil
	}

	gvk := &pluginv3.GroupVersionKind{}
	gvk.SetGroup(source.Group)
	gvk.SetVersion(source.Version)
	gvk.SetKind(source.Kind)
	obj := &pluginv3.ConvertObjectsRequest_Object{}
	obj.SetGvk(gvk)
	obj.SetRaw(data)
	api := &pluginv3.GroupVersion{}
	api.SetGroup(s.gvk.Group)
	api.SetVersion(s.gvk.Version)
	req := &pluginv3.ConvertObjectsRequest{}
	req.SetApi(api)
	req.SetUid(string(uuid.NewUUID()))
	req.SetObjects([]*pluginv3.ConvertObjectsRequest_Object{obj})
	req.SetTargetVersion(s.gvk.Version)
	rsp, err := s.client.ConvertObjects(ctx, req)
	if err != nil {
		return nil, fmt.Errorf("conversion to %s failed: %w", s.gvk, err)
	}
	if status := rsp.GetError(); status != nil {
		return nil, fmt.Errorf("conversion to %s failed: %s", s.gvk, status.GetMessage())
	}
	converted := rsp.GetConverted()
	if len(converted) != 1 {
		return nil, fmt.Errorf("conversion to %s returned %d objects, expected 1", s.gvk, len(converted))
	}
	var result unstructured.Unstructured
	if err := result.UnmarshalJSON(converted[0].GetRaw()); err != nil {
		return nil, fmt.Errorf("conversion to %s returned an invalid object: %w", s.gvk, err)
	}
	if got := result.GroupVersionKind(); got != s.gvk {
		return nil, fmt.Errorf("conversion to %s returned unexpected GVK %s", s.gvk, got)
	}

	metadata, found := original.Object["metadata"]
	if metadata != nil {
		if _, ok := metadata.(map[string]any); !ok {
			return nil, fmt.Errorf("invalid stored metadata: expected an object, found %T", metadata)
		}
	}
	fields := convertedManagedFields(&original, &result, s.gvk.GroupVersion().String())

	// List selectors and repository checks use stored metadata before decoding.
	// Only field ownership may change with the converted payload.
	if found {
		result.Object["metadata"] = runtime.DeepCopyJSONValue(metadata)
	} else {
		delete(result.Object, "metadata")
	}
	result.SetManagedFields(fields)
	for _, w := range converted[0].GetWarnings() {
		warning.AddWarning(ctx, "", w)
	}

	// Return the new or "into" object
	*target = result
	return target, nil
}

// Retain only ownership that can be interpreted in the served version. Stale
// paths cannot be translated by merely stamping another GVK, but should not
// prevent reading an otherwise valid converted object.
func convertedManagedFields(original, converted *unstructured.Unstructured, apiVersion string) []metav1.ManagedFieldsEntry {
	stored := readManagedFields(original)
	fields := readManagedFields(converted)
	type owner struct {
		manager     string
		operation   metav1.ManagedFieldsOperationType
		subresource string
	}
	key := func(entry metav1.ManagedFieldsEntry) owner {
		return owner{entry.Manager, entry.Operation, entry.Subresource}
	}
	owners := make(map[owner]metav1.ManagedFieldsEntry, len(stored))
	for _, entry := range stored {
		id := key(entry)
		previous, found := owners[id]
		if !found || (entry.Time != nil && (previous.Time == nil || previous.Time.Before(entry.Time))) {
			owners[id] = entry
		}
	}
	var cleaned []metav1.ManagedFieldsEntry
	seen := make(map[owner]bool, len(fields))
	duplicates := make(map[owner]bool)
	for _, entry := range fields {
		id := key(entry)
		previous, found := owners[id]
		if !found || entry.APIVersion != apiVersion {
			continue
		}
		if seen[id] {
			duplicates[id] = true
			continue
		}
		seen[id] = true
		entry.Time = previous.Time
		cleaned = append(cleaned, entry)
	}
	// Duplicate entries would silently overwrite each other's ownership on apply.
	cleaned = slices.DeleteFunc(cleaned, func(entry metav1.ManagedFieldsEntry) bool { return duplicates[key(entry)] })
	if len(cleaned) == 0 {
		return nil
	}
	return cleaned
}

func readManagedFields(obj *unstructured.Unstructured) []metav1.ManagedFieldsEntry {
	value, _, err := unstructured.NestedFieldNoCopy(obj.Object, "metadata", "managedFields")
	if err != nil {
		return nil
	}
	items, ok := value.([]any)
	if !ok {
		return nil
	}
	var entries []metav1.ManagedFieldsEntry
	for _, item := range items {
		raw, ok := item.(map[string]any)
		if !ok {
			continue
		}
		var entry metav1.ManagedFieldsEntry
		if err := runtime.DefaultUnstructuredConverter.FromUnstructured(raw, &entry); err != nil {
			continue
		}
		if entry.FieldsV1 == nil {
			continue
		}
		if err := managedfields.ValidateManagedFields([]metav1.ManagedFieldsEntry{entry}); err != nil {
			continue
		}
		entries = append(entries, entry)
	}
	return entries
}
