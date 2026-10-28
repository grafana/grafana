// Package convert converts AlertRule, RecordingRule and RuleSequence between
// v0alpha1 and v1beta1. The schemas match, except that:
//   - v1beta1 requires spec.notificationSettings.type where v0alpha1 defaults it
//     to SimplifiedRouting.
//   - RuleSequence's spec.alertingRules in v0alpha1 is spec.alertRules in v1beta1.
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

// Raw converts a serialized object of the given kind to targetAPIVersion.
func Raw(raw []byte, kind, targetAPIVersion string) ([]byte, error) {
	dec := json.NewDecoder(bytes.NewReader(raw))
	// Numbers stay as written rather than round-tripping through float64.
	dec.UseNumber()
	var obj map[string]any
	if err := dec.Decode(&obj); err != nil {
		return nil, fmt.Errorf("failed to unmarshal object for conversion: %w", err)
	}
	obj["apiVersion"] = targetAPIVersion
	if kind == "" {
		kind, _ = obj["kind"].(string)
	} else {
		obj["kind"] = kind
	}
	toV1beta1 := targetAPIVersion == v1beta1.GroupVersion.String()
	if toV1beta1 {
		defaultNotificationSettingsType(obj)
	}
	if kind == v1beta1.RuleSequenceKind().Kind() {
		if toV1beta1 {
			renameSpecField(obj, "alertingRules", "alertRules")
		} else {
			renameSpecField(obj, "alertRules", "alertingRules")
		}
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

func renameSpecField(obj map[string]any, from, to string) {
	spec, _ := obj["spec"].(map[string]any)
	v, ok := spec[from]
	if !ok {
		return
	}
	delete(spec, from)
	spec[to] = v
}

// Hub returns obj as T, the v1beta1 type of its kind, converting it if it is
// the v0alpha1 type. The result is obj itself when no conversion is needed.
func Hub[T resource.Object](obj runtime.Object) (T, error) {
	var zero T
	if hub, ok := obj.(T); ok {
		return hub, nil
	}
	src, isResource := obj.(resource.Object)
	hub, ok := counterpart(obj).(T)
	if !ok || !isResource {
		return zero, fmt.Errorf("object is not of type %T", zero)
	}
	if err := Into(src, hub); err != nil {
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

// Into replaces dst with src converted to dst's version. The kind and version
// come from dst's Go type, not from TypeMeta, which decoding can leave empty,
// and dst's TypeMeta is set to them.
func Into(src, dst resource.Object) error {
	reflect.ValueOf(dst).Elem().SetZero()
	raw, err := json.Marshal(src)
	if err != nil {
		return fmt.Errorf("failed to marshal %T for conversion: %w", src, err)
	}
	converted, err := Raw(raw, kindOf(dst), groupVersion(dst).String())
	if err != nil {
		return err
	}
	if err := json.Unmarshal(converted, dst); err != nil {
		return fmt.Errorf("failed to unmarshal %T: %w", dst, err)
	}
	return nil
}

func kindOf(obj resource.Object) string {
	switch obj.(type) {
	case *v0alpha1.AlertRule, *v1beta1.AlertRule:
		return v1beta1.AlertRuleKind().Kind()
	case *v0alpha1.RecordingRule, *v1beta1.RecordingRule:
		return v1beta1.RecordingRuleKind().Kind()
	case *v0alpha1.RuleSequence, *v1beta1.RuleSequence:
		return v1beta1.RuleSequenceKind().Kind()
	}
	return ""
}

func groupVersion(obj resource.Object) schema.GroupVersion {
	switch obj.(type) {
	case *v1beta1.AlertRule, *v1beta1.RecordingRule, *v1beta1.RuleSequence:
		return v1beta1.GroupVersion
	}
	return v0alpha1.GroupVersion
}
