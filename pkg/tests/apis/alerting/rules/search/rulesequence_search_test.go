package search

import (
	"context"
	"encoding/json"
	"fmt"
	"testing"
	"time"

	"github.com/stretchr/testify/require"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	v1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/client-go/rest"

	"github.com/grafana/grafana/apps/alerting/rules/pkg/apis/alerting/v0alpha1"
	"github.com/grafana/grafana/apps/alerting/rules/pkg/apis/alerting/v1beta1"
	searchv0 "github.com/grafana/grafana/pkg/apis/search/v0alpha1"
	ngmodels "github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/tests/apis"
	"github.com/grafana/grafana/pkg/tests/apis/alerting/rules/common"
	"github.com/grafana/grafana/pkg/util/testutil"
)

const (
	ruleSequences = "rulesequences"

	sequenceFolderA = "sequence-search-folder-a"
	sequenceFolderB = "sequence-search-folder-b"

	recordingRuleUIDsField = "recordingRuleUIDs"
	alertRuleUIDsField     = "alertRuleUIDs"
	intervalField          = "interval"
)

// TestIntegrationRuleSequenceSearch exercises the generic per-kind search
// endpoint for rule sequences, which serves the searchFields declared in
// ruleSequence.cue. RuleSequence is unified-only, so there is no storage mode
// to iterate.
func TestIntegrationRuleSequenceSearch(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	ctx := context.Background()
	helper := common.GetTestHelperWithRuleSequences(t)
	common.CreateTestFolder(t, helper, sequenceFolderA)
	common.CreateTestFolder(t, helper, sequenceFolderB)

	alertClient := common.NewAlertRuleClient(t, helper.Org1.Admin)
	recClient := common.NewRecordingRuleClient(t, helper.Org1.Admin)
	seqClient := common.NewRuleSequenceClient(t, helper.Org1.Admin)
	adminRC := helper.Org1.Admin.RESTClient(t, &v0alpha1.GroupVersion)

	newRecording := func(t *testing.T, folder string) string {
		t.Helper()
		return createSequenceRecordingRule(t, ctx, recClient, folder)
	}
	newAlerting := func(t *testing.T, folder string) string {
		t.Helper()
		return createSequenceAlertRule(t, ctx, alertClient, folder)
	}

	// Recording-only sequence.
	recOnly := []string{newRecording(t, sequenceFolderA), newRecording(t, sequenceFolderA)}
	seqRecOnly := createRuleSequence(t, ctx, seqClient, sequenceFolderA, "1m", recOnly, nil)

	// Sequence with both kinds of members.
	mixedRec := []string{newRecording(t, sequenceFolderA), newRecording(t, sequenceFolderA), newRecording(t, sequenceFolderA)}
	mixedAlert := []string{newAlerting(t, sequenceFolderA), newAlerting(t, sequenceFolderA)}
	seqMixed := createRuleSequence(t, ctx, seqClient, sequenceFolderA, "2m", mixedRec, mixedAlert)

	// A sequence in another folder, so lookups span folders.
	otherRec := []string{newRecording(t, sequenceFolderB)}
	otherAlert := []string{newAlerting(t, sequenceFolderB)}
	seqOther := createRuleSequence(t, ctx, seqClient, sequenceFolderB, "3m", otherRec, otherAlert)

	// Rules that belong to no sequence.
	loneRec := newRecording(t, sequenceFolderA)
	loneAlert := newAlerting(t, sequenceFolderA)

	t.Run("finds the containing sequences by member UIDs", func(t *testing.T) {
		uids := []string{recOnly[1], mixedRec[0], mixedAlert[1], otherAlert[0], loneRec, loneAlert}
		got := findSequences(t, ctx, adminRC, uids)
		require.ElementsMatch(t, []string{seqRecOnly, seqMixed, seqOther}, sequenceNames(got))

		recOnlyHit := sequenceHit(t, got, seqRecOnly)
		require.ElementsMatch(t, recOnly, stringArrayField(t, recOnlyHit, recordingRuleUIDsField))
		require.NotContains(t, perKindFieldValues(recOnlyHit), alertRuleUIDsField)
		require.Equal(t, "1m", perKindStringField(t, recOnlyHit, intervalField))

		mixedHit := sequenceHit(t, got, seqMixed)
		require.ElementsMatch(t, mixedRec, stringArrayField(t, mixedHit, recordingRuleUIDsField))
		require.ElementsMatch(t, mixedAlert, stringArrayField(t, mixedHit, alertRuleUIDsField))
		require.Equal(t, "2m", perKindStringField(t, mixedHit, intervalField))
	})

	t.Run("each member field matches only its own kind of member", func(t *testing.T) {
		byRecording := searchSequences(t, ctx, adminRC, sequenceQuery(recordingRuleUIDsField, mixedAlert[0]))
		require.Empty(t, byRecording.Items)

		byAlerting := searchSequences(t, ctx, adminRC, sequenceQuery(alertRuleUIDsField, mixedAlert[0]))
		require.Equal(t, []string{seqMixed}, sequenceNames(byAlerting.Items))
	})

	t.Run("a rule in no sequence has no hit", func(t *testing.T) {
		require.Empty(t, findSequences(t, ctx, adminRC, []string{loneRec, loneAlert, "no-such-rule"}))
	})

	t.Run("a large set of UIDs", func(t *testing.T) {
		uids := make([]string, 0, 500)
		for i := range 496 {
			uids = append(uids, fmt.Sprintf("absent-rule-%03d", i))
		}
		uids = append(uids, recOnly[0], mixedRec[2], mixedAlert[0], otherRec[0])
		require.Len(t, uids, 500)

		got := findSequences(t, ctx, adminRC, uids)
		require.ElementsMatch(t, []string{seqRecOnly, seqMixed, seqOther}, sequenceNames(got))
	})

	t.Run("updates are reflected", func(t *testing.T) {
		recs := []string{newRecording(t, sequenceFolderA), newRecording(t, sequenceFolderA)}
		alerts := []string{newAlerting(t, sequenceFolderA)}
		name := createRuleSequence(t, ctx, seqClient, sequenceFolderA, "1m", recs, alerts)

		added := newRecording(t, sequenceFolderA)
		addedAlert := newAlerting(t, sequenceFolderA)
		updated := updateRuleSequence(t, ctx, seqClient, name, "5m",
			// Reordered, one recording rule dropped and one added, and an alert rule added.
			[]string{added, recs[1]}, []string{addedAlert, alerts[0]})

		waitFor(t, func() bool {
			got := findSequences(t, ctx, adminRC, []string{added})
			if len(got) != 1 || got[0].Resource.Name != name {
				return false
			}
			s, _ := perKindFieldValues(got[0])[intervalField].(string)
			return s == "5m"
		}, "update was not indexed")

		hit := sequenceHit(t, findSequences(t, ctx, adminRC, []string{addedAlert}), name)
		require.ElementsMatch(t, toStrings(updated.Spec.RecordingRules), stringArrayField(t, hit, recordingRuleUIDsField))
		require.ElementsMatch(t, toStrings(updated.Spec.AlertingRules), stringArrayField(t, hit, alertRuleUIDsField))
		require.Empty(t, findSequences(t, ctx, adminRC, []string{recs[0]}), "a removed member must no longer match")
	})

	// v1beta1 renamed spec.alertingRules to spec.alertRules; the index reads
	// each document with its own version's path, so both versions search alike.
	t.Run("a sequence written as v1beta1 is found from either version", func(t *testing.T) {
		betaRC := helper.Org1.Admin.RESTClient(t, &v1beta1.GroupVersion)
		rec, alert := newRecording(t, sequenceFolderA), newAlerting(t, sequenceFolderA)
		name := createRuleSequenceV1beta1(t, ctx, betaRC, sequenceFolderA, "4m", []string{rec}, []string{alert})

		for _, version := range []string{v0alpha1.APIVersion, v1beta1.APIVersion} {
			got := searchSequencesAt(t, ctx, betaRC, version, sequenceQuery(alertRuleUIDsField, alert))
			require.Equal(t, []string{name}, sequenceNames(got.Items), version)
			require.ElementsMatch(t, []string{alert}, stringArrayField(t, got.Items[0], alertRuleUIDsField), version)
			require.ElementsMatch(t, []string{rec}, stringArrayField(t, got.Items[0], recordingRuleUIDsField), version)
		}

		got := searchSequencesAt(t, ctx, betaRC, v1beta1.APIVersion, sequenceQuery(alertRuleUIDsField, mixedAlert[0]))
		require.Equal(t, []string{seqMixed}, sequenceNames(got.Items), "a sequence written as v0alpha1 is found through v1beta1")
	})

	t.Run("deleted sequences are not returned", func(t *testing.T) {
		recs := []string{newRecording(t, sequenceFolderA)}
		name := createRuleSequence(t, ctx, seqClient, sequenceFolderA, "1m", recs, nil)
		require.Equal(t, []string{name}, sequenceNames(findSequences(t, ctx, adminRC, recs)))

		// The app-sdk watcher adds a finalizer in the background; wait for it so
		// the delete does not race with that patch.
		waitFor(t, func() bool {
			got, err := seqClient.Get(ctx, name, v1.GetOptions{})
			require.NoError(t, err)
			return len(got.Finalizers) > 0
		}, "finalizer was not added to RuleSequence")
		require.NoError(t, seqClient.Delete(ctx, name, v1.DeleteOptions{}))

		waitFor(t, func() bool {
			return len(findSequences(t, ctx, adminRC, recs)) == 0
		}, "deleted sequence is still returned")
	})
}

