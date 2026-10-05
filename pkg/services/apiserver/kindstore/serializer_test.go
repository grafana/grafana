package kindstore

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"testing"

	"github.com/stretchr/testify/require"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apiserver/pkg/warning"

	"github.com/grafana/grafana-app-sdk/app"
	pluginv3 "github.com/grafana/grafana-app-sdk/plugin/genproto/grafana/plugin/v3"
)

type conversionClientFunc func(context.Context, *pluginv3.ConvertObjectsRequest) (*pluginv3.ConvertObjectsResponse, error)

func (f conversionClientFunc) ConvertObjects(ctx context.Context, req *pluginv3.ConvertObjectsRequest) (*pluginv3.ConvertObjectsResponse, error) {
	return f(ctx, req)
}

func TestConversionSerializer(t *testing.T) {
	gvk := schema.GroupVersionKind{Group: "example-app", Version: "v2", Kind: "TestKind"}
	raw := []byte(`{"apiVersion":"example-app/v1","kind":"TestKind","metadata":{"name":"test","resourceVersion":"123"},"spec":{"old":"value"}}`)
	converted := []byte(`{"apiVersion":"example-app/v2","kind":"TestKind","metadata":{"name":"test","resourceVersion":"123"},"spec":{"new":"value"}}`)
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	recorder := &warningRecorder{}
	ctx = warning.WithWarningRecorder(ctx, recorder)
	calls := 0
	client := conversionClientFunc(func(gotCtx context.Context, req *pluginv3.ConvertObjectsRequest) (*pluginv3.ConvertObjectsResponse, error) {
		calls++
		require.Same(t, ctx, gotCtx)
		require.Equal(t, gvk.Group, req.GetApi().GetGroup())
		require.Equal(t, gvk.Version, req.GetApi().GetVersion())
		require.Equal(t, gvk.Version, req.GetTargetVersion())
		require.NotEmpty(t, req.GetUid())
		require.Len(t, req.GetObjects(), 1)
		obj := req.GetObjects()[0]
		require.Equal(t, "v1", obj.GetGvk().GetVersion())
		require.Equal(t, gvk.Group, obj.GetGvk().GetGroup())
		require.Equal(t, gvk.Kind, obj.GetGvk().GetKind())
		require.Equal(t, raw, obj.GetRaw())
		return pluginv3.ConvertObjectsResponse_builder{Converted: []*pluginv3.ConvertObjectsResponse_Object{
			pluginv3.ConvertObjectsResponse_Object_builder{Raw: converted, Warnings: []string{"deprecated field"}}.Build(),
		}}.Build(), nil
	})
	opts, scoped := newStoreOpts(t, gvk)
	_, err := New(gvk, app.ManifestVersionKind{Kind: gvk.Kind, Plural: "testkinds", Conversion: true}, nil, client, opts, nil)
	require.NoError(t, err)
	require.NotNil(t, scoped.Serializer)
	serializer := scoped.Serializer
	for _, into := range []runtime.Object{nil, &unstructured.Unstructured{}} {
		obj, err := serializer.Decode(ctx, raw, into)
		require.NoError(t, err)
		if into != nil {
			require.Same(t, into, obj)
		}
		require.Equal(t, gvk, obj.GetObjectKind().GroupVersionKind())
		u := obj.(*unstructured.Unstructured)
		require.Equal(t, "test", u.GetName())
		require.Equal(t, "123", u.GetResourceVersion())
		require.Equal(t, map[string]any{"new": "value"}, u.Object["spec"])
		encoded, err := serializer.Encode(ctx, obj)
		require.NoError(t, err)
		require.JSONEq(t, string(converted), string(encoded))
	}
	require.Equal(t, 2, calls)
	require.Equal(t, []string{"deprecated field", "deprecated field"}, recorder.warnings)
	for _, into := range []runtime.Object{nil, &unstructured.Unstructured{Object: map[string]any{"stale": true}}} {
		obj, err := serializer.Decode(ctx, converted, into)
		require.NoError(t, err)
		if into != nil {
			require.Same(t, into, obj)
		}
		encoded, err := serializer.Encode(ctx, obj)
		require.NoError(t, err)
		require.JSONEq(t, string(converted), string(encoded))
	}
	require.Equal(t, 2, calls, "same-version objects do not need conversion")
	_, err = serializer.Decode(ctx, []byte(`{`), nil)
	require.Error(t, err)
	require.Equal(t, 2, calls)

	opts, scoped = newStoreOpts(t, gvk)
	_, err = New(gvk, app.ManifestVersionKind{Kind: gvk.Kind, Plural: "testkinds"}, nil, nil, opts, nil)
	require.NoError(t, err)
	require.Nil(t, scoped.Serializer)
}

