package migrations

import (
	"fmt"
	"net/url"
	"os"
	"time"

	"github.com/grafana/grafana/pkg/util/xorm"

	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/datasources"
	"github.com/grafana/grafana/pkg/services/sqlstore/migrator"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/util"
)

func AddExternalAlertmanagerToDatasourceMigration(mg *migrator.Migrator) {
	mg.AddMigration("migrate external alertmanagers to datsourcse", &externalAlertmanagerToDatasources{})
}

type externalAlertmanagerToDatasources struct {
	migrator.MigrationBase
}

type AdminConfiguration struct {
	OrgID int64 `xorm:"org_id"`

	Alertmanagers []string

	CreatedAt int64 `xorm:"created_at"`
	UpdatedAt int64 `xorm:"updated_at"`
}

func (e externalAlertmanagerToDatasources) SQL(dialect migrator.Dialect) string {
	return "migrate external alertmanagers to datasource"
}

func (e externalAlertmanagerToDatasources) Exec(sess *xorm.Session, mg *migrator.Migrator) error {
	var results []AdminConfiguration
	err := sess.SQL("SELECT org_id, alertmanagers, created_at, updated_at FROM ngalert_configuration").Find(&results)
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
				OrgID:   result.OrgID,
				Name:    fmt.Sprintf("alertmanager-%s", uid),
				Type:    "alertmanager",
				Access:  "proxy",
				URL:     uri,
				Created: time.Unix(result.CreatedAt, 0),
				Updated: time.Unix(result.UpdatedAt, 0),
				UID:     uid,
				Version: 1,
				JsonData: simplejson.NewFromAny(map[string]any{
					"handleGrafanaManagedAlerts": true,
					"implementation":             "prometheus",
				}),
				SecureJsonData: map[string][]byte{},
			}

			if u.User != nil {
				ds.BasicAuth = true
				ds.BasicAuthUser = u.User.Username()
				if password, ok := u.User.Password(); ok {
					ds.SecureJsonData = getEncryptedJsonData(mg.Cfg, map[string]string{
						"basicAuthPassword": password,
					}, log.New("securejsondata"))
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
	found := make(map[string]bool, len(strs))
	res := make([]string, 0, len(strs))
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

// SecureJsonData is used to store encrypted data (for example in data_source table). Only values are separately
// encrypted.
type secureJsonData map[string][]byte

// getEncryptedJsonData returns map where all keys are encrypted.
func getEncryptedJsonData(cfg *setting.Cfg, sjd map[string]string, log log.Logger) secureJsonData {
	encrypted := make(secureJsonData)
	for key, data := range sjd {
		encryptedData, err := util.Encrypt([]byte(data), cfg.SecretKey)
		if err != nil {
			log.Error(err.Error())
			os.Exit(1)
		}

		encrypted[key] = encryptedData
	}
	return encrypted
}
