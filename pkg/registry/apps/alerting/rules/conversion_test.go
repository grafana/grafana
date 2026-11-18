package rules

import (
	"fmt"
	"reflect"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"

	"github.com/grafana/grafana/apps/alerting/rules/pkg/apis/alerting/v0alpha1"
	"github.com/grafana/grafana/apps/alerting/rules/pkg/apis/alerting/v1beta1"
)

// renamedFields lists the fields, by path, that v1beta1 renamed. Reinterpreting
// an item maps them by position, which is what conversion must do.
var renamedFields = map[string]string{
	"RuleSequence.Spec.AlertingRules": "AlertRules",
}

// registerListConversions reinterprets items between versions, which is only
// sound while both versions' types are laid out identically.
func TestListItemLayoutsMatch(t *testing.T) {
	for _, pair := range [][2]any{
		{v0alpha1.AlertRule{}, v1beta1.AlertRule{}},
		{v0alpha1.RecordingRule{}, v1beta1.RecordingRule{}},
		{v0alpha1.RuleSequence{}, v1beta1.RuleSequence{}},
	} {
		a, b := reflect.TypeOf(pair[0]), reflect.TypeOf(pair[1])
		t.Run(a.Name(), func(t *testing.T) {
			assert.Empty(t, layoutDiff(a, b, a.Name(), map[[2]reflect.Type]bool{}))
		})
	}
}

func layoutDiff(a, b reflect.Type, path string, seen map[[2]reflect.Type]bool) []string {
	if a == b || seen[[2]reflect.Type{a, b}] {
		return nil
	}
	seen[[2]reflect.Type{a, b}] = true
	if a.Kind() != b.Kind() || a.Size() != b.Size() || a.Align() != b.Align() {
		return []string{fmt.Sprintf("%s: %s (size %d) vs %s (size %d)", path, a, a.Size(), b, b.Size())}
	}
	switch a.Kind() {
	case reflect.Struct:
		if a.NumField() != b.NumField() {
			return []string{fmt.Sprintf("%s: %d fields vs %d", path, a.NumField(), b.NumField())}
		}
		var diffs []string
		for i := range a.NumField() {
			fa, fb := a.Field(i), b.Field(i)
			p := path + "." + fa.Name
			if renamed, ok := renamedFields[p]; ok {
				if fb.Name != renamed || fa.Offset != fb.Offset {
					diffs = append(diffs, fmt.Sprintf("%s: want %s@%d, got %s@%d", p, renamed, fa.Offset, fb.Name, fb.Offset))
					continue
				}
			} else if fa.Name != fb.Name || fa.Offset != fb.Offset || fa.Tag != fb.Tag {
				diffs = append(diffs, fmt.Sprintf("%s: field %s@%d %q vs %s@%d %q", p, fa.Name, fa.Offset, fa.Tag, fb.Name, fb.Offset, fb.Tag))
				continue
			}
			diffs = append(diffs, layoutDiff(fa.Type, fb.Type, p, seen)...)
		}
		return diffs
	case reflect.Pointer, reflect.Slice, reflect.Array:
		return layoutDiff(a.Elem(), b.Elem(), path+"[]", seen)
	case reflect.Map:
		return append(layoutDiff(a.Key(), b.Key(), path+"{key}", seen), layoutDiff(a.Elem(), b.Elem(), path+"{}", seen)...)
	default:
		// Scalars and interfaces are fully described by kind, size and alignment.
		return nil
	}
}

func newConversionScheme(t *testing.T) *runtime.Scheme {
	t.Helper()
	scheme := runtime.NewScheme()
	scheme.AddKnownTypes(v0alpha1.GroupVersion, &v0alpha1.AlertRuleList{}, &v0alpha1.RecordingRuleList{}, &v0alpha1.RuleSequenceList{})
	scheme.AddKnownTypes(v1beta1.GroupVersion, &v1beta1.AlertRuleList{}, &v1beta1.RecordingRuleList{}, &v1beta1.RuleSequenceList{})
	require.NoError(t, registerListConversions(scheme))
	return scheme
}

