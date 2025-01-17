package store

import (
	"testing"
	"time"

	"github.com/stretchr/testify/require"
	"google.golang.org/protobuf/types/known/timestamppb"

	"github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/services/ngalert/store/pb"
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
				Labels: map[string]string{"key": "value"},
				Key: &pb.AlertInstanceKey{
					RuleUid:    "rule-uid-1",
					RuleOrgId:  1,
					LabelsHash: "hash123",
				},
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

	tests := []struct {
		name     string
		input    *pb.AlertInstance
		expected *models.AlertInstance
	}{
		{
			name: "valid instance",
			input: &pb.AlertInstance{
				Labels: map[string]string{"key": "value"},
				Key: &pb.AlertInstanceKey{
					RuleUid:    "rule-uid-1",
					RuleOrgId:  1,
					LabelsHash: "hash123",
				},
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
					RuleUID:    "rule-uid-1",
					RuleOrgID:  1,
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
			result := alertInstanceProtoToModel(tt.input)
			require.Equal(t, tt.expected, result)
		})
	}
}

func toProtoTimestampPtr(tm *time.Time) *timestamppb.Timestamp {
	if tm == nil {
		return nil
	}

	return timestamppb.New(*tm)
}
