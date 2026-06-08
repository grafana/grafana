package notifier

import (
	"errors"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	alertingnotifv0alpha1 "github.com/grafana/grafana/apps/alerting/notifications/pkg/apis/alertingnotifications/v0alpha1"
	"github.com/grafana/grafana/pkg/apimachinery/errutil"
)

func TestComputeSyncStatus(t *testing.T) {
	var (
		now     = time.Date(2026, 5, 20, 12, 0, 0, 0, time.UTC)
		earlier = time.Date(2026, 5, 19, 9, 0, 0, 0, time.UTC)
		nowRFC  = now.UTC().Format(time.RFC3339)
		earlRFC = earlier.UTC().Format(time.RFC3339)
	)

	strPtr := func(s string) *string { return &s }
	originPtr := func(o externalSyncOrigin) *externalSyncOrigin { return &o }

	syncErrFor := func(reason SyncReason, msg string) *SyncError {
		return &SyncError{Reason: reason, Cause: errors.New(msg)}
	}

	findSynced := func(t *testing.T, st alertingnotifv0alpha1.ConfigStatus) alertingnotifv0alpha1.ConfigCondition {
		t.Helper()
		for _, c := range st.Conditions {
			if c.Type == conditionTypeExternalAlertmanagerSynced {
				return c
			}
		}
		t.Fatalf("expected Synced condition, got: %+v", st.Conditions)
		return alertingnotifv0alpha1.ConfigCondition{}
	}

	externalSync := func(t *testing.T, st alertingnotifv0alpha1.ConfigStatus) *alertingnotifv0alpha1.ConfigV0alpha1StatusExternalAlertmanagerSync {
		t.Helper()
		require.NotNil(t, st.ExternalAlertmanagerSync, "externalAlertmanagerSync status sub-tree should be populated")
		return st.ExternalAlertmanagerSync
	}

	t.Run("success from clean state emits Synced=True with current timestamp", func(t *testing.T) {
		got := computeSyncStatus(nil, "uid-a", originAPI, nil, now)

		es := externalSync(t, got)
		assert.Equal(t, strPtr("uid-a"), es.DatasourceUid)
		assert.Equal(t, originPtr(originAPI), es.Origin)

		synced := findSynced(t, got)
		assert.Equal(t, alertingnotifv0alpha1.ConfigConditionStatusTrue, synced.Status)
		assert.Equal(t, "SyncSucceeded", synced.Reason)
		assert.Equal(t, nowRFC, synced.LastTransitionTime)
		assert.Nil(t, synced.Message)
	})

	t.Run("failure from clean state emits Synced=False with category-mapped reason and error message", func(t *testing.T) {
		got := computeSyncStatus(nil, "uid-a", originAPI, syncErrFor(ReasonMimirFetch, "connect: refused"), now)

		es := externalSync(t, got)
		assert.Equal(t, strPtr("uid-a"), es.DatasourceUid)

		synced := findSynced(t, got)
		assert.Equal(t, alertingnotifv0alpha1.ConfigConditionStatusFalse, synced.Status)
		assert.Equal(t, "MimirFetchFailed", synced.Reason)
		assert.Equal(t, strPtr("connect: refused"), synced.Message)
		assert.Equal(t, nowRFC, synced.LastTransitionTime)
	})

	t.Run("consecutive failures preserve the original lastTransitionTime", func(t *testing.T) {
		prev := &alertingnotifv0alpha1.ConfigStatus{
			Conditions: []alertingnotifv0alpha1.ConfigCondition{{
				Type:               conditionTypeExternalAlertmanagerSynced,
				Status:             alertingnotifv0alpha1.ConfigConditionStatusFalse,
				LastTransitionTime: earlRFC,
				Reason:             "MimirFetchFailed",
				Message:            strPtr("first failure"),
			}},
		}

		got := computeSyncStatus(prev, "uid-a", originAPI, syncErrFor(ReasonMimirFetch, "second failure"), now)

		synced := findSynced(t, got)
		assert.Equal(t, alertingnotifv0alpha1.ConfigConditionStatusFalse, synced.Status)
		assert.Equal(t, strPtr("second failure"), synced.Message)
		assert.Equal(t, earlRFC, synced.LastTransitionTime, "lastTransitionTime should mark when the streak began, not the latest failure")
	})

	t.Run("failure after a prior success bumps lastTransitionTime", func(t *testing.T) {
		prev := &alertingnotifv0alpha1.ConfigStatus{
			Conditions: []alertingnotifv0alpha1.ConfigCondition{{
				Type:               conditionTypeExternalAlertmanagerSynced,
				Status:             alertingnotifv0alpha1.ConfigConditionStatusTrue,
				LastTransitionTime: earlRFC,
				Reason:             "SyncSucceeded",
			}},
		}

		got := computeSyncStatus(prev, "uid-a", originAPI, syncErrFor(ReasonSave, "save broke"), now)

		synced := findSynced(t, got)
		assert.Equal(t, alertingnotifv0alpha1.ConfigConditionStatusFalse, synced.Status)
		assert.Equal(t, nowRFC, synced.LastTransitionTime, "lastTransitionTime advanced on flip True→False")
		assert.Equal(t, "SaveFailed", synced.Reason)
		assert.Equal(t, strPtr("save broke"), synced.Message)
	})

	t.Run("success after a failure bumps lastTransitionTime and clears message", func(t *testing.T) {
		prev := &alertingnotifv0alpha1.ConfigStatus{
			Conditions: []alertingnotifv0alpha1.ConfigCondition{{
				Type:               conditionTypeExternalAlertmanagerSynced,
				Status:             alertingnotifv0alpha1.ConfigConditionStatusFalse,
				LastTransitionTime: earlRFC,
				Reason:             "MimirFetchFailed",
				Message:            strPtr("was broken"),
			}},
		}

		got := computeSyncStatus(prev, "uid-a", originAPI, nil, now)

		synced := findSynced(t, got)
		assert.Equal(t, alertingnotifv0alpha1.ConfigConditionStatusTrue, synced.Status)
		assert.Equal(t, "SyncSucceeded", synced.Reason)
		assert.Nil(t, synced.Message, "message cleared on recovery")
		assert.Equal(t, nowRFC, synced.LastTransitionTime, "lastTransitionTime advanced on flip False→True")
	})

	t.Run("origin is propagated regardless of outcome", func(t *testing.T) {
		gotSuccess := computeSyncStatus(nil, "uid-a", originIni, nil, now)
		gotFailure := computeSyncStatus(nil, "uid-a", originIni, syncErrFor(ReasonSave, "x"), now)

		assert.Equal(t, originPtr(originIni), externalSync(t, gotSuccess).Origin)
		assert.Equal(t, originPtr(originIni), externalSync(t, gotFailure).Origin)
	})

	t.Run("datasourceUid reflects the attempted UID, not any prior one", func(t *testing.T) {
		prev := &alertingnotifv0alpha1.ConfigStatus{
			ExternalAlertmanagerSync: &alertingnotifv0alpha1.ConfigV0alpha1StatusExternalAlertmanagerSync{
				DatasourceUid: strPtr("old-uid"),
			},
		}

		got := computeSyncStatus(prev, "new-uid", originAPI, nil, now)

		assert.Equal(t, strPtr("new-uid"), externalSync(t, got).DatasourceUid)
	})

	t.Run("other condition types in prev are preserved", func(t *testing.T) {
		// Future-proof: if another part of the system adds a condition type
		// alongside Synced, computeSyncStatus must not stomp it.
		prev := &alertingnotifv0alpha1.ConfigStatus{
			Conditions: []alertingnotifv0alpha1.ConfigCondition{
				{
					Type:               "RoutingApplied",
					Status:             alertingnotifv0alpha1.ConfigConditionStatusTrue,
					LastTransitionTime: earlRFC,
					Reason:             "RoutingApplied",
				},
			},
		}

		got := computeSyncStatus(prev, "uid-a", originAPI, nil, now)

		require.Len(t, got.Conditions, 2, "both RoutingApplied and Synced should be present")
		var saw bool
		for _, c := range got.Conditions {
			if c.Type == "RoutingApplied" {
				saw = true
				assert.Equal(t, alertingnotifv0alpha1.ConfigConditionStatusTrue, c.Status)
				assert.Equal(t, earlRFC, c.LastTransitionTime, "unrelated condition should be untouched")
			}
		}
		assert.True(t, saw, "RoutingApplied not found in result")
	})

	t.Run("bare error (not a *SyncError) maps to fallback SyncFailed reason", func(t *testing.T) {
		got := computeSyncStatus(nil, "uid-a", originAPI, errors.New("raw error"), now)

		synced := findSynced(t, got)
		assert.Equal(t, "SyncFailed", synced.Reason, "unclassified error → SyncFailed condition reason")
		assert.Equal(t, strPtr("raw error"), synced.Message)
	})
}

