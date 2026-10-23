package rules

import (
	"fmt"
	"unsafe"

	"github.com/grafana/grafana-app-sdk/resource"
	"k8s.io/apimachinery/pkg/conversion"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"

	"github.com/grafana/grafana/apps/alerting/rules/pkg/apis/alerting/v0alpha1"
	"github.com/grafana/grafana/apps/alerting/rules/pkg/apis/alerting/v1beta1"
	"github.com/grafana/grafana/apps/alerting/rules/pkg/app/convert"
)

// AddToScheme also registers v0alpha1 <-> v1beta1 conversions for objects and
// lists, which the SDK's scheme registration doesn't handle correctly:
//   - It registers no conversions for list types.
//   - Its object conversions encode the source in the version its TypeMeta
//     names, and TypeMeta is empty on an object decoded from a request.
//
// The object conversions here replace the SDK's for the same type pairs.
func (a *AppInstaller) AddToScheme(scheme *runtime.Scheme) error {
	if err := a.AppInstaller.AddToScheme(scheme); err != nil {
		return err
	}
	if err := registerObjectConversions(scheme); err != nil {
		return err
	}
	return registerListConversions(scheme)
}

func registerObjectConversions(scheme *runtime.Scheme) error {
	objectConversion := func(in, out any, _ conversion.Scope) error {
		src, ok := in.(resource.Object)
		if !ok {
			return fmt.Errorf("%T is not a resource.Object", in)
		}
		dst, ok := out.(resource.Object)
		if !ok {
			return fmt.Errorf("%T is not a resource.Object", out)
		}
		return convert.Into(src, dst)
	}
	for _, pair := range [][2]any{
		{(*v0alpha1.AlertRule)(nil), (*v1beta1.AlertRule)(nil)},
		{(*v1beta1.AlertRule)(nil), (*v0alpha1.AlertRule)(nil)},
		{(*v0alpha1.RecordingRule)(nil), (*v1beta1.RecordingRule)(nil)},
		{(*v1beta1.RecordingRule)(nil), (*v0alpha1.RecordingRule)(nil)},
		{(*v0alpha1.RuleSequence)(nil), (*v1beta1.RuleSequence)(nil)},
		{(*v1beta1.RuleSequence)(nil), (*v0alpha1.RuleSequence)(nil)},
	} {
		if err := scheme.AddConversionFunc(pair[0], pair[1], objectConversion); err != nil {
			return err
		}
	}
	return nil
}