func TestConversionSerializerErrors(t *testing.T) {
	failure := errors.New("unavailable")
	status := &pluginv3.StatusResult{}
	status.SetMessage("unsupported version")
	for _, tc := range []struct {
		name     string
		response *pluginv3.ConvertObjectsResponse
		err      error
		want     string
	}{
		{name: "transport", err: failure, want: "unavailable"},
		{name: "plugin", response: pluginv3.ConvertObjectsResponse_builder{Error: status}.Build(), want: "unsupported version"},
		{name: "nil response", want: "returned 0 objects"},
		{name: "empty response", response: &pluginv3.ConvertObjectsResponse{}, want: "returned 0 objects"},
		{name: "extra objects", response: pluginv3.ConvertObjectsResponse_builder{Converted: []*pluginv3.ConvertObjectsResponse_Object{{}, {}}}.Build(), want: "returned 2 objects"},
		{name: "invalid JSON", response: pluginv3.ConvertObjectsResponse_builder{Converted: []*pluginv3.ConvertObjectsResponse_Object{pluginv3.ConvertObjectsResponse_Object_builder{Raw: []byte(`{`)}.Build()}}.Build(), want: "unexpected end"},
	} {
		t.Run(tc.name, func(t *testing.T) {
			gvk := schema.GroupVersionKind{Group: "example-app", Version: "v2", Kind: "TestKind"}
			opts, scoped := newStoreOpts(t, gvk)
			client := conversionClientFunc(func(context.Context, *pluginv3.ConvertObjectsRequest) (*pluginv3.ConvertObjectsResponse, error) {
				return tc.response, tc.err
			})
			_, err := New(gvk, app.ManifestVersionKind{Kind: gvk.Kind, Plural: "testkinds"}, nil, client, opts, nil)
			require.NoError(t, err)
			_, err = scoped.Serializer.Decode(context.Background(), []byte(`{"apiVersion":"example-app/v1","kind":"TestKind"}`), nil)
			require.ErrorContains(t, err, tc.want)
			if tc.err != nil {
				require.ErrorIs(t, err, tc.err)
			}
		})
	}
}

func TestConversionSerializerValidatesResponse(t *testing.T) {
	gvk := schema.GroupVersionKind{Group: "example-app", Version: "v2", Kind: "TestKind"}
	raw := []byte(`{"apiVersion":"example-app/v1","kind":"TestKind","metadata":{"name":"test","namespace":"default","uid":"original"}}`)
	for _, tc := range []struct {
		name  string
		path  []string
		value any
		want  string
	}{
		{name: "wrong group", path: []string{"apiVersion"}, value: "other/v2", want: "unexpected GVK"},
		{name: "wrong version", path: []string{"apiVersion"}, value: "example-app/v1", want: "unexpected GVK"},
		{name: "missing version", path: []string{"apiVersion"}, want: "unexpected GVK"},
		{name: "wrong kind", path: []string{"kind"}, value: "OtherKind", want: "unexpected GVK"},
		{name: "missing kind", path: []string{"kind"}, want: "invalid object"},
	} {
		t.Run(tc.name, func(t *testing.T) {
			var converted unstructured.Unstructured
			require.NoError(t, json.Unmarshal(raw, &converted))
			converted.SetGroupVersionKind(gvk)
			if tc.value == nil {
				unstructured.RemoveNestedField(converted.Object, tc.path...)
			} else {
				require.NoError(t, unstructured.SetNestedField(converted.Object, tc.value, tc.path...))
			}
			payload, err := json.Marshal(&converted)
			require.NoError(t, err)
			serializer := &conversionSerializer{
				gvk: gvk,
				client: conversionClientFunc(func(context.Context, *pluginv3.ConvertObjectsRequest) (*pluginv3.ConvertObjectsResponse, error) {
					return pluginv3.ConvertObjectsResponse_builder{Converted: []*pluginv3.ConvertObjectsResponse_Object{
						pluginv3.ConvertObjectsResponse_Object_builder{Raw: payload}.Build(),
					}}.Build(), nil
				}),
			}
			for _, into := range []runtime.Object{nil, &unstructured.Unstructured{Object: map[string]any{"untouched": true}}} {
				var before runtime.Object
				if into != nil {
					before = into.DeepCopyObject()
				}
				obj, err := serializer.Decode(context.Background(), raw, into)
				require.ErrorContains(t, err, tc.want)
				require.Nil(t, obj)
				require.Equal(t, before, into)
			}
		})
	}
}

