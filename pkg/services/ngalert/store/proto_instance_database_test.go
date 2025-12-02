package store

import (
	"reflect"
	"testing"
	"time"

	"github.com/stretchr/testify/require"
	"google.golang.org/protobuf/types/known/timestamppb"

	"github.com/grafana/grafana/pkg/services/ngalert/models"
	pb "github.com/grafana/grafana/pkg/services/ngalert/store/proto/v1"
)

func TestAlertInstanceModelToProto(t *testing.T) {
	currentStateSince := time.Now()
	currentStateEnd := currentStateSince.Add(time.Minute)
	lastEvalTime := currentStateSince.Add(-time.Minute)
	lastSentAt := currentStateSince.Add(-2 * time.Minute)
	firedAt := currentStateSince.Add(-2 * time.Minute)
	resolvedAt := currentStateSince.Add(-3 * time.Minute)

	tests := []struct {
		name     string
		input    models.AlertInstance
		expected *pb.AlertInstance
	}{
		{
			name: "valid instance",
			input: models.AlertInstance{
				Labels: map[string]string{"key": "value"},
				AlertInstanceKey: models.AlertInstanceKey{
					RuleUID:    "rule-uid-1",
					RuleOrgID:  1,
					LabelsHash: "hash123",
				},
				CurrentState:      models.InstanceStateFiring,
				CurrentStateSince: currentStateSince,
				CurrentStateEnd:   currentStateEnd,
				CurrentReason:     "Some reason",
				LastEvalTime:      lastEvalTime,
				LastSentAt:        &lastSentAt,
				FiredAt:           &firedAt,
				ResolvedAt:        &resolvedAt,
				ResultFingerprint: "fingerprint",
			},
			expected: &pb.AlertInstance{
				Labels:            map[string]string{"key": "value"},
				LabelsHash:        "hash123",
				CurrentState:      "Alerting",
				CurrentStateSince: timestamppb.New(currentStateSince),
				CurrentStateEnd:   timestamppb.New(currentStateEnd),
				CurrentReason:     "Some reason",
				LastEvalTime:      timestamppb.New(lastEvalTime),
				LastSentAt:        toProtoTimestampPtr(&lastSentAt),
				FiredAt:           toProtoTimestampPtr(&firedAt),
				ResolvedAt:        toProtoTimestampPtr(&resolvedAt),
				ResultFingerprint: "fingerprint",
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := alertInstanceModelToProto(tt.input)
			require.Equal(t, tt.expected, result)
		})
	}
}

func TestAlertInstanceProtoToModel(t *testing.T) {
	currentStateSince := time.Now().UTC()
	currentStateEnd := currentStateSince.Add(time.Minute).UTC()
	lastEvalTime := currentStateSince.Add(-time.Minute).UTC()
	lastSentAt := currentStateSince.Add(-2 * time.Minute).UTC()
	firedAt := currentStateSince.Add(-2 * time.Minute).UTC()
	resolvedAt := currentStateSince.Add(-3 * time.Minute).UTC()
	ruleUID := "rule-uid-1"
	orgID := int64(1)

	tests := []struct {
		name     string
		input    *pb.AlertInstance
		expected *models.AlertInstance
	}{
		{
			name: "valid instance",
			input: &pb.AlertInstance{
				Labels:            map[string]string{"key": "value"},
				LabelsHash:        "hash123",
				CurrentState:      "Alerting",
				CurrentStateSince: timestamppb.New(currentStateSince),
				CurrentStateEnd:   timestamppb.New(currentStateEnd),
				LastEvalTime:      timestamppb.New(lastEvalTime),
				LastSentAt:        toProtoTimestampPtr(&lastSentAt),
				FiredAt:           toProtoTimestampPtr(&firedAt),
				ResolvedAt:        toProtoTimestampPtr(&resolvedAt),
				ResultFingerprint: "fingerprint",
			},
			expected: &models.AlertInstance{
				Labels: map[string]string{"key": "value"},
				AlertInstanceKey: models.AlertInstanceKey{
					RuleUID:    ruleUID,
					RuleOrgID:  orgID,
					LabelsHash: "hash123",
				},
				CurrentState:      models.InstanceStateFiring,
				CurrentStateSince: currentStateSince,
				CurrentStateEnd:   currentStateEnd,
				LastEvalTime:      lastEvalTime,
				LastSentAt:        &lastSentAt,
				FiredAt:           &firedAt,
				ResolvedAt:        &resolvedAt,
				ResultFingerprint: "fingerprint",
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := alertInstanceProtoToModel(ruleUID, orgID, tt.input)
			require.Equal(t, tt.expected, result)
		})
	}
}