// waitFor polls cond on the test goroutine, so cond may use require.
func waitFor(t *testing.T, cond func() bool, msg string) {
	t.Helper()
	deadline := time.Now().Add(10 * time.Second)
	for !cond() {
		if time.Now().After(deadline) {
			require.FailNow(t, msg)
		}
		time.Sleep(100 * time.Millisecond)
	}
}

// findSequences returns the sequences containing any of the given rule UIDs.
// Search v1 has no "or" predicate, so a client searches each member field on
// its own and merges the hits by sequence name.
func findSequences(t *testing.T, ctx context.Context, rc *rest.RESTClient, ruleUIDs []string) []searchv0.ResultItem {
	t.Helper()
	var out []searchv0.ResultItem
	seen := map[string]bool{}
	for _, field := range []string{recordingRuleUIDsField, alertRuleUIDsField} {
		resp := searchSequences(t, ctx, rc, sequenceQuery(field, ruleUIDs...))
		require.Empty(t, resp.Metadata.Continue, "all hits must fit in one page")
		for _, h := range resp.Items {
			if seen[h.Resource.Name] {
				continue
			}
			seen[h.Resource.Name] = true
			out = append(out, h)
		}
	}
	return out
}

func sequenceQuery(field string, ruleUIDs ...string) *perKindQuery {
	return newPerKindQuery().
		filter(field, perKindOpIn, ruleUIDs...).
		fields(recordingRuleUIDsField, alertRuleUIDsField, intervalField).
		limit(500)
}