func TestConversionSerializerPreservesMetadata(t *testing.T) {
	gvk := schema.GroupVersionKind{Group: "example-app", Version: "v2", Kind: "TestKind"}
	raw := []byte(`{"apiVersion":"example-app/v1","kind":"TestKind","metadata":{"name":"test","namespace":"default","uid":"original","resourceVersion":"123","generation":3,"finalizers":["example-app/cleanup"],"creationTimestamp":"2026-10-01T00:00:00Z","deletionTimestamp":"2026-10-02T00:00:00Z","deletionGracePeriodSeconds":30,"ownerReferences":[{"apiVersion":"example-app/v1","kind":"Owner","name":"parent","uid":"parent-uid"}],"labels":{"old":"label"},"annotations":{"old":"annotation","grafana.app/managedBy":"repo","grafana.app/managerId":"repository","grafana.app/folder":"folder"}},"spec":{"old":"value"}}`)
	for _, mode := range []string{"altered", "removed", "empty", "null", "invalid", "null labels and annotations", "invalid labels and annotations"} {
		t.Run(mode, func(t *testing.T) {
			var original unstructured.Unstructured
			require.NoError(t, json.Unmarshal(raw, &original))
			converted := original.DeepCopy()
			converted.SetGroupVersionKind(gvk)
			metadata := converted.Object["metadata"].(map[string]any)
			switch mode {
			case "altered":
				for key := range metadata {
					metadata[key] = "altered"
				}
				converted.SetLabels(map[string]string{"new": "label"})
				converted.SetAnnotations(map[string]string{"new": "annotation"})
			case "removed":
				delete(converted.Object, "metadata")
			case "empty":
				converted.Object["metadata"] = map[string]any{}
			case "null":
				converted.Object["metadata"] = nil
			case "invalid":
				converted.Object["metadata"] = "invalid"
			case "null labels and annotations":
				metadata["labels"] = nil
				metadata["annotations"] = nil
			case "invalid labels and annotations":
				metadata["labels"] = map[string]any{"label": int64(1)}
				metadata["annotations"] = map[string]any{"annotation": int64(1)}
			}
			converted.Object["spec"] = map[string]any{"new": "value"}
			converted.Object["status"] = map[string]any{"state": "converted"}
			payload, err := json.Marshal(converted)
			require.NoError(t, err)
			serializer := &conversionSerializer{
				gvk: gvk,
				client: conversionClientFunc(func(context.Context, *pluginv3.ConvertObjectsRequest) (*pluginv3.ConvertObjectsResponse, error) {
					return pluginv3.ConvertObjectsResponse_builder{Converted: []*pluginv3.ConvertObjectsResponse_Object{
						pluginv3.ConvertObjectsResponse_Object_builder{Raw: payload}.Build(),
					}}.Build(), nil
				}),
			}
			expected := original.DeepCopy()
			expected.SetGroupVersionKind(gvk)
			expected.Object["spec"] = map[string]any{"new": "value"}
			expected.Object["status"] = map[string]any{"state": "converted"}
			for _, into := range []runtime.Object{nil, &unstructured.Unstructured{Object: map[string]any{"stale": true}}} {
				obj, err := serializer.Decode(context.Background(), raw, into)
				require.NoError(t, err)
				require.Equal(t, expected, obj)
				if into != nil {
					require.Same(t, into, obj)
				}
			}
		})
	}
}

func conversionTestSerializer(t *testing.T, converted *unstructured.Unstructured) *conversionSerializer {
	t.Helper()
	payload, err := converted.MarshalJSON()
	require.NoError(t, err)
	return &conversionSerializer{
		gvk: converted.GroupVersionKind(),
		client: conversionClientFunc(func(context.Context, *pluginv3.ConvertObjectsRequest) (*pluginv3.ConvertObjectsResponse, error) {
			return pluginv3.ConvertObjectsResponse_builder{Converted: []*pluginv3.ConvertObjectsResponse_Object{
				pluginv3.ConvertObjectsResponse_Object_builder{Raw: payload, Warnings: []string{"converted"}}.Build(),
			}}.Build(), nil
		}),
	}
}

