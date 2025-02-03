package store

import (
	"bytes"
	"context"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/golang/snappy"
	"google.golang.org/protobuf/proto"
	"google.golang.org/protobuf/types/known/timestamppb"

	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/ngalert/models"
	pb "github.com/grafana/grafana/pkg/services/ngalert/store/proto/v1"
)

// ProtoInstanceDBStore is a store for alert instances that stores state of a rule as a single
// row in the database with alert instances as a compressed protobuf message.
type ProtoInstanceDBStore struct {
	SQLStore       db.DB
	Logger         log.Logger
	FeatureToggles featuremgmt.FeatureToggles
}

func (st ProtoInstanceDBStore) ListAlertInstances(ctx context.Context, cmd *models.ListAlertInstancesQuery) (result []*models.AlertInstance, err error) {
	logger := st.Logger.FromContext(ctx)
	logger.Debug("ListAlertInstances called", "rule_uid", cmd.RuleUID, "org_id", cmd.RuleOrgID)
	alertInstances := make([]*models.AlertInstance, 0)

	err = st.SQLStore.WithDbSession(ctx, func(sess *db.Session) error {
		s := strings.Builder{}
		params := make([]any, 0)

		addToQuery := func(stmt string, p ...any) {
			s.WriteString(stmt)
			params = append(params, p...)
		}

		addToQuery("SELECT * FROM alert_rule_state WHERE org_id = ?", cmd.RuleOrgID)

		if cmd.RuleUID != "" {
			addToQuery(" AND rule_uid = ?", cmd.RuleUID)
		}

		// Execute query to get compressed instances
		type compressedRow struct {
			OrgID   int64  `xorm:"org_id"`
			RuleUID string `xorm:"rule_uid"`
			Data    []byte `xorm:"data"`
		}

		rows := make([]compressedRow, 0)
		if err := sess.SQL(s.String(), params...).Find(&rows); err != nil {
			return fmt.Errorf("failed to query alert_rule_state: %w", err)
		}

		for _, row := range rows {
			instances, err := decompressAlertInstances(row.Data)
			if err != nil {
				return fmt.Errorf("failed to decompress alert instances for rule %s: %w", row.RuleUID, err)
			}

			// Convert proto instances to model instances
			for _, protoInstance := range instances {
				modelInstance := alertInstanceProtoToModel(row.RuleUID, row.OrgID, protoInstance)
				if modelInstance == nil {
					continue
				}
				alertInstances = append(alertInstances, modelInstance)
			}
		}

		return nil
	})

	logger.Debug("ListAlertInstances completed", "instances", len(alertInstances))

	return alertInstances, err
}

func (st ProtoInstanceDBStore) SaveAlertInstance(ctx context.Context, alertInstance models.AlertInstance) error {
	st.Logger.Error("SaveAlertInstance called and not implemented")
	return errors.New("save alert instance is not implemented for proto instance database store")
}

func (st ProtoInstanceDBStore) DeleteAlertInstances(ctx context.Context, keys ...models.AlertInstanceKey) error {
	logger := st.Logger.FromContext(ctx)
	logger.Error("DeleteAlertInstances called and not implemented")
	return errors.New("delete alert instances is not implemented for proto instance database store")
}

func (st ProtoInstanceDBStore) SaveAlertInstancesForRule(ctx context.Context, key models.AlertRuleKeyWithGroup, instances []models.AlertInstance) error {
	logger := st.Logger.FromContext(ctx)
	logger.Debug("SaveAlertInstancesForRule called", "rule_uid", key.UID, "org_id", key.OrgID, "instances", len(instances))

	alert_instances_proto := make([]*pb.AlertInstance, len(instances))

	for i, instance := range instances {
		alert_instances_proto[i] = alertInstanceModelToProto(instance)
	}

	compressedAlertInstances, err := compressAlertInstances(alert_instances_proto)
	if err != nil {
		return fmt.Errorf("failed to compress alert instances: %w", err)
	}

	return st.SQLStore.WithTransactionalDbSession(ctx, func(sess *db.Session) error {
		params := []any{key.OrgID, key.UID, compressedAlertInstances, time.Now()}

		upsertSQL := st.SQLStore.GetDialect().UpsertSQL(
			"alert_rule_state",
			[]string{"org_id", "rule_uid"},
			[]string{"org_id", "rule_uid", "data", "updated_at"},
		)
		_, err = sess.SQL(upsertSQL, params...).Query()

		return err
	})
}

