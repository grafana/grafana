package convert

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	"github.com/grafana/grafana/apps/alerting/rules/pkg/apis/alerting/v0alpha1"
	"github.com/grafana/grafana/apps/alerting/rules/pkg/apis/alerting/v1beta1"
)

func alphaRule() *v0alpha1.AlertRule {
	return &v0alpha1.AlertRule{
		ObjectMeta: metav1.ObjectMeta{Name: "r", Annotations: map[string]string{v0alpha1.FolderAnnotationKey: "f"}},
		Spec: v0alpha1.AlertRuleSpec{
			Title: "t",
			// As v0alpha1 decodes settings sent without a type.
			NotificationSettings: &v0alpha1.AlertRuleNotificationSettings{SimplifiedRouting: &v0alpha1.AlertRuleSimplifiedRouting{Receiver: "rcv"}},
		},
	}
}

func TestHub(t *testing.T) {
	t.Run("returns a hub object as is", func(t *testing.T) {
		in := &v1beta1.AlertRule{ObjectMeta: metav1.ObjectMeta{Name: "r"}}
		got, err := Hub[*v1beta1.AlertRule](in)
		require.NoError(t, err)
		assert.Same(t, in, got)
	})

	t.Run("converts v0alpha1 and defaults the notification settings type", func(t *testing.T) {
		in := alphaRule()
		got, err := Hub[*v1beta1.AlertRule](in)
		require.NoError(t, err)
		assert.Equal(t, "r", got.Name)
		assert.Equal(t, "f", got.Annotations[v1beta1.FolderAnnotationKey])
		assert.Equal(t, "t", got.Spec.Title)
		assert.Equal(t, v1beta1.AlertRuleNotificationSettingsTypeSimplifiedRouting, got.Spec.NotificationSettings.SimplifiedRouting.Type)
		assert.Equal(t, "rcv", got.Spec.NotificationSettings.SimplifiedRouting.Receiver)
		assert.Empty(t, in.Spec.NotificationSettings.SimplifiedRouting.Type, "the source is not modified")
	})

	t.Run("sets the TypeMeta of the converted object", func(t *testing.T) {
		got, err := Hub[*v1beta1.AlertRule](alphaRule())
		require.NoError(t, err)
		assert.Equal(t, v1beta1.AlertRuleKind().GroupVersionKind(), got.GroupVersionKind())
	})

	t.Run("converts the other rule kinds", func(t *testing.T) {
		rr, err := Hub[*v1beta1.RecordingRule](&v0alpha1.RecordingRule{Spec: v0alpha1.RecordingRuleSpec{Metric: "m"}})
		require.NoError(t, err)
		assert.Equal(t, v1beta1.RecordingRuleMetricName("m"), rr.Spec.Metric)

		seq, err := Hub[*v1beta1.RuleSequence](&v0alpha1.RuleSequence{Spec: v0alpha1.RuleSequenceSpec{
			RecordingRules: []v0alpha1.RuleSequenceRuleRef{{Name: "a"}},
			AlertingRules:  []v0alpha1.RuleSequenceRuleRef{{Name: "b"}},
		}})
		require.NoError(t, err)
		assert.Equal(t, []v1beta1.RuleSequenceRuleRef{{Name: "a"}}, seq.Spec.RecordingRules)
		assert.Equal(t, []v1beta1.RuleSequenceRuleRef{{Name: "b"}}, seq.Spec.AlertRules)
	})

	t.Run("rejects another kind", func(t *testing.T) {
		_, err := Hub[*v1beta1.AlertRule](&v0alpha1.RecordingRule{})
		require.Error(t, err)
	})

	t.Run("passes a nil object of the hub type through", func(t *testing.T) {
		got, err := Hub[*v1beta1.AlertRule]((*v1beta1.AlertRule)(nil))
		require.NoError(t, err)
		assert.Nil(t, got)
	})
}

func TestLike(t *testing.T) {
	hub := &v1beta1.AlertRule{
		ObjectMeta: metav1.ObjectMeta{Name: "r", Labels: map[string]string{v1beta1.FolderLabelKey: "f"}},
		Spec:       v1beta1.AlertRuleSpec{Title: "t"},
	}

	t.Run("returns the hub for a hub request", func(t *testing.T) {
		got, err := Like(hub, &v1beta1.AlertRule{})
		require.NoError(t, err)
		assert.Same(t, hub, got)
	})

	t.Run("converts back to the request version", func(t *testing.T) {
		got, err := Like(hub, alphaRule())
		require.NoError(t, err)
		rule, ok := got.(*v0alpha1.AlertRule)
		require.True(t, ok, "got %T", got)
		assert.Equal(t, "t", rule.Spec.Title)
		assert.Equal(t, "f", rule.Labels[v0alpha1.FolderLabelKey])
		assert.Equal(t, v0alpha1.AlertRuleKind().GroupVersionKind(), rule.GroupVersionKind())
	})

	t.Run("rejects another kind", func(t *testing.T) {
		_, err := Like(hub, &v0alpha1.RecordingRule{})
		require.Error(t, err)
	})

	t.Run("maps RuleSequence alertRules back to alertingRules", func(t *testing.T) {
		seq := &v1beta1.RuleSequence{Spec: v1beta1.RuleSequenceSpec{AlertRules: []v1beta1.RuleSequenceRuleRef{{Name: "b"}}}}
		got, err := Like(seq, &v0alpha1.RuleSequence{})
		require.NoError(t, err)
		out, ok := got.(*v0alpha1.RuleSequence)
		require.True(t, ok, "got %T", got)
		assert.Equal(t, []v0alpha1.RuleSequenceRuleRef{{Name: "b"}}, out.Spec.AlertingRules)
	})
}
