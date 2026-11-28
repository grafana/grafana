package store

import (
	"context"
	"fmt"
	"time"

	"google.golang.org/protobuf/types/known/timestamppb"

	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/services/ngalert/state"
	pb "github.com/grafana/grafana/pkg/services/ngalert/store/proto/v1"
	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/grafana/grafana/pkg/services/sqlstore/migrator"
)

var _ state.RecordingSeriesStore = ProtoInstanceDBStore{}

// SaveRecordingSeriesForRule overwrites the row of the rule with its series.
// An empty set is saved as an empty row. A full sync does not keep rows for empty sets.
func (st ProtoInstanceDBStore) SaveRecordingSeriesForRule(ctx context.Context, key models.AlertRuleKeyWithGroup, series []models.RecordingSeries) error {
	compressed, err := convertAndCompressRuleState(nil, series)
	if err != nil {
		return fmt.Errorf("failed to compress recording series: %w", err)
	}

	if st.SQLStore.GetDBType() == migrator.MySQL {
		return st.SQLStore.WithDbSession(ctx, func(sess *sqlstore.DBSession) error {
			return st.updateThenUpsertCompressedAlertInstances(sess, key.OrgID, key.UID, compressed, time.Now())
		})
	}
	return st.SQLStore.WithTransactionalDbSession(ctx, func(sess *sqlstore.DBSession) error {
		return st.upsertCompressedAlertInstances(sess, key.OrgID, key.UID, compressed, time.Now())
	})
}

func (st ProtoInstanceDBStore) ListRecordingSeries(ctx context.Context, orgID int64) (map[string][]models.RecordingSeries, error) {
	result := make(map[string][]models.RecordingSeries)

	err := st.SQLStore.WithDbSession(ctx, func(sess *db.Session) error {
		rows := make([]compressedRuleStateRow, 0)
		if err := sess.SQL("SELECT rule_uid, data FROM alert_rule_state WHERE org_id = ?", orgID).Find(&rows); err != nil {
			return fmt.Errorf("failed to query alert_rule_state: %w", err)
		}

		for _, row := range rows {
			ruleState, err := decompressRuleState(row.Data)
			if err != nil {
				return fmt.Errorf("failed to decompress state for rule %s: %w", row.RuleUID, err)
			}
			if ruleState == nil || len(ruleState.Series) == 0 {
				continue
			}
			result[row.RuleUID] = recordingSeriesProtoToModels(ruleState.Series)
		}
		return nil
	})
	return result, err
}

// DeleteRecordingSeriesForRule drops only the series from the row. A rule that changed type
// keeps the alert state its new routine saved, even if the old routine deletes late.
func (st ProtoInstanceDBStore) DeleteRecordingSeriesForRule(ctx context.Context, key models.AlertRuleKeyWithGroup) error {
	return st.SQLStore.WithTransactionalDbSession(ctx, func(sess *sqlstore.DBSession) error {
		// The lock keeps a concurrent save of the same row from being overwritten by this read-modify-write.
		rows := make([]compressedRuleStateRow, 0, 1)
		if err := sess.Table("alert_rule_state").Where("org_id = ? AND rule_uid = ?", key.OrgID, key.UID).ForUpdate().Find(&rows); err != nil {
			return fmt.Errorf("failed to query alert_rule_state: %w", err)
		}
		if len(rows) == 0 {
			return nil
		}

		ruleState, err := decompressRuleState(rows[0].Data)
		if err != nil {
			return fmt.Errorf("failed to decompress state for rule %s: %w", key.UID, err)
		}
		if ruleState == nil || len(ruleState.Series) == 0 {
			return nil
		}

		if len(ruleState.Instances) == 0 {
			_, err := sess.Exec("DELETE FROM alert_rule_state WHERE org_id = ? AND rule_uid = ?", key.OrgID, key.UID)
			return err
		}
		compressed, err := compressRuleState(ruleState.Instances, nil)
		if err != nil {
			return fmt.Errorf("failed to compress alert instances: %w", err)
		}
		return st.upsertCompressedAlertInstances(sess, key.OrgID, key.UID, compressed, time.Now())
	})
}

func hasSeries(series map[models.AlertRuleKey][]models.RecordingSeries) bool {
	for _, set := range series {
		if len(set) > 0 {
			return true
		}
	}
	return false
}

type compressedRuleStateRow struct {
	OrgID   int64  `xorm:"org_id"`
	RuleUID string `xorm:"rule_uid"`
	Data    []byte `xorm:"data"`
}

func recordingSeriesModelsToProto(series []models.RecordingSeries) []*pb.RecordingSeries {
	if len(series) == 0 {
		return nil
	}
	out := make([]*pb.RecordingSeries, len(series))
	for i, s := range series {
		out[i] = &pb.RecordingSeries{
			TargetDatasourceUid: s.TargetDatasourceUID,
			Metric:              s.Metric,
			Labels:              s.Labels,
			LastUpdate:          timestamppb.New(s.LastUpdate),
		}
	}
	return out
}

func recordingSeriesProtoToModels(series []*pb.RecordingSeries) []models.RecordingSeries {
	out := make([]models.RecordingSeries, 0, len(series))
	for _, s := range series {
		out = append(out, models.RecordingSeries{
			TargetDatasourceUID: s.TargetDatasourceUid,
			Metric:              s.Metric,
			Labels:              s.Labels,
			LastUpdate:          s.LastUpdate.AsTime(),
		})
	}
	return out
}