func TestRegisterListConversions(t *testing.T) {
	scheme := newConversionScheme(t)

	t.Run("v0alpha1 to v1beta1 defaults the notification settings type", func(t *testing.T) {
		in := &v0alpha1.AlertRuleList{
			ListMeta: metav1.ListMeta{ResourceVersion: "7"},
			Items: []v0alpha1.AlertRule{{
				ObjectMeta: metav1.ObjectMeta{Name: "a"},
				Spec: v0alpha1.AlertRuleSpec{
					Title:                "a",
					NotificationSettings: &v0alpha1.AlertRuleNotificationSettings{SimplifiedRouting: &v0alpha1.AlertRuleSimplifiedRouting{Receiver: "r"}},
				},
			}},
		}
		out, err := scheme.ConvertToVersion(in, v1beta1.GroupVersion)
		require.NoError(t, err)
		list, ok := out.(*v1beta1.AlertRuleList)
		require.True(t, ok)
		assert.Equal(t, "7", list.ResourceVersion)
		require.Len(t, list.Items, 1)
		item := list.Items[0]
		assert.Equal(t, v1beta1.GroupVersion.String(), item.APIVersion)
		assert.Equal(t, "AlertRule", item.Kind)
		assert.Equal(t, "a", item.Spec.Title)
		assert.Equal(t, v1beta1.AlertRuleNotificationSettingsTypeSimplifiedRouting, item.Spec.NotificationSettings.SimplifiedRouting.Type)
		assert.Equal(t, "r", item.Spec.NotificationSettings.SimplifiedRouting.Receiver)
		assert.Empty(t, in.Items[0].Spec.NotificationSettings.SimplifiedRouting.Type, "the source is not modified")
	})

	t.Run("v1beta1 to v0alpha1 keeps spec and status", func(t *testing.T) {
		health := v1beta1.AlertRuleAlertRuleHealthOK
		in := &v1beta1.AlertRuleList{Items: []v1beta1.AlertRule{{
			ObjectMeta: metav1.ObjectMeta{Name: "a"},
			Spec: v1beta1.AlertRuleSpec{
				Title:                "a",
				NotificationSettings: &v1beta1.AlertRuleNotificationSettings{NamedRoutingTree: &v1beta1.AlertRuleNamedRoutingTree{Type: v1beta1.AlertRuleNotificationSettingsTypeNamedRoutingTree, RoutingTree: "t"}},
			},
			Status: v1beta1.AlertRuleStatus{Health: &health},
		}}}
		out, err := scheme.ConvertToVersion(in, v0alpha1.GroupVersion)
		require.NoError(t, err)
		list, ok := out.(*v0alpha1.AlertRuleList)
		require.True(t, ok)
		require.Len(t, list.Items, 1)
		item := list.Items[0]
		assert.Equal(t, v0alpha1.GroupVersion.String(), item.APIVersion)
		assert.Equal(t, "t", item.Spec.NotificationSettings.NamedRoutingTree.RoutingTree)
		require.NotNil(t, item.Status.Health)
		assert.Equal(t, string(health), string(*item.Status.Health))
	})

	t.Run("rule sequences map alertingRules to alertRules and back", func(t *testing.T) {
		in := &v0alpha1.RuleSequenceList{Items: []v0alpha1.RuleSequence{{
			ObjectMeta: metav1.ObjectMeta{Name: "s"},
			Spec: v0alpha1.RuleSequenceSpec{
				RecordingRules: []v0alpha1.RuleSequenceRuleRef{{Name: "r"}},
				AlertingRules:  []v0alpha1.RuleSequenceRuleRef{{Name: "a"}},
			},
		}}}
		out, err := scheme.ConvertToVersion(in, v1beta1.GroupVersion)
		require.NoError(t, err)
		beta, ok := out.(*v1beta1.RuleSequenceList)
		require.True(t, ok)
		require.Len(t, beta.Items, 1)
		assert.Equal(t, []v1beta1.RuleSequenceRuleRef{{Name: "r"}}, beta.Items[0].Spec.RecordingRules)
		assert.Equal(t, []v1beta1.RuleSequenceRuleRef{{Name: "a"}}, beta.Items[0].Spec.AlertRules)

		back, err := scheme.ConvertToVersion(beta, v0alpha1.GroupVersion)
		require.NoError(t, err)
		alpha, ok := back.(*v0alpha1.RuleSequenceList)
		require.True(t, ok)
		require.Len(t, alpha.Items, 1)
		assert.Equal(t, []v0alpha1.RuleSequenceRuleRef{{Name: "a"}}, alpha.Items[0].Spec.AlertingRules)
	})

	for name, in := range map[string]runtime.Object{
		"recording rules": &v0alpha1.RecordingRuleList{Items: []v0alpha1.RecordingRule{{ObjectMeta: metav1.ObjectMeta{Name: "r"}, Spec: v0alpha1.RecordingRuleSpec{Metric: "m"}}}},
		"rule sequences":  &v0alpha1.RuleSequenceList{Items: []v0alpha1.RuleSequence{{ObjectMeta: metav1.ObjectMeta{Name: "s"}}}},
	} {
		t.Run(name+" round trip", func(t *testing.T) {
			beta, err := scheme.ConvertToVersion(in, v1beta1.GroupVersion)
			require.NoError(t, err)
			back, err := scheme.ConvertToVersion(beta, v0alpha1.GroupVersion)
			require.NoError(t, err)
			assert.Equal(t, reflect.ValueOf(in).Elem().FieldByName("Items").Len(), reflect.ValueOf(back).Elem().FieldByName("Items").Len())
			assert.Equal(t, reflect.TypeOf(in), reflect.TypeOf(back))
		})
	}
}