func conversionTestObject(t *testing.T) *unstructured.Unstructured {
	t.Helper()
	obj := &unstructured.Unstructured{}
	require.NoError(t, obj.UnmarshalJSON([]byte(`{"apiVersion":"example-app/v1","kind":"TestKind","metadata":{"name":"test","namespace":"default","uid":"original","managedFields":[{"manager":"first","operation":"Apply","apiVersion":"example-app/v1","time":"2026-10-01T00:00:00Z","fieldsType":"FieldsV1","fieldsV1":{"f:spec":{"f:old":{}}}}]},"spec":{"old":"value"}}`)))
	return obj
}

func TestConversionSerializerConvertsManagedFields(t *testing.T) {
	original := conversionTestObject(t)
	stored := original.GetManagedFields()[0]
	for _, duplicateVersion := range []bool{false, true} {
		t.Run(fmt.Sprintf("multiple stored versions=%t", duplicateVersion), func(t *testing.T) {
			input := original.DeepCopy()
			if duplicateVersion {
				first := stored
				first.Operation = metav1.ManagedFieldsOperationUpdate
				second := first
				second.APIVersion = "example-app/v0"
				second.Time = nil
				input.SetManagedFields([]metav1.ManagedFieldsEntry{first, second})
			}
			converted := input.DeepCopy()
			converted.SetAPIVersion("example-app/v2")
			converted.Object["spec"] = map[string]any{"new": "value"}
			entry := input.GetManagedFields()[0]
			entry.APIVersion = converted.GetAPIVersion()
			entry.FieldsV1 = &metav1.FieldsV1{}
			require.NoError(t, entry.FieldsV1.UnmarshalJSON([]byte(`{"f:spec":{"f:new":{}}}`)))
			entry.Time = nil
			converted.SetManagedFields([]metav1.ManagedFieldsEntry{entry})
			converted.SetName("changed")
			raw, err := input.MarshalJSON()
			require.NoError(t, err)
			serializer := conversionTestSerializer(t, converted)
			for _, into := range []runtime.Object{nil, &unstructured.Unstructured{}} {
				result, err := serializer.Decode(t.Context(), raw, into)
				require.NoError(t, err)
				obj := result.(*unstructured.Unstructured)
				require.Equal(t, input.GetName(), obj.GetName())
				require.Equal(t, converted.Object["spec"], obj.Object["spec"])
				fields := obj.GetManagedFields()
				require.Len(t, fields, 1)
				require.Equal(t, "example-app/v2", fields[0].APIVersion)
				require.Equal(t, stored.Time, fields[0].Time)
				require.Equal(t, entry.FieldsV1, fields[0].FieldsV1)
				require.NotContains(t, obj.Object["metadata"], "fieldManager")
				if into != nil {
					require.Same(t, into, obj)
				}
			}
		})
	}
}

