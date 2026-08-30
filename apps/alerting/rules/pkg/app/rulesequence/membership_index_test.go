package rulesequence

import (
	"context"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	model "github.com/grafana/grafana/apps/alerting/rules/pkg/apis/alerting/v0alpha1"
)

func makeRuleSequence(name string, recordingUIDs, alertingUIDs []string) *model.RuleSequence {
	seq := model.NewRuleSequence()
	seq.Name = name
	seq.Spec.RecordingRules = make([]model.RuleSequenceRuleRef, len(recordingUIDs))
	for i, uid := range recordingUIDs {
		seq.Spec.RecordingRules[i] = model.RuleSequenceRuleRef{Name: model.RuleSequenceRuleUID(uid)}
	}
	seq.Spec.AlertingRules = make([]model.RuleSequenceRuleRef, len(alertingUIDs))
	for i, uid := range alertingUIDs {
		seq.Spec.AlertingRules[i] = model.RuleSequenceRuleRef{Name: model.RuleSequenceRuleUID(uid)}
	}
	return seq
}

func TestMembershipIndex_Resolve_empty_index_returns_not_found(t *testing.T) {
	idx := NewMembershipIndex()
	result, err := idx.Resolve(context.Background(), []string{"rule-1", "rule-2"})
	require.NoError(t, err)
	assert.Len(t, result, 2)
	assert.False(t, result["rule-1"].Found)
	assert.False(t, result["rule-2"].Found)
}

func TestMembershipIndex_Resolve_empty_uids_returns_empty_map(t *testing.T) {
	idx := NewMembershipIndex()
	result, err := idx.Resolve(context.Background(), nil)
	require.NoError(t, err)
	assert.Empty(t, result)
}

func TestMembershipIndex_Add_indexes_all_refs(t *testing.T) {
	idx := NewMembershipIndex()
	seq := makeRuleSequence("seq-1", []string{"rec-1", "rec-2"}, []string{"alert-1"})

	require.NoError(t, idx.Add(context.Background(), seq))

	result, err := idx.Resolve(context.Background(), []string{"rec-1", "rec-2", "alert-1", "unknown"})
	require.NoError(t, err)

	assert.Equal(t, "seq-1", result["rec-1"].SequenceUID)
	assert.True(t, result["rec-1"].Found)
	assert.Equal(t, "seq-1", result["rec-2"].SequenceUID)
	assert.True(t, result["rec-2"].Found)
	assert.Equal(t, "seq-1", result["alert-1"].SequenceUID)
	assert.True(t, result["alert-1"].Found)
	assert.False(t, result["unknown"].Found)
}

func TestMembershipIndex_Add_multiple_sequences(t *testing.T) {
	idx := NewMembershipIndex()
	require.NoError(t, idx.Add(context.Background(), makeRuleSequence("seq-1", []string{"rec-1"}, nil)))
	require.NoError(t, idx.Add(context.Background(), makeRuleSequence("seq-2", []string{"rec-2"}, []string{"alert-2"})))

	result, err := idx.Resolve(context.Background(), []string{"rec-1", "rec-2", "alert-2"})
	require.NoError(t, err)

	assert.Equal(t, "seq-1", result["rec-1"].SequenceUID)
	assert.Equal(t, "seq-2", result["rec-2"].SequenceUID)
	assert.Equal(t, "seq-2", result["alert-2"].SequenceUID)
}

func TestMembershipIndex_Update_replaces_old_refs(t *testing.T) {
	idx := NewMembershipIndex()
	oldSeq := makeRuleSequence("seq-1", []string{"rec-1", "rec-2"}, []string{"alert-1"})
	require.NoError(t, idx.Add(context.Background(), oldSeq))

	// Update: remove rec-2 and alert-1, add rec-3
	newSeq := makeRuleSequence("seq-1", []string{"rec-1", "rec-3"}, nil)
	require.NoError(t, idx.Update(context.Background(), oldSeq, newSeq))

	result, err := idx.Resolve(context.Background(), []string{"rec-1", "rec-2", "rec-3", "alert-1"})
	require.NoError(t, err)

	assert.True(t, result["rec-1"].Found, "rec-1 should still be indexed")
	assert.Equal(t, "seq-1", result["rec-1"].SequenceUID)

	assert.False(t, result["rec-2"].Found, "rec-2 should be removed")
	assert.False(t, result["alert-1"].Found, "alert-1 should be removed")

	assert.True(t, result["rec-3"].Found, "rec-3 should be added")
	assert.Equal(t, "seq-1", result["rec-3"].SequenceUID)
}

func TestMembershipIndex_Delete_removes_all_refs(t *testing.T) {
	idx := NewMembershipIndex()
	seq := makeRuleSequence("seq-1", []string{"rec-1", "rec-2"}, []string{"alert-1"})
	require.NoError(t, idx.Add(context.Background(), seq))

	require.NoError(t, idx.Delete(context.Background(), seq))

	result, err := idx.Resolve(context.Background(), []string{"rec-1", "rec-2", "alert-1"})
	require.NoError(t, err)

	assert.False(t, result["rec-1"].Found)
	assert.False(t, result["rec-2"].Found)
	assert.False(t, result["alert-1"].Found)
}

func TestMembershipIndex_Delete_does_not_remove_other_sequence_refs(t *testing.T) {
	idx := NewMembershipIndex()

	// seq-1 owns rec-1, seq-2 owns rec-2
	require.NoError(t, idx.Add(context.Background(), makeRuleSequence("seq-1", []string{"rec-1"}, nil)))
	require.NoError(t, idx.Add(context.Background(), makeRuleSequence("seq-2", []string{"rec-2"}, nil)))

	// Delete seq-1: only rec-1 should be removed
	require.NoError(t, idx.Delete(context.Background(), makeRuleSequence("seq-1", []string{"rec-1"}, nil)))

	result, err := idx.Resolve(context.Background(), []string{"rec-1", "rec-2"})
	require.NoError(t, err)

	assert.False(t, result["rec-1"].Found)
	assert.True(t, result["rec-2"].Found)
	assert.Equal(t, "seq-2", result["rec-2"].SequenceUID)
}

func TestMembershipIndex_Delete_nonexistent_sequence_is_noop(t *testing.T) {
	idx := NewMembershipIndex()
	seq := makeRuleSequence("seq-does-not-exist", []string{"rec-1"}, nil)
	require.NoError(t, idx.Delete(context.Background(), seq))
}

func TestMembershipIndex_Add_rejects_non_RuleSequence_object(t *testing.T) {
	idx := NewMembershipIndex()
	notASequence := &metav1.ObjectMeta{Name: "not-a-sequence"}
	// Use a type that implements resource.Object but isn't a RuleSequence.
	// We use an AlertRule as a stand-in.
	alertRule := model.NewAlertRule()
	alertRule.Name = "not-a-sequence"
	err := idx.Add(context.Background(), alertRule)
	require.Error(t, err)
	assert.Contains(t, err.Error(), "non-RuleSequence")

	_ = notASequence // suppress unused
}

func TestMembershipIndex_Update_skips_empty_uids(t *testing.T) {
	idx := NewMembershipIndex()
	seq := makeRuleSequence("seq-1", []string{"rec-1", ""}, []string{"", "alert-1"})
	require.NoError(t, idx.Add(context.Background(), seq))

	result, err := idx.Resolve(context.Background(), []string{"rec-1", "alert-1", ""})
	require.NoError(t, err)

	assert.True(t, result["rec-1"].Found)
	assert.True(t, result["alert-1"].Found)
	assert.False(t, result[""].Found, "empty UID should not be indexed")
}