// The item types of both versions are generated from schemas that differ only
// in field names (RuleSequence's alertingRules is alertRules in v1beta1), so
// they share a memory layout (TestListItemLayoutsMatch). That lets an item be
// reinterpreted the way conversion-gen does for layout-identical types, which
// maps a renamed field by position.
func registerListConversions(scheme *runtime.Scheme) error {
	alertRuleGVK0, alertRuleGVK1 := v0alpha1.AlertRuleKind().GroupVersionKind(), v1beta1.AlertRuleKind().GroupVersionKind()
	recordingRuleGVK0, recordingRuleGVK1 := v0alpha1.RecordingRuleKind().GroupVersionKind(), v1beta1.RecordingRuleKind().GroupVersionKind()
	ruleSequenceGVK0, ruleSequenceGVK1 := v0alpha1.RuleSequenceKind().GroupVersionKind(), v1beta1.RuleSequenceKind().GroupVersionKind()

	pairs := []struct {
		src, dst any
		fn       conversion.ConversionFunc
	}{
		{(*v0alpha1.AlertRuleList)(nil), (*v1beta1.AlertRuleList)(nil), func(in, out any, _ conversion.Scope) error {
			src, dst := in.(*v0alpha1.AlertRuleList), out.(*v1beta1.AlertRuleList)
			src.ListMeta.DeepCopyInto(&dst.ListMeta)
			dst.Items = reinterpretItems[v0alpha1.AlertRule, v1beta1.AlertRule](src.Items, alertRuleGVK1)
			for i := range dst.Items {
				defaultNotificationSettingsType(&dst.Items[i].Spec)
			}
			return nil
		}},
		{(*v1beta1.AlertRuleList)(nil), (*v0alpha1.AlertRuleList)(nil), func(in, out any, _ conversion.Scope) error {
			src, dst := in.(*v1beta1.AlertRuleList), out.(*v0alpha1.AlertRuleList)
			src.ListMeta.DeepCopyInto(&dst.ListMeta)
			dst.Items = reinterpretItems[v1beta1.AlertRule, v0alpha1.AlertRule](src.Items, alertRuleGVK0)
			return nil
		}},
		{(*v0alpha1.RecordingRuleList)(nil), (*v1beta1.RecordingRuleList)(nil), func(in, out any, _ conversion.Scope) error {
			src, dst := in.(*v0alpha1.RecordingRuleList), out.(*v1beta1.RecordingRuleList)
			src.ListMeta.DeepCopyInto(&dst.ListMeta)
			dst.Items = reinterpretItems[v0alpha1.RecordingRule, v1beta1.RecordingRule](src.Items, recordingRuleGVK1)
			return nil
		}},
		{(*v1beta1.RecordingRuleList)(nil), (*v0alpha1.RecordingRuleList)(nil), func(in, out any, _ conversion.Scope) error {
			src, dst := in.(*v1beta1.RecordingRuleList), out.(*v0alpha1.RecordingRuleList)
			src.ListMeta.DeepCopyInto(&dst.ListMeta)
			dst.Items = reinterpretItems[v1beta1.RecordingRule, v0alpha1.RecordingRule](src.Items, recordingRuleGVK0)
			return nil
		}},
		{(*v0alpha1.RuleSequenceList)(nil), (*v1beta1.RuleSequenceList)(nil), func(in, out any, _ conversion.Scope) error {
			src, dst := in.(*v0alpha1.RuleSequenceList), out.(*v1beta1.RuleSequenceList)
			src.ListMeta.DeepCopyInto(&dst.ListMeta)
			dst.Items = reinterpretItems[v0alpha1.RuleSequence, v1beta1.RuleSequence](src.Items, ruleSequenceGVK1)
			return nil
		}},
		{(*v1beta1.RuleSequenceList)(nil), (*v0alpha1.RuleSequenceList)(nil), func(in, out any, _ conversion.Scope) error {
			src, dst := in.(*v1beta1.RuleSequenceList), out.(*v0alpha1.RuleSequenceList)
			src.ListMeta.DeepCopyInto(&dst.ListMeta)
			dst.Items = reinterpretItems[v1beta1.RuleSequence, v0alpha1.RuleSequence](src.Items, ruleSequenceGVK0)
			return nil
		}},
	}
	for _, p := range pairs {
		if err := scheme.AddConversionFunc(p.src, p.dst, p.fn); err != nil {
			return err
		}
	}
	return nil
}

// reinterpretItems copies items into a fresh slice of the target version's type
// and sets each item's TypeMeta to it. Items share their maps and slices with
// the source, as conversion-gen's unsafe conversions do.
func reinterpretItems[In, Out any, PO interface {
	*Out
	SetGroupVersionKind(schema.GroupVersionKind)
}](in []In, gvk schema.GroupVersionKind) []Out {
	out := make([]Out, len(in))
	for i := range in {
		out[i] = *(*Out)(unsafe.Pointer(&in[i])) // #nosec G103 nosemgrep: go.lang.security.audit.unsafe.use-of-unsafe-block
		PO(&out[i]).SetGroupVersionKind(gvk)
	}
	return out
}

// defaultNotificationSettingsType applies v0alpha1's default, SimplifiedRouting,
// which v1beta1 requires to be explicit. The settings are copied rather than
// edited, since they are shared with the v0alpha1 source.
func defaultNotificationSettingsType(spec *v1beta1.AlertRuleSpec) {
	ns := spec.NotificationSettings
	if ns == nil || ns.SimplifiedRouting == nil || ns.SimplifiedRouting.Type != "" {
		return
	}
	routing := *ns.SimplifiedRouting
	routing.Type = v1beta1.AlertRuleNotificationSettingsTypeSimplifiedRouting
	settings := *ns
	settings.SimplifiedRouting = &routing
	spec.NotificationSettings = &settings
}
