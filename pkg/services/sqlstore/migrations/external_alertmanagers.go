package migrations

import (
	"fmt"
	"net/url"
	"time"

	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/services/datasources"
	ngmodels "github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/services/sqlstore/migrations/ualert"
	"github.com/grafana/grafana/pkg/services/sqlstore/migrator"
	"github.com/grafana/grafana/pkg/util"
	"xorm.io/xorm"
)

func AddExternalAlertmanagerToDatasourceMigration(mg *migrator.Migrator) {
	mg.AddMigration("migrate external alertmanagers to datsourcse", &externalAlertmanagerToDatasources{})
}

type externalAlertmanagerToDatasources struct {
	migrator.MigrationBase
}

// Copy old AdminConficuration struct as the new one has not attribute Alertmanagers []string anymore
// Path: https://github.com/grafana/grafana/pull/57918/files#diff-c7fe73b0fa4aeffb895ee6b5eeb2fab9c6113fd334f07bc2175295c82f73dbb2L30
type AdminConfiguration struct {
	ID    int64 `xorm:"pk autoincr 'id'"`
	OrgID int64 `xorm:"org_id"`

	Alertmanagers []string

	// SendAlertsTo indicates which set of alertmanagers will handle the alert.
	SendAlertsTo ngmodels.AlertmanagersChoice `xorm:"send_alerts_to"`

	CreatedAt int64 `xorm:"created"`
	UpdatedAt int64 `xorm:"updated"`
}

func (e externalAlertmanagerToDatasources) SQL(dialect migrator.Dialect) string {
	return "migrate external alertmanagers to datasource"
}

func (e externalAlertmanagerToDatasources) Exec(sess *xorm.Session, mg *migrator.Migrator) error {
	var results []AdminConfiguration
	err := sess.SQL("SELECT org_id, alertmanagers FROM ngalert_configuration").Find(&results)
	if err != nil {
		return err
	}

	for _, result := range results {
		for _, am := range removeDuplicates(result.Alertmanagers) {
			u, err := url.Parse(am)
			if err != nil {
				return err
			}
			uri := fmt.Sprintf("%s://%s%s", u.Scheme, u.Host, u.Path)

			uid, err := generateNewDatasourceUid(sess, result.OrgID)
			if err != nil {
				return err
			}
			ds := &datasources.DataSource{
				OrgId:   result.OrgID,
				Name:    fmt.Sprintf("alertmanager-%s", uid),
				Type:    "alertmanager",
				Access:  "proxy",
				Url:     uri,
				Created: time.Unix(result.CreatedAt, 0),
				Updated: time.Unix(result.UpdatedAt, 0),
				Uid:     uid,
				Version: 1,
				JsonData: simplejson.NewFromAny(map[string]interface{}{
					"handleGrafanaManagedAlerts": true,
					"implementation":             "prometheus",
				}),
				SecureJsonData: map[string][]byte{},
			}

			if u.User != nil {
				ds.BasicAuth = true
				ds.BasicAuthUser = u.User.Username()
				if password, ok := u.User.Password(); ok {
					ds.SecureJsonData = ualert.GetEncryptedJsonData(map[string]string{
						"basicAuthPassword": password,
					})
				}
			}

			rowsAffected, err := sess.Table("data_source").Insert(ds)
			if err != nil {
				return err
			}
			if rowsAffected == 0 {
				return fmt.Errorf("expected 1 row, got %d", rowsAffected)
			}
		}
	}

	return nil
}

func removeDuplicates(strs []string) []string {
	var res []string
	found := map[string]bool{}

	for _, str := range strs {
		if found[str] {
			continue
		}
		found[str] = true
		res = append(res, str)
	}
	return res
}

func generateNewDatasourceUid(sess *xorm.Session, orgId int64) (string, error) {
	for i := 0; i < 3; i++ {
		uid := util.GenerateShortUID()

		exists, err := sess.Table("data_source").Where("uid = ? AND org_id = ?", uid, orgId).Exist()
		if err != nil {
			return "", err
		}

		if !exists {
			return uid, nil
		}
	}

	return "", datasources.ErrDataSourceFailedGenerateUniqueUid
}