func (st ProtoInstanceDBStore) DeleteAlertInstancesByRule(ctx context.Context, key models.AlertRuleKeyWithGroup) error {
	logger := st.Logger.FromContext(ctx)
	logger.Debug("DeleteAlertInstancesByRule called", "rule_uid", key.UID, "org_id", key.OrgID)

	return st.SQLStore.WithTransactionalDbSession(ctx, func(sess *db.Session) error {
		_, err := sess.Exec("DELETE FROM alert_rule_state WHERE org_id = ? AND rule_uid = ?", key.OrgID, key.UID)
		return err
	})
}

func (st ProtoInstanceDBStore) FullSync(ctx context.Context, instances []models.AlertInstance, batchSize int) error {
	logger := st.Logger.FromContext(ctx)
	logger.Error("FullSync called and not implemented")
	return errors.New("fullsync is not implemented for proto instance database store")
}

func alertInstanceModelToProto(modelInstance models.AlertInstance) *pb.AlertInstance {
	return &pb.AlertInstance{
		Labels:            modelInstance.Labels,
		LabelsHash:        modelInstance.LabelsHash,
		CurrentState:      string(modelInstance.CurrentState),
		CurrentStateSince: timestamppb.New(modelInstance.CurrentStateSince),
		CurrentStateEnd:   timestamppb.New(modelInstance.CurrentStateEnd),
		CurrentReason:     modelInstance.CurrentReason,
		LastEvalTime:      timestamppb.New(modelInstance.LastEvalTime),
		LastSentAt:        nullableTimeToTimestamp(modelInstance.LastSentAt),
		ResolvedAt:        nullableTimeToTimestamp(modelInstance.ResolvedAt),
		ResultFingerprint: modelInstance.ResultFingerprint,
	}
}

func compressAlertInstances(instances []*pb.AlertInstance) ([]byte, error) {
	mProto, err := proto.Marshal(&pb.AlertInstances{Instances: instances})
	if err != nil {
		return nil, fmt.Errorf("failed to marshal protobuf: %w", err)
	}

	var b bytes.Buffer
	writer := snappy.NewBufferedWriter(&b)
	if _, err := writer.Write(mProto); err != nil {
		return nil, fmt.Errorf("failed to write compressed data: %w", err)
	}

	if err := writer.Close(); err != nil {
		return nil, fmt.Errorf("failed to close snappy writer: %w", err)
	}

	return b.Bytes(), nil
}

func alertInstanceProtoToModel(ruleUID string, ruleOrgID int64, protoInstance *pb.AlertInstance) *models.AlertInstance {
	if protoInstance == nil {
		return nil
	}

	return &models.AlertInstance{
		AlertInstanceKey: models.AlertInstanceKey{
			RuleOrgID:  ruleOrgID,
			RuleUID:    ruleUID,
			LabelsHash: protoInstance.LabelsHash,
		},
		Labels:            protoInstance.Labels,
		CurrentState:      models.InstanceStateType(protoInstance.CurrentState),
		CurrentStateSince: protoInstance.CurrentStateSince.AsTime(),
		CurrentStateEnd:   protoInstance.CurrentStateEnd.AsTime(),
		CurrentReason:     protoInstance.CurrentReason,
		LastEvalTime:      protoInstance.LastEvalTime.AsTime(),
		LastSentAt:        nullableTimestampToTime(protoInstance.LastSentAt),
		ResolvedAt:        nullableTimestampToTime(protoInstance.ResolvedAt),
		ResultFingerprint: protoInstance.ResultFingerprint,
	}
}

func decompressAlertInstances(compressed []byte) ([]*pb.AlertInstance, error) {
	if len(compressed) == 0 {
		return nil, nil
	}

	reader := snappy.NewReader(bytes.NewReader(compressed))
	var b bytes.Buffer
	if _, err := b.ReadFrom(reader); err != nil {
		return nil, fmt.Errorf("failed to read compressed data: %w", err)
	}

	var instances pb.AlertInstances
	if err := proto.Unmarshal(b.Bytes(), &instances); err != nil {
		return nil, fmt.Errorf("failed to unmarshal protobuf: %w", err)
	}

	return instances.Instances, nil
}

// nullableTimeToTimestamp converts a nullable time.Time to nil, if it is nil, otherwise it converts to timestamppb.Timestamp.
func nullableTimeToTimestamp(t *time.Time) *timestamppb.Timestamp {
	if t == nil {
		return nil
	}
	return timestamppb.New(*t)
}

// nullableTimestampToTime converts a nullable timestamppb.Timestamp to nil, if it is nil, otherwise it converts to time.Time.
func nullableTimestampToTime(ts *timestamppb.Timestamp) *time.Time {
	if ts == nil {
		return nil
	}
	t := ts.AsTime()
	return &t
}