func TestSyncReasonMethods(t *testing.T) {
	cases := []struct {
		reason          SyncReason
		expectLabel     string // snake_case for Prometheus
		expectCondition string // PascalCase for k8s
	}{
		{ReasonDatasourceLookup, "datasource_lookup", "DatasourceLookupFailed"},
		{ReasonMimirFetch, "mimir_fetch", "MimirFetchFailed"},
		{ReasonSave, "save", "SaveFailed"},
		{ReasonIdentifierMismatch, "identifier_mismatch", "IdentifierMismatch"},
		{ReasonUnclassified, "unclassified", "SyncFailed"},
	}
	for _, c := range cases {
		t.Run(string(c.reason), func(t *testing.T) {
			assert.Equal(t, c.expectLabel, c.reason.Label())
			assert.Equal(t, c.expectCondition, c.reason.ConditionReason())
		})
	}
}

func TestReasonOf(t *testing.T) {
	t.Run("nil error → ReasonUnclassified", func(t *testing.T) {
		assert.Equal(t, ReasonUnclassified, reasonOf(nil))
	})
	t.Run("bare error → ReasonUnclassified", func(t *testing.T) {
		assert.Equal(t, ReasonUnclassified, reasonOf(errors.New("nope")))
	})
	t.Run("*SyncError → its Reason", func(t *testing.T) {
		assert.Equal(t, ReasonMimirFetch, reasonOf(&SyncError{Reason: ReasonMimirFetch, Cause: errors.New("x")}))
	})
	t.Run("walks errors.As chain", func(t *testing.T) {
		inner := &SyncError{Reason: ReasonSave, Cause: errors.New("x")}
		wrapped := errors.Join(errors.New("ctx"), inner) // errors.As walks Join's children
		assert.Equal(t, ReasonSave, reasonOf(wrapped))
	})
}

