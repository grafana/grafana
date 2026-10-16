// Package convert converts AlertRule, RecordingRule and RuleSequence between
// v0alpha1 and v1beta1. The schemas match, except that v1beta1 requires
// spec.notificationSettings.type where v0alpha1 defaults it to
// SimplifiedRouting.
//
// Admission works on the hub version, v1beta1, but the apiserver does not
// always hand it over in that version, so admission converts with Hub and,
// when it changes the object, back with Like.
package convert

import (
	"bytes"
	"encoding/json"
	"fmt"
	"reflect"

	"github.com/grafana/grafana-app-sdk/resource"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"

	"github.com/grafana/grafana/apps/alerting/rules/pkg/apis/alerting/v0alpha1"
	"github.com/grafana/grafana/apps/alerting/rules/pkg/apis/alerting/v1beta1"
)

// Raw converts a serialized object to targetAPIVersion.
func Raw(raw []byte, targetAPIVersion string) ([]byte, error) {
	dec := json.NewDecoder(bytes.NewReader(raw))
	// Numbers stay as written rather than round-tripping through float64.
	dec.UseNumber()
	var obj map[string]any
	if err := dec.Decode(&obj); err != nil {
		return nil, fmt.Errorf("failed to unmarshal object for conversion: %w", err)
	}
	obj["apiVersion"] = targetAPIVersion
	if targetAPIVersion == v1beta1.GroupVersion.String() {
		defaultNotificationSettingsType(obj)
	}
	converted, err := json.Marshal(obj)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal converted object: %w", err)
	}
	return converted, nil
}

// An empty type is what a v0alpha1 object decoded without one serializes with.
func defaultNotificationSettingsType(obj map[string]any) {
	spec, _ := obj["spec"].(map[string]any)
	settings, _ := spec["notificationSettings"].(map[string]any)
	if settings == nil {
		return
	}
	if t, _ := settings["type"].(string); t == "" {
		settings["type"] = string(v1beta1.AlertRuleNotificationSettingsTypeSimplifiedRouting)
	}
}

// Hub returns obj as T, the v1beta1 type of its kind, converting it if it is
// the v0alpha1 type. The result is obj itself when no conversion is needed.
func Hub[T resource.Object](obj runtime.Object) (T, error) {
	var zero T
	if hub, ok := obj.(T); ok {
		return hub, nil
	}
	from, isResource := obj.(resource.Object)
	hub, ok := counterpart(obj).(T)
	if !ok || !isResource {
		return zero, fmt.Errorf("object is not of type %T", zero)
	}
	if err := Into(from, hub); err != nil {
		return zero, err
	}
	return hub, nil
}

// Like returns hub in the version of like, which is how an object handed to
// admission in one version must be returned.
func Like(hub, like resource.Object) (resource.Object, error) {
	if reflect.TypeOf(hub) == reflect.TypeOf(like) {
		return hub, nil
	}
	out := counterpart(hub)
	if out == nil || reflect.TypeOf(out) != reflect.TypeOf(like) {
		return nil, fmt.Errorf("cannot convert %T to %T", hub, like)
	}
	if err := Into(hub, out); err != nil {
		return nil, err
	}
	return out, nil
}

// counterpart returns an empty object of the other version of obj's kind.
func counterpart(obj runtime.Object) resource.Object {
	switch obj.(type) {
	case *v0alpha1.AlertRule:
		return &v1beta1.AlertRule{}
	case *v1beta1.AlertRule:
		return &v0alpha1.AlertRule{}
	case *v0alpha1.RecordingRule:
		return &v1beta1.RecordingRule{}
	case *v1beta1.RecordingRule:
		return &v0alpha1.RecordingRule{}
	case *v0alpha1.RuleSequence:
		return &v1beta1.RuleSequence{}
	case *v1beta1.RuleSequence:
		return &v0alpha1.RuleSequence{}
	}
	return nil
}

// Into replaces to with from converted to to's version. The version comes from
// the Go types, not from TypeMeta, which decoding can leave empty.
func Into(from, to resource.Object) error {
	reflect.ValueOf(to).Elem().SetZero()
	raw, err := json.Marshal(from)
	if err != nil {
		return fmt.Errorf("failed to marshal %T for conversion: %w", from, err)
	}
	converted, err := Raw(raw, groupVersion(to).String())
	if err != nil {
		return err
	}
	if err := json.Unmarshal(converted, to); err != nil {
		return fmt.Errorf("failed to unmarshal %T: %w", to, err)
	}
	return nil
}

func groupVersion(obj resource.Object) schema.GroupVersion {
	switch obj.(type) {
	case *v1beta1.AlertRule, *v1beta1.RecordingRule, *v1beta1.RuleSequence:
		return v1beta1.GroupVersion
	}
	return v0alpha1.GroupVersion
}
