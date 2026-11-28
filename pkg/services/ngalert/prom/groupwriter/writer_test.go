package groupwriter

import (
	"context"
	"errors"
	"testing"
	"testing/synctest"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/apps/alerting/rules/pkg/apis/alerting/v1beta1"
	"github.com/grafana/grafana/pkg/apimachinery/errutil"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/infra/log"
	ac "github.com/grafana/grafana/pkg/services/accesscontrol"
	acfakes "github.com/grafana/grafana/pkg/services/ngalert/accesscontrol/fakes"
	"github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/services/ngalert/prom/groupwriter/groupwritertest"
	"github.com/grafana/grafana/pkg/services/ngalert/provisioning"
	"github.com/grafana/grafana/pkg/services/ngalert/rules/legacy"
	"github.com/grafana/grafana/pkg/services/ngalert/tests/fakes"
	"github.com/grafana/grafana/pkg/services/quota"
	"github.com/grafana/grafana/pkg/services/user"
)

const (
	orgID  = int64(1)
	folder = "folder-1"
)

var convertedManager = utils.ManagerProperties{Kind: utils.ManagerKindClassicConvertedPrometheus} //nolint:staticcheck

type quotaOK struct{}

func (quotaOK) CheckQuotaReached(context.Context, quota.TargetSrv, *quota.ScopeParameters) (bool, error) {
	return false, nil
}

func setup(t *testing.T) (*Writer, *groupwritertest.Clients, *fakes.RuleStore) {
	t.Helper()
	store := fakes.NewRuleStore(t)
	groupwritertest.PersistUpdates(store)
	service := legacy.New(store, fakes.NewFakeProvisioningStore(), nil, quotaOK{}, store, 60, log.NewNopLogger(),
		&provisioning.NotificationSettingsValidatorProviderFake{}, &acfakes.FakeRuleService{HasAccessFunc: func(context.Context, identity.Requester, ac.Evaluator) (bool, error) { return true, nil }}, nil, func(int64) string { return "default" })
	clients := groupwritertest.NewClientsWithRules(service, &user.SignedInUser{OrgID: orgID})
	w := NewWriter(clients, func(int64) string { return "default" }, log.NewNopLogger())
	return w, clients, store
}

func newRule(uid string, recording bool) models.AlertRule {
	muts := []models.AlertRuleMutator{
		models.RuleMuts.WithUID(uid),
		models.RuleMuts.WithNoNotificationSettings(),
		models.RuleMuts.WithPrometheusOriginalRuleDefinition("expr: up"),
	}
	if recording {
		muts = append(muts, models.RuleMuts.WithAllRecordingRules())
	}
	r := models.RuleGen.With(muts...).Generate()
	// The generator doesn't tie the condition or the recorded query to one of the rule's queries.
	if recording {
		r.Record.From = r.Data[0].RefID
	} else {
		r.Condition = r.Data[0].RefID
	}
	return r
}

func group(title string, interval int64, rules ...models.AlertRule) *models.AlertRuleGroup {
	return &models.AlertRuleGroup{Title: title, FolderUID: folder, Interval: interval, Rules: rules}
}

func stored(store *fakes.RuleStore) map[string]*models.AlertRule {
	result := map[string]*models.AlertRule{}
	for _, r := range store.Rules[orgID] {
		result[r.UID] = r
	}
	return result
}