func TestClassifySaveError(t *testing.T) {
	t.Run("nil → nil", func(t *testing.T) {
		assert.Nil(t, ClassifySaveError(nil))
	})
	t.Run("plain save error → ReasonSave", func(t *testing.T) {
		got := ClassifySaveError(errors.New("disk full"))
		require.NotNil(t, got)
		assert.Equal(t, ReasonSave, got.Reason)
		assert.Equal(t, "disk full", got.Error())
	})
	t.Run("identifier-mismatch error → ReasonIdentifierMismatch", func(t *testing.T) {
		built := ErrAlertmanagerMultipleExtraConfigsUnsupported.Build(errutil.TemplateData{Public: map[string]interface{}{"Identifier": "test"}})
		got := ClassifySaveError(built)
		require.NotNil(t, got)
		assert.Equal(t, ReasonIdentifierMismatch, got.Reason)
	})
	t.Run("already-classified *SyncError → returned as-is (no double wrap)", func(t *testing.T) {
		original := &SyncError{Reason: ReasonMimirFetch, Cause: errors.New("upstream")}
		got := ClassifySaveError(original)
		assert.Same(t, original, got, "should not re-wrap a *SyncError")
	})
}

func TestComputeCommittedStatus(t *testing.T) {
	now := time.Date(2026, 5, 20, 12, 0, 0, 0, time.UTC)
	earlier := time.Date(2026, 5, 19, 9, 0, 0, 0, time.UTC)
	nowRFC := now.UTC().Format(time.RFC3339)
	earlRFC := earlier.UTC().Format(time.RFC3339)
	strPtr := func(s string) *string { return &s }

	findSynced := func(t *testing.T, st alertingnotifv0alpha1.ConfigStatus) alertingnotifv0alpha1.ConfigCondition {
		t.Helper()
		for _, c := range st.Conditions {
			if c.Type == conditionTypeExternalAlertmanagerSynced {
				return c
			}
		}
		t.Fatalf("expected Synced condition, got: %+v", st.Conditions)
		return alertingnotifv0alpha1.ConfigCondition{}
	}

	t.Run("from clean state: True/MergeCommitted with datasource, message and current timestamp", func(t *testing.T) {
		got := computeCommittedStatus(nil, "ds-1", originAPI, now)

		require.NotNil(t, got.ExternalAlertmanagerSync)
		assert.Equal(t, strPtr("ds-1"), got.ExternalAlertmanagerSync.DatasourceUid)

		c := findSynced(t, got)
		assert.Equal(t, alertingnotifv0alpha1.ConfigConditionStatusTrue, c.Status)
		assert.Equal(t, conditionReasonMergeCommitted, c.Reason)
		assert.Equal(t, nowRFC, c.LastTransitionTime)
		require.NotNil(t, c.Message)
	})

	t.Run("after SyncSucceeded: keeps timestamp, only the reason flips to MergeCommitted", func(t *testing.T) {
		prev := &alertingnotifv0alpha1.ConfigStatus{
			Conditions: []alertingnotifv0alpha1.ConfigCondition{{
				Type:               conditionTypeExternalAlertmanagerSynced,
				Status:             alertingnotifv0alpha1.ConfigConditionStatusTrue,
				LastTransitionTime: earlRFC,
				Reason:             conditionReasonSyncSucceeded,
			}},
		}

		c := findSynced(t, computeCommittedStatus(prev, "ds-1", originAPI, now))
		assert.Equal(t, alertingnotifv0alpha1.ConfigConditionStatusTrue, c.Status)
		assert.Equal(t, conditionReasonMergeCommitted, c.Reason)
		assert.Equal(t, earlRFC, c.LastTransitionTime, "status stayed True, so the synced-at timestamp is preserved")
	})

	t.Run("after a failure: advances timestamp on flip False->True", func(t *testing.T) {
		prev := &alertingnotifv0alpha1.ConfigStatus{
			Conditions: []alertingnotifv0alpha1.ConfigCondition{{
				Type:               conditionTypeExternalAlertmanagerSynced,
				Status:             alertingnotifv0alpha1.ConfigConditionStatusFalse,
				LastTransitionTime: earlRFC,
				Reason:             "MimirFetchFailed",
			}},
		}

		c := findSynced(t, computeCommittedStatus(prev, "ds-1", originAPI, now))
		assert.Equal(t, nowRFC, c.LastTransitionTime, "flip False->True advances the timestamp")
	})
}