func TestConversionSerializerCleansInvalidManagedFields(t *testing.T) {
	for _, tc := range []struct {
		name   string
		mutate func(*unstructured.Unstructured)
	}{
		{"omitted", func(o *unstructured.Unstructured) {
			unstructured.RemoveNestedField(o.Object, "metadata", "managedFields")
		}},
		{"empty", func(o *unstructured.Unstructured) { o.SetManagedFields([]metav1.ManagedFieldsEntry{}) }},
		{"null", func(o *unstructured.Unstructured) { o.Object["metadata"].(map[string]any)["managedFields"] = nil }},
		{"map instead of list", func(o *unstructured.Unstructured) {
			o.Object["metadata"].(map[string]any)["managedFields"] = map[string]any{}
		}},
		{"invalid entry", func(o *unstructured.Unstructured) {
			o.Object["metadata"].(map[string]any)["managedFields"] = []any{"invalid"}
		}},
		{"wrong version", func(o *unstructured.Unstructured) {
			fields := o.GetManagedFields()
			fields[0].APIVersion = "example-app/v1"
			o.SetManagedFields(fields)
		}},
		{"different manager", func(o *unstructured.Unstructured) {
			fields := o.GetManagedFields()
			fields[0].Manager = "other"
			o.SetManagedFields(fields)
		}},
		{"different operation", func(o *unstructured.Unstructured) {
			fields := o.GetManagedFields()
			fields[0].Operation = metav1.ManagedFieldsOperationUpdate
			o.SetManagedFields(fields)
		}},
		{"different subresource", func(o *unstructured.Unstructured) {
			fields := o.GetManagedFields()
			fields[0].Subresource = "status"
			o.SetManagedFields(fields)
		}},
		{"missing field set", func(o *unstructured.Unstructured) {
			fields := o.GetManagedFields()
			fields[0].FieldsV1 = nil
			o.SetManagedFields(fields)
		}},
		{"invalid field set", func(o *unstructured.Unstructured) {
			entry := o.Object["metadata"].(map[string]any)["managedFields"].([]any)[0].(map[string]any)
			entry["fieldsV1"] = map[string]any{"f:spec": "invalid"}
		}},
		{"duplicates", func(o *unstructured.Unstructured) {
			fields := o.GetManagedFields()
			o.SetManagedFields(append(fields, fields[0]))
		}},
	} {
		t.Run(tc.name, func(t *testing.T) {
			original := conversionTestObject(t)
			raw, err := original.MarshalJSON()
			require.NoError(t, err)
			converted := original.DeepCopy()
			converted.SetAPIVersion("example-app/v2")
			fields := converted.GetManagedFields()
			fields[0].APIVersion = converted.GetAPIVersion()
			converted.SetManagedFields(fields)
			tc.mutate(converted)
			serializer := conversionTestSerializer(t, converted)
			for _, into := range []runtime.Object{nil, &unstructured.Unstructured{Object: map[string]any{"untouched": true}}} {
				recorder := &warningRecorder{}
				obj, err := serializer.Decode(warning.WithWarningRecorder(t.Context(), recorder), raw, into)
				require.NoError(t, err)
				result := obj.(*unstructured.Unstructured)
				require.Empty(t, result.GetManagedFields())
				require.NotContains(t, result.Object["metadata"], "managedFields")
				require.Equal(t, original.GetName(), result.GetName())
				require.Equal(t, converted.Object["spec"], result.Object["spec"])
				require.Equal(t, converted.GroupVersionKind(), result.GroupVersionKind())
				if into != nil {
					require.Same(t, into, obj)
				}
				require.Equal(t, []string{"converted"}, recorder.warnings)
			}
		})
	}
}

func TestConversionSerializerDoesNotInventMetadata(t *testing.T) {
	for _, metadata := range []string{"", `,"metadata":{}`, `,"metadata":null`} {
		t.Run(metadata, func(t *testing.T) {
			raw := []byte(`{"apiVersion":"example-app/v1","kind":"TestKind"` + metadata + `}`)
			converted := conversionTestObject(t)
			converted.SetAPIVersion("example-app/v2")
			converted.Object["metadata"].(map[string]any)["fieldManager"] = map[string]any{"manager": "unexpected"}
			obj, err := conversionTestSerializer(t, converted).Decode(t.Context(), raw, nil)
			require.NoError(t, err)
			result := obj.(*unstructured.Unstructured)
			require.Empty(t, result.GetName())
			require.Empty(t, result.GetManagedFields())
			value, _, err := unstructured.NestedFieldNoCopy(result.Object, "metadata", "fieldManager")
			require.NoError(t, err)
			require.Nil(t, value)
		})
	}
}

func TestConversionSerializerPreservesApplyConflicts(t *testing.T) {
	for _, versions := range [][2]string{{"v1", "v2"}, {"v2", "v1"}} {
		t.Run(versions[0]+" to "+versions[1], func(t *testing.T) {
			sourceGVK := schema.GroupVersionKind{Group: "example-app", Version: versions[0], Kind: "TestKind"}
			targetGVK := sourceGVK
			targetGVK.Version = versions[1]
			manager, err := newFieldManager(sourceGVK, nil)
			require.NoError(t, err)
			live := &unstructured.Unstructured{}
			live.SetGroupVersionKind(sourceGVK)
			desired := conversionTestObject(t)
			desired.SetGroupVersionKind(sourceGVK)
			desired.SetManagedFields(nil)
			owned, err := manager.Apply(live, desired, "first", false)
			require.NoError(t, err)
			raw, err := json.Marshal(owned)
			require.NoError(t, err)
			converted := owned.(*unstructured.Unstructured).DeepCopy()
			converted.SetGroupVersionKind(targetGVK)
			converted.Object["spec"] = map[string]any{"new": "value"}
			fields := converted.GetManagedFields()
			require.Len(t, fields, 1)
			fields[0].APIVersion = targetGVK.GroupVersion().String()
			var paths map[string]any
			require.NoError(t, json.Unmarshal(fields[0].FieldsV1.GetRawBytes(), &paths))
			paths["f:spec"] = map[string]any{"f:new": map[string]any{}}
			pathsJSON, err := json.Marshal(paths)
			require.NoError(t, err)
			require.NoError(t, fields[0].FieldsV1.UnmarshalJSON(pathsJSON))
			converted.SetManagedFields(fields)
			decoded, err := conversionTestSerializer(t, converted).Decode(t.Context(), raw, nil)
			require.NoError(t, err)
			targetManager, err := newFieldManager(targetGVK, nil)
			require.NoError(t, err)
			patch := converted.DeepCopy()
			patch.SetManagedFields(nil)
			patch.Object["spec"] = map[string]any{"new": "changed"}
			_, err = targetManager.Apply(decoded.DeepCopyObject(), patch, "second", false)
			require.True(t, apierrors.IsConflict(err), "expected an ownership conflict, got %v", err)
			require.ErrorContains(t, err, ".spec.new")
			_, err = targetManager.Apply(decoded.DeepCopyObject(), patch, "first", false)
			require.NoError(t, err, "the original manager can still edit the converted field")
			_, err = targetManager.Apply(decoded.DeepCopyObject(), patch, "second", true)
			require.NoError(t, err, "force apply explicitly transfers ownership")
		})
	}

}