func TestReplaceGroups(t *testing.T) {
	ctx := context.Background()
	rec, alert := newRule("rec", true), newRule("alert", false)
	seqName := SequenceUID(orgID, folder, "g")

	t.Run("writes the rules with their group, then the sequence", func(t *testing.T) {
		w, clients, store := setup(t)
		require.NoError(t, w.ReplaceGroups(ctx, orgID, []*models.AlertRuleGroup{group("g", 120, alert, rec)}, convertedManager))

		require.Equal(t, []string{"create AlertRule alert", "create RecordingRule rec", "create RuleSequence " + seqName}, clients.Ops)
		rules := stored(store)
		require.Len(t, rules, 2)
		for i, uid := range []string{"alert", "rec"} {
			require.Equal(t, "g", rules[uid].RuleGroup)
			require.Equal(t, i, rules[uid].RuleGroupIndex)
			require.Equal(t, int64(120), rules[uid].IntervalSeconds)
		}
		seq := clients.Sequences[seqName]
		require.Equal(t, []v1beta1.RuleSequenceRuleRef{{Name: "rec"}}, seq.Spec.RecordingRules)
		require.Equal(t, []v1beta1.RuleSequenceRuleRef{{Name: "alert"}}, seq.Spec.AlertRules)
		require.Equal(t, v1beta1.RuleSequencePromDuration("2m"), seq.Spec.Trigger.Interval)

		t.Run("an identical re-import writes nothing", func(t *testing.T) {
			clients.Ops = nil
			require.NoError(t, w.ReplaceGroups(ctx, orgID, []*models.AlertRuleGroup{group("g", 120, alert, rec)}, convertedManager))
			require.Empty(t, clients.Ops)
		})

		t.Run("an interval change updates every rule", func(t *testing.T) {
			clients.Ops = nil
			require.NoError(t, w.ReplaceGroups(ctx, orgID, []*models.AlertRuleGroup{group("g", 300, alert, rec)}, convertedManager))
			require.Equal(t, []string{"update AlertRule alert", "update RecordingRule rec", "update RuleSequence " + seqName}, clients.Ops)
			for _, r := range stored(store) {
				require.Equal(t, int64(300), r.IntervalSeconds)
			}
		})

		t.Run("a dropped rule leaves the sequence before it is deleted", func(t *testing.T) {
			clients.Ops = nil
			require.NoError(t, w.ReplaceGroups(ctx, orgID, []*models.AlertRuleGroup{group("g", 300, rec)}, convertedManager))
			// The remaining rule moves to the dropped rule's position.
			require.Equal(t, []string{"update RuleSequence " + seqName, "delete AlertRule alert", "update RecordingRule rec"}, clients.Ops)
			require.Empty(t, clients.Sequences[seqName].Spec.AlertRules)
			require.NotContains(t, stored(store), "alert")
		})
	})

	t.Run("a rule that changes kind is deleted and created again", func(t *testing.T) {
		w, clients, store := setup(t)
		require.NoError(t, w.ReplaceGroups(ctx, orgID, []*models.AlertRuleGroup{group("g", 60, newRule("x", true))}, convertedManager))
		clients.Ops = nil

		require.NoError(t, w.ReplaceGroups(ctx, orgID, []*models.AlertRuleGroup{group("g", 60, newRule("x", false))}, convertedManager))
		require.Equal(t, []string{"delete RuleSequence " + seqName, "delete RecordingRule x", "create AlertRule x"}, clients.Ops)
		require.Equal(t, models.RuleTypeAlerting, stored(store)["x"].Type())
	})

	t.Run("a failure to shrink the sequence leaves the rules", func(t *testing.T) {
		w, clients, store := setup(t)
		require.NoError(t, w.ReplaceGroups(ctx, orgID, []*models.AlertRuleGroup{group("g", 60, rec, alert)}, convertedManager))
		clients.FailUpdate = errors.New("boom")

		require.ErrorIs(t, w.ReplaceGroups(ctx, orgID, []*models.AlertRuleGroup{group("g", 60, rec)}, convertedManager), clients.FailUpdate)
		require.Contains(t, stored(store), "alert")
	})

	t.Run("a rule of another manager is not deleted", func(t *testing.T) {
		w, _, store := setup(t)
		require.NoError(t, w.ReplaceGroups(ctx, orgID, []*models.AlertRuleGroup{group("g", 60, rec, alert)}, convertedManager))

		err := w.ReplaceGroups(ctx, orgID, []*models.AlertRuleGroup{group("g", 60, rec)}, utils.ManagerProperties{Kind: utils.ManagerKindTerraform})
		require.True(t, errors.As(err, &errutil.Error{}))
		require.Contains(t, stored(store), "alert")
	})

	t.Run("waits for a sequence that is being deleted before writing it again", func(t *testing.T) {
		w, clients, _ := setup(t)
		w.retryBackoff = 0
		clients.TerminatingGets = 2
		require.NoError(t, w.ReplaceGroups(ctx, orgID, []*models.AlertRuleGroup{group("g", 60, rec)}, convertedManager))
		require.NoError(t, w.ReplaceGroups(ctx, orgID, []*models.AlertRuleGroup{group("g", 60, alert)}, convertedManager))

		require.NoError(t, w.ReplaceGroups(ctx, orgID, []*models.AlertRuleGroup{group("g", 60, rec)}, convertedManager))
		require.NotNil(t, clients.Sequences[seqName])
		require.Nil(t, clients.Sequences[seqName].DeletionTimestamp)
	})
}

