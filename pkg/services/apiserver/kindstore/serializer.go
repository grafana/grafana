package kindstore

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"

	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"
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
			return nil, fmt.Errorf("expected *unstructured.Unstructured, got %T", into)
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
	for _, field := range []string{"name", "namespace", "uid"} {
		before, _, err := unstructured.NestedString(original.Object, "metadata", field)
		if err != nil {
			return nil, err
		}
		after, _, err := unstructured.NestedString(result.Object, "metadata", field)
		if err != nil {
			return nil, err
		}
		if before != after {
			return nil, fmt.Errorf("conversion to %s changed metadata.%s from %q to %q", s.gvk, field, before, after)
		}
	}
	metadata, _, err := unstructured.NestedMap(original.Object, "metadata")
	if err != nil {
		return nil, err
	}
	if metadata == nil {
		metadata = map[string]any{}
	}
	// Like CRD conversion, only labels and annotations may change; restore all
	// other metadata so conversion cannot remove finalizers or alter storage state.
	for _, field := range []string{"labels", "annotations"} {
		value, _, err := unstructured.NestedFieldNoCopy(result.Object, "metadata", field)
		if err != nil {
			return nil, err
		}
		delete(metadata, field)
		if value == nil {
			continue
		}
		if _, _, err := unstructured.NestedStringMap(result.Object, "metadata", field); err != nil {
			return nil, err
		}
		metadata[field] = value
	}
	result.Object["metadata"] = metadata
	for _, w := range converted[0].GetWarnings() {
		warning.AddWarning(ctx, "", w)
	}
	*target = result
	return target, nil
}