func searchSequences(t *testing.T, ctx context.Context, rc *rest.RESTClient, q *perKindQuery) searchv0.SearchResults {
	t.Helper()
	return searchSequencesAt(t, ctx, rc, v0alpha1.APIVersion, q)
}

func searchSequencesAt(t *testing.T, ctx context.Context, rc *rest.RESTClient, version string, q *perKindQuery) searchv0.SearchResults {
	t.Helper()
	payload, err := json.Marshal(q.body)
	require.NoError(t, err)

	raw, err := rc.Post().
		AbsPath("apis", v0alpha1.APIGroup, version, "namespaces", "default", ruleSequences, "search").
		Body(payload).
		DoRaw(ctx)
	require.NoError(t, err, string(raw))

	var resp searchv0.SearchResults
	require.NoError(t, json.Unmarshal(raw, &resp))
	for _, h := range resp.Items {
		require.Equal(t, "RuleSequence", h.Resource.Kind)
	}
	return resp
}

func sequenceNames(items []searchv0.ResultItem) []string {
	out := make([]string, 0, len(items))
	for _, h := range items {
		out = append(out, h.Resource.Name)
	}
	return out
}

func sequenceHit(t *testing.T, items []searchv0.ResultItem, name string) searchv0.ResultItem {
	t.Helper()
	for _, h := range items {
		if h.Resource.Name == name {
			return h
		}
	}
	require.FailNowf(t, "hit not found", "no hit for sequence %q in %v", name, sequenceNames(items))
	return searchv0.ResultItem{}
}