func TestRetryWhileSequenceMember(t *testing.T) {
	memberErr := v1beta1.NewRuleSequenceMemberError("alert", "seq")

	t.Run("retries a delete rejected for sequence membership", func(t *testing.T) {
		synctest.Test(t, func(t *testing.T) {
			ctx := context.Background()
			w, clients, store := setup(t)
			rec, alert := newRule("rec", true), newRule("alert", false)
			require.NoError(t, w.ReplaceGroups(ctx, orgID, []*models.AlertRuleGroup{group("g", 60, rec, alert)}, convertedManager))
			rejections := 2
			clients.RuleDelete = func(string) error {
				if rejections == 0 {
					return nil
				}
				rejections--
				return memberErr
			}

			require.NoError(t, w.ReplaceGroups(ctx, orgID, []*models.AlertRuleGroup{group("g", 60, rec)}, convertedManager))
			require.NotContains(t, stored(store), "alert")
		})
	})

	t.Run("gives up after the retries", func(t *testing.T) {
		synctest.Test(t, func(t *testing.T) {
			w, _, _ := setup(t)
			calls := 0
			err := w.retryWhileSequenceMember(context.Background(), func(context.Context) error {
				calls++
				return memberErr
			})
			require.True(t, v1beta1.IsRuleSequenceMemberError(err))
			require.Equal(t, defaultRetries+1, calls)
		})
	})

	t.Run("doesn't retry other errors", func(t *testing.T) {
		w, _, _ := setup(t)
		calls := 0
		boom := errors.New("boom")
		err := w.retryWhileSequenceMember(context.Background(), func(context.Context) error {
			calls++
			return boom
		})
		require.ErrorIs(t, err, boom)
		require.Equal(t, 1, calls)
	})
}

func TestDeleteGroups(t *testing.T) {
	ctx := context.Background()
	seqName := SequenceUID(orgID, folder, "g")

	t.Run("deletes the sequence before the convertedManager rules", func(t *testing.T) {
		w, clients, store := setup(t)
		manual := newRule("manual", false)
		manual.Metadata = models.AlertRuleMetadata{}
		require.NoError(t, w.ReplaceGroups(ctx, orgID, []*models.AlertRuleGroup{group("g", 60, newRule("rec", true), manual)}, convertedManager))
		clients.Ops = nil

		require.NoError(t, w.DeleteGroups(ctx, orgID, []GroupKey{{FolderUID: folder, Title: "g"}}, convertedManager))
		require.Equal(t, []string{"delete RuleSequence " + seqName, "delete RecordingRule rec"}, clients.Ops)
		require.Contains(t, stored(store), "manual")
	})

	t.Run("keeps the rules when the sequence can't be deleted", func(t *testing.T) {
		w, clients, store := setup(t)
		require.NoError(t, w.ReplaceGroups(ctx, orgID, []*models.AlertRuleGroup{group("g", 60, newRule("rec", true))}, convertedManager))
		clients.FailDelete = errors.New("boom")

		require.ErrorIs(t, w.DeleteGroups(ctx, orgID, []GroupKey{{FolderUID: folder, Title: "g"}}, convertedManager), clients.FailDelete)
		require.Contains(t, stored(store), "rec")
	})

	t.Run("reports a group without convertedManager rules as not found", func(t *testing.T) {
		w, _, _ := setup(t)
		require.ErrorIs(t, w.DeleteGroups(ctx, orgID, []GroupKey{{FolderUID: folder, Title: "g"}}, convertedManager), models.ErrAlertRuleGroupNotFound)
	})

	t.Run("deletes every convertedManager group in a folder", func(t *testing.T) {
		w, clients, store := setup(t)
		require.NoError(t, w.ReplaceGroups(ctx, orgID, []*models.AlertRuleGroup{
			group("g", 60, newRule("rec", true)),
			group("h", 60, newRule("other", true)),
		}, convertedManager))

		require.NoError(t, w.DeleteFolder(ctx, orgID, folder, convertedManager))
		require.Empty(t, stored(store))
		require.Empty(t, clients.Sequences)
		require.ErrorIs(t, w.DeleteFolder(ctx, orgID, folder, convertedManager), models.ErrAlertRuleGroupNotFound)
	})
}
