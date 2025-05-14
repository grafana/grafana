package migrations

import (
	"fmt"

	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"xorm.io/builder"
	"xorm.io/xorm"

	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/sqlstore/migrator"
)

type deletionMarkerMigrator struct {
	migrator.MigrationBase
}

func (m *deletionMarkerMigrator) SQL(dialect migrator.Dialect) string {
	return `Find rows in resource_history with value LIKE {"kind":"DeletedMarker"%`
}

func (m *deletionMarkerMigrator) Exec(sess *xorm.Session, mg *migrator.Migrator) error {
	logger := log.New("deletion-marker-migrator")
	type model struct {
		GUID       string `xorm:"guid"`
		Value      string `xorm:"value"`
		Group      string `xorm:"group"`
		Resource   string `xorm:"resource"`
		PreviousRV string `xorm:"previous_resource_version"`
	}
	var models []model

	logger.Info("finding any deletion markers")
	err := sess.Table("resource_history").
		Cols("guid", "value", "group", "resource", "previous_resource_version").
		Where("action = 3").And("value LIKE ?", `{"kind":"DeletedMarker"%`).
		Find(&models)
	if err != nil {
		return err
	}

	if len(models) > 0 {
		logger.Info("updating markers with a real resource", "count", len(models))
		for _, row := range models {
			tmp := &model{}
			_ = sess.Table("resource_history").Conds().And(builder.Eq(map[string]any{
				"group":            row.Group,
				"resource":         row.Resource,
				"resource_version": row.PreviousRV,
			}))
			ok, err := sess.Get(tmp)
			if err != nil {
				return err
			}
			if ok && len(tmp.Value) > 1 {
				previous := &unstructured.Unstructured{}
				err = previous.UnmarshalJSON([]byte(tmp.Value))
				if err != nil {
					return err
				}

				marker := &unstructured.Unstructured{}
				err = marker.UnmarshalJSON([]byte(row.Value))
				if err != nil {
					return err
				}

				// 3. Prepare a new payload
				metaMarker, _ := utils.MetaAccessor(marker)
				metaPrev, _ := utils.MetaAccessor(previous)
				metaPrev.SetDeletionTimestamp(metaMarker.GetDeletionTimestamp())
				metaPrev.SetFinalizers(nil)
				metaPrev.SetManagedFields(nil)
				metaPrev.SetGeneration(utils.DeletedGeneration)
				metaPrev.SetAnnotation(utils.AnnoKeyKubectlLastAppliedConfig, "") // clears it
				ts, _ := metaMarker.GetUpdatedTimestamp()
				if ts != nil {
					metaPrev.SetUpdatedTimestamp(ts)
				}
				buff, err := previous.MarshalJSON()
				if err != nil {
					return err
				}

				count, err := sess.Table("resource_history").Update(&model{
					Value: string(buff),
				}, &model{
					GUID: row.GUID,
				})
				if err != nil {
					return err
				}
				if count == 1 {
					logger.Info("Updated", "GUID", row.GUID)
				} else {
					return fmt.Errorf("error updating")
				}
			} else {
				_, err := sess.Table("resource_history").Delete(&model{
					GUID: row.GUID,
				})
				if err != nil {
					return err
				}
				logger.Info("Removed", "GUID", row.GUID)
			}
		}
	}
	return nil
}