func TestConversionSerializerPreservesDistinctOwners(t *testing.T) {
	original := conversionTestObject(t)
	first := original.GetManagedFields()[0]
	updater := *first.DeepCopy()
	updater.Operation = metav1.ManagedFieldsOperationUpdate
	status := *updater.DeepCopy()
	status.Subresource = "status"
	require.NoError(t, status.FieldsV1.UnmarshalJSON([]byte(`{"f:status":{"f:state":{}}}`)))
	original.SetManagedFields([]metav1.ManagedFieldsEntry{first, updater, status})
	raw, err := original.MarshalJSON()
	require.NoError(t, err)
	converted := original.DeepCopy()
	converted.SetAPIVersion("example-app/v2")
	fields := converted.GetManagedFields()
	for i := range fields {
		fields[i].APIVersion = converted.GetAPIVersion()
	}
	fields[0], fields[2] = fields[2], fields[0]
	converted.SetManagedFields(fields)
	obj, err := conversionTestSerializer(t, converted).Decode(t.Context(), raw, nil)
	require.NoError(t, err)
	require.Equal(t, fields, obj.(*unstructured.Unstructured).GetManagedFields())

	converted.SetManagedFields(fields[:2])
	obj, err = conversionTestSerializer(t, converted).Decode(t.Context(), raw, nil)
	require.NoError(t, err)
	require.Equal(t, fields[:2], obj.(*unstructured.Unstructured).GetManagedFields())
}

func TestConversionSerializerKeepsValidOwnersDuringCleanup(t *testing.T) {
	for _, corruptStored := range []bool{false, true} {
		t.Run(fmt.Sprintf("invalid stored ownership=%t", corruptStored), func(t *testing.T) {
			original := conversionTestObject(t)
			converted := original.DeepCopy()
			converted.SetAPIVersion("example-app/v2")
			fields := converted.GetManagedFields()
			fields[0].APIVersion = converted.GetAPIVersion()
			converted.SetManagedFields(fields)
			bad := converted
			if corruptStored {
				bad = original
			}
			entries := bad.Object["metadata"].(map[string]any)["managedFields"].([]any)
			bad.Object["metadata"].(map[string]any)["managedFields"] = append(entries, "invalid", map[string]any{"manager": "broken"})
			raw, err := original.MarshalJSON()
			require.NoError(t, err)
			obj, err := conversionTestSerializer(t, converted).Decode(t.Context(), raw, nil)
			require.NoError(t, err)
			require.Equal(t, fields, obj.(*unstructured.Unstructured).GetManagedFields())
		})
	}
}

func TestConversionSerializerClearsMalformedStoredOwnership(t *testing.T) {
	original := conversionTestObject(t)
	converted := original.DeepCopy()
	converted.SetAPIVersion("example-app/v2")
	original.Object["metadata"].(map[string]any)["managedFields"] = "invalid"
	raw, err := original.MarshalJSON()
	require.NoError(t, err)
	obj, err := conversionTestSerializer(t, converted).Decode(t.Context(), raw, nil)
	require.NoError(t, err)
	result := obj.(*unstructured.Unstructured)
	require.NotContains(t, result.Object["metadata"], "managedFields")
	require.Equal(t, original.GetName(), result.GetName())
	require.Equal(t, converted.Object["spec"], result.Object["spec"])
}