func TestModelAlertInstanceMatchesProtobuf(t *testing.T) {
	// The AlertInstance protobuf must always contain the same information
	// as the model, so that it's preserved between the Grafana restarts.
	//
	// If the AlertInstance model changes, review the protobuf and the test
	// and update them accordingly.
	t.Run("when AlertInstance model changes", func(t *testing.T) {
		modelType := reflect.TypeOf(models.AlertInstance{})
		require.Equal(t, 11, modelType.NumField(), "AlertInstance model has changed, update the protobuf")
	})
}

func TestCompressAndDecompressAlertInstances(t *testing.T) {
	now := time.Now()

	alertInstances := []*pb.AlertInstance{
		{
			Labels:            map[string]string{"label-1": "value-1"},
			LabelsHash:        "hash-1",
			CurrentState:      "normal",
			CurrentStateSince: timestamppb.New(now),
			CurrentStateEnd:   timestamppb.New(now.Add(time.Hour)),
			CurrentReason:     "reason-1",
			LastEvalTime:      timestamppb.New(now.Add(-time.Minute)),
			FiredAt:           timestamppb.New(now.Add(-time.Minute * 2)),
			ResolvedAt:        timestamppb.New(now.Add(time.Hour * 2)),
			ResultFingerprint: "fingerprint-1",
		},
		{
			Labels:            map[string]string{"label-2": "value-2"},
			LabelsHash:        "hash-2",
			CurrentState:      "firing",
			CurrentStateSince: timestamppb.New(now),
			CurrentReason:     "reason-2",
			LastEvalTime:      timestamppb.New(now.Add(-time.Minute * 2)),
		},
	}

	compressedData, err := compressAlertInstances(alertInstances)
	require.NoError(t, err)

	decompressedInstances, err := decompressAlertInstances(compressedData)
	require.NoError(t, err)

	// Compare the original and decompressed instances
	require.Equal(t, len(alertInstances), len(decompressedInstances))
	require.EqualExportedValues(t, alertInstances[0], decompressedInstances[0])
	require.EqualExportedValues(t, alertInstances[1], decompressedInstances[1])
}

func TestConvertAndCompressAlertInstances(t *testing.T) {
	now := time.Now()

	modelInstances := []models.AlertInstance{
		{
			AlertInstanceKey: models.AlertInstanceKey{
				RuleUID:    "rule-uid-1",
				RuleOrgID:  1,
				LabelsHash: "hash-1",
			},
			Labels:            map[string]string{"label-1": "value-1"},
			CurrentState:      models.InstanceStateFiring,
			CurrentStateSince: now,
			CurrentStateEnd:   now.Add(time.Hour),
			CurrentReason:     "reason-1",
			LastEvalTime:      now.Add(-time.Minute),
			LastSentAt:        &now,
			FiredAt:           &now,
			ResolvedAt:        nil,
			ResultFingerprint: "fingerprint-1",
		},
		{
			AlertInstanceKey: models.AlertInstanceKey{
				RuleUID:    "rule-uid-1",
				RuleOrgID:  1,
				LabelsHash: "hash-2",
			},
			Labels:            map[string]string{"label-2": "value-2"},
			CurrentState:      models.InstanceStateNormal,
			CurrentStateSince: now,
			CurrentStateEnd:   now.Add(time.Hour),
			CurrentReason:     "reason-2",
			LastEvalTime:      now.Add(-time.Minute),
			LastSentAt:        nil,
			FiredAt:           nil,
			ResolvedAt:        &now,
			ResultFingerprint: "fingerprint-2",
		},
	}

	compressedData, err := convertAndCompressAlertInstances(modelInstances)
	require.NoError(t, err)
	require.NotEmpty(t, compressedData)

	// Verify we can decompress and get back the same data
	decompressedInstances, err := decompressAlertInstances(compressedData)
	require.NoError(t, err)
	require.Len(t, decompressedInstances, 2)

	// Convert back to model to compare
	for i, protoInstance := range decompressedInstances {
		modelInstance := alertInstanceProtoToModel("rule-uid-1", 1, protoInstance)
		require.Equal(t, modelInstances[i].Labels, modelInstance.Labels)
		require.Equal(t, modelInstances[i].CurrentState, modelInstance.CurrentState)
		require.Equal(t, modelInstances[i].LabelsHash, modelInstance.LabelsHash)
		require.Equal(t, modelInstances[i].ResultFingerprint, modelInstance.ResultFingerprint)
	}
}