func stringArrayField(t *testing.T, h searchv0.ResultItem, name string) []string {
	t.Helper()
	v, ok := perKindFieldValues(h)[name]
	require.True(t, ok, "hit is missing field %q", name)
	values, ok := v.([]any)
	require.True(t, ok, "field %q is %T, not an array", name, v)
	out := make([]string, 0, len(values))
	for _, value := range values {
		s, ok := value.(string)
		require.True(t, ok, "field %q has a %T element, not a string", name, value)
		out = append(out, s)
	}
	return out
}

func toStrings(refs []v0alpha1.RuleSequenceRuleRef) []string {
	out := make([]string, 0, len(refs))
	for _, r := range refs {
		out = append(out, string(r.Name))
	}
	return out
}

func toRuleRefs(uids []string) []v0alpha1.RuleSequenceRuleRef {
	if len(uids) == 0 {
		return nil
	}
	out := make([]v0alpha1.RuleSequenceRuleRef, 0, len(uids))
	for _, uid := range uids {
		out = append(out, v0alpha1.RuleSequenceRuleRef{Name: v0alpha1.RuleSequenceRuleUID(uid)})
	}
	return out
}

func createRuleSequence(t *testing.T, ctx context.Context, client *apis.TypedClient[v0alpha1.RuleSequence, v0alpha1.RuleSequenceList], folder, interval string, recordingUIDs, alertingUIDs []string) string {
	t.Helper()
	created, err := client.Create(ctx, &v0alpha1.RuleSequence{
		ObjectMeta: v1.ObjectMeta{
			Namespace:    "default",
			GenerateName: "search-seq-",
			Annotations:  map[string]string{v0alpha1.FolderAnnotationKey: folder},
		},
		Spec: v0alpha1.RuleSequenceSpec{
			Trigger:        v0alpha1.RuleSequenceIntervalTrigger{Interval: v0alpha1.RuleSequencePromDuration(interval)},
			RecordingRules: toRuleRefs(recordingUIDs),
			AlertingRules:  toRuleRefs(alertingUIDs),
		},
	}, v1.CreateOptions{})
	require.NoError(t, err)
	return created.Name
}

func createRuleSequenceV1beta1(t *testing.T, ctx context.Context, rc *rest.RESTClient, folder, interval string, recordingUIDs, alertUIDs []string) string {
	t.Helper()
	refs := func(uids []string) []any {
		out := make([]any, 0, len(uids))
		for _, uid := range uids {
			out = append(out, map[string]any{"name": uid})
		}
		return out
	}
	body, err := json.Marshal(map[string]any{
		"apiVersion": v1beta1.GroupVersion.String(),
		"kind":       "RuleSequence",
		"metadata": map[string]any{
			"generateName": "search-seq-",
			"annotations":  map[string]string{v1beta1.FolderAnnotationKey: folder},
		},
		"spec": map[string]any{
			"trigger":        map[string]any{"interval": interval},
			"recordingRules": refs(recordingUIDs),
			"alertRules":     refs(alertUIDs),
		},
	})
	require.NoError(t, err)
	raw, err := rc.Post().
		AbsPath("apis", v1beta1.APIGroup, v1beta1.APIVersion, "namespaces", "default", ruleSequences).
		Body(body).
		DoRaw(ctx)
	require.NoError(t, err, string(raw))
	var created v1beta1.RuleSequence
	require.NoError(t, json.Unmarshal(raw, &created))
	return created.Name
}

