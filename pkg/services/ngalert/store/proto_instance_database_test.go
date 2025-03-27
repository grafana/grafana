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
		require.Equal(t, 10, modelType.NumField(), "AlertInstance model has changed, update the protobuf")
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

func toProtoTimestampPtr(tm *time.Time) *timestamppb.Timestamp {
	if tm == nil {
		return nil
	}

	return timestamppb.New(*tm)
}