func TestConvertAndCompressAlertInstances_EmptyInput(t *testing.T) {
	emptyInstances := []models.AlertInstance{}

	compressedData, err := convertAndCompressAlertInstances(emptyInstances)
	require.NoError(t, err)

	decompressedInstances, err := decompressAlertInstances(compressedData)
	require.NoError(t, err)
	require.Empty(t, decompressedInstances)
}

func TestFullSyncGroupingLogic(t *testing.T) {
	now := time.Now()

	// Test instances from multiple rules to verify grouping logic
	instances := []models.AlertInstance{
		{
			AlertInstanceKey: models.AlertInstanceKey{
				RuleUID:    "rule-1",
				RuleOrgID:  1,
				LabelsHash: "hash-1-1",
			},
			Labels:            models.InstanceLabels{"rule1": "instance1"},
			CurrentState:      models.InstanceStateFiring,
			CurrentStateSince: now,
			CurrentStateEnd:   now.Add(time.Hour),
			CurrentReason:     "test reason 1",
			LastEvalTime:      now.Add(-time.Minute),
			ResultFingerprint: "fingerprint-1-1",
		},
		{
			AlertInstanceKey: models.AlertInstanceKey{
				RuleUID:    "rule-1",
				RuleOrgID:  1,
				LabelsHash: "hash-1-2",
			},
			Labels:            models.InstanceLabels{"rule1": "instance2"},
			CurrentState:      models.InstanceStateNormal,
			CurrentStateSince: now,
			CurrentStateEnd:   now.Add(time.Hour),
			CurrentReason:     "test reason 2",
			LastEvalTime:      now.Add(-time.Minute),
			ResultFingerprint: "fingerprint-1-2",
		},
		{
			AlertInstanceKey: models.AlertInstanceKey{
				RuleUID:    "rule-2",
				RuleOrgID:  1,
				LabelsHash: "hash-2-1",
			},
			Labels:            models.InstanceLabels{"rule2": "instance1"},
			CurrentState:      models.InstanceStatePending,
			CurrentStateSince: now,
			CurrentStateEnd:   now.Add(time.Hour),
			CurrentReason:     "test reason 3",
			LastEvalTime:      now.Add(-time.Minute),
			ResultFingerprint: "fingerprint-2-1",
		},
	}

	// Test the grouping logic that FullSync uses internally
	ruleGroups := make(map[models.AlertRuleKeyWithGroup][]models.AlertInstance)
	for _, instance := range instances {
		ruleKey := models.AlertRuleKeyWithGroup{
			AlertRuleKey: models.AlertRuleKey{
				OrgID: instance.RuleOrgID,
				UID:   instance.RuleUID,
			},
			RuleGroup: "",
		}
		ruleGroups[ruleKey] = append(ruleGroups[ruleKey], instance)
	}

	// Verify grouping worked correctly
	require.Len(t, ruleGroups, 2, "Should have 2 rule groups")

	rule1Key := models.AlertRuleKeyWithGroup{
		AlertRuleKey: models.AlertRuleKey{OrgID: 1, UID: "rule-1"},
		RuleGroup:    "",
	}
	rule2Key := models.AlertRuleKeyWithGroup{
		AlertRuleKey: models.AlertRuleKey{OrgID: 1, UID: "rule-2"},
		RuleGroup:    "",
	}

	require.Len(t, ruleGroups[rule1Key], 2, "Rule 1 should have 2 instances")
	require.Len(t, ruleGroups[rule2Key], 1, "Rule 2 should have 1 instance")

	// Test compression for each group
	for ruleKey, ruleInstances := range ruleGroups {
		compressedData, err := convertAndCompressAlertInstances(ruleInstances)
		require.NoError(t, err, "Compression should succeed for rule %s", ruleKey.UID)
		require.NotEmpty(t, compressedData, "Compressed data should not be empty for rule %s", ruleKey.UID)

		// Verify decompression works
		decompressedInstances, err := decompressAlertInstances(compressedData)
		require.NoError(t, err, "Decompression should succeed for rule %s", ruleKey.UID)
		require.Len(t, decompressedInstances, len(ruleInstances), "Should have same number of instances after decompression for rule %s", ruleKey.UID)
	}
}

func toProtoTimestampPtr(tm *time.Time) *timestamppb.Timestamp {
	if tm == nil {
		return nil
	}

	return timestamppb.New(*tm)
}