func updateRuleSequence(t *testing.T, ctx context.Context, client *apis.TypedClient[v0alpha1.RuleSequence, v0alpha1.RuleSequenceList], name, interval string, recordingUIDs, alertingUIDs []string) *v0alpha1.RuleSequence {
	t.Helper()
	var updated *v0alpha1.RuleSequence
	// The background finalizer patch can bump the resource version between our
	// get and update, so retry on conflict.
	waitFor(t, func() bool {
		current, err := client.Get(ctx, name, v1.GetOptions{})
		require.NoError(t, err)
		current.Spec.Trigger.Interval = v0alpha1.RuleSequencePromDuration(interval)
		current.Spec.RecordingRules = toRuleRefs(recordingUIDs)
		current.Spec.AlertingRules = toRuleRefs(alertingUIDs)
		updated, err = client.Update(ctx, current, v1.UpdateOptions{})
		require.Truef(t, err == nil || apierrors.IsConflict(err), "updating sequence: %v", err)
		return err == nil
	}, "sequence update did not succeed")
	return updated
}

func createSequenceRecordingRule(t *testing.T, ctx context.Context, client *apis.TypedClient[v0alpha1.RecordingRule, v0alpha1.RecordingRuleList], folder string) string {
	t.Helper()
	base := ngmodels.RuleGen.With(
		ngmodels.RuleMuts.WithUniqueUID(),
		ngmodels.RuleMuts.WithNamespaceUID(folder),
		ngmodels.RuleMuts.WithAllRecordingRules(),
	).Generate()

	created, err := client.Create(ctx, &v0alpha1.RecordingRule{
		ObjectMeta: v1.ObjectMeta{
			Name:        base.UID,
			Namespace:   "default",
			Annotations: map[string]string{v0alpha1.FolderAnnotationKey: folder},
		},
		Spec: v0alpha1.RecordingRuleSpec{
			Title:               "sequence member " + base.UID,
			Metric:              v0alpha1.RecordingRuleMetricName("sequence_member_total"),
			TargetDatasourceUID: v0alpha1.RecordingRuleDatasourceUID("ds-prom"),
			Expressions: v0alpha1.RecordingRuleExpressionMap{
				"A": {
					QueryType:     new(base.Data[0].QueryType),
					DatasourceUID: new(v0alpha1.RecordingRuleDatasourceUID("ds-prom")),
					Model:         base.Data[0].Model,
					Source:        new(true),
					RelativeTimeRange: &v0alpha1.RecordingRuleRelativeTimeRange{
						From: v0alpha1.RecordingRulePromDurationWMillis("5m"),
						To:   v0alpha1.RecordingRulePromDurationWMillis("0s"),
					},
				},
			},
			Trigger: v0alpha1.RecordingRuleIntervalTrigger{Interval: "10s"},
		},
	}, v1.CreateOptions{})
	require.NoError(t, err)
	return created.Name
}

func createSequenceAlertRule(t *testing.T, ctx context.Context, client *apis.TypedClient[v0alpha1.AlertRule, v0alpha1.AlertRuleList], folder string) string {
	t.Helper()
	base := ngmodels.RuleGen.With(
		ngmodels.RuleMuts.WithUniqueUID(),
		ngmodels.RuleMuts.WithNamespaceUID(folder),
	).Generate()

	created, err := client.Create(ctx, &v0alpha1.AlertRule{
		ObjectMeta: v1.ObjectMeta{
			Name:        base.UID,
			Namespace:   "default",
			Annotations: map[string]string{v0alpha1.FolderAnnotationKey: folder},
		},
		Spec: v0alpha1.AlertRuleSpec{
			Title:        "sequence member " + base.UID,
			Expressions:  perKindAlertExpressions(base, "ds-prom"),
			Trigger:      v0alpha1.AlertRuleIntervalTrigger{Interval: "10s"},
			NoDataState:  "NoData",
			ExecErrState: "Error",
		},
	}, v1.CreateOptions{})
	require.NoError(t, err)
	return created.Name
}
