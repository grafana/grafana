package user

import (
	"fmt"

	"github.com/grafana/grafana/pkg/services/sqlstore/migrator"
	"xorm.io/xorm"
)

const (
	AllowSameLoginCrossOrgs = "update login field with orgid to allow for multiple service accounts with same name across orgs"
)

// Service accounts login were not unique per org. this migration is part of making it unique per org
// to be able to create service accounts that are unique per org
func AddServiceAccountsAllowSameLoginCrossOrgs(mg *migrator.Migrator) {
	mg.AddMigration(AllowSameLoginCrossOrgs, &serviceAccountsSameLoginCrossOrgs{})
}

var _ migrator.CodeMigration = new(serviceAccountsSameLoginCrossOrgs)

type serviceAccountsSameLoginCrossOrgs struct {
	sess    *xorm.Session
	dialect migrator.Dialect
	migrator.MigrationBase
}

func (p *serviceAccountsSameLoginCrossOrgs) SQL(dialect migrator.Dialect) string {
	return "code migration"
}

func (p *serviceAccountsSameLoginCrossOrgs) Exec(sess *xorm.Session, mg *migrator.Migrator) error {
	fmt.Printf("Executing migration %s\n", AllowSameLoginCrossOrgs)
	p.sess = sess
	p.dialect = mg.Dialect
	var err error
	switch p.dialect.DriverName() {
	case migrator.Postgres:
		fmt.Printf("SQLite not supported for migration %s\n", AllowSameLoginCrossOrgs)
		_, err = p.sess.Exec(`UPDATE "user"
		SET login = 'sa-' || org_id::text || '-' || 
		CASE 
		  WHEN login LIKE 'sa-%' THEN SUBSTRING(login FROM 4) 
		  ELSE login 
		END 
		WHERE login IS NOT NULL AND is_service_account = true;`,
		)
	case migrator.MySQL:
		fmt.Printf("SQLite not supported for migration %s\n", AllowSameLoginCrossOrgs)
		_, err = p.sess.Exec(`UPDATE user
		SET login = CONCAT('sa-', CAST(org_id AS CHAR), '-',
		CASE
		  WHEN login LIKE 'sa-%' THEN SUBSTRING(login, 4)
		  ELSE login
		END)
		WHERE login IS NOT NULL AND is_service_account = 1;`,
		)
	case migrator.SQLite:
		fmt.Printf("SQLite not supported for migration %s\n", AllowSameLoginCrossOrgs)
		_, err = p.sess.Exec(`Update ` + p.dialect.Quote("user") + `
		SET login = 'sa-' || CAST(org_id AS TEXT) || '-' ||
		CASE
			WHEN SUBSTR(login, 1, 3) = 'sa-' THEN SUBSTR(login, 4)
			ELSE login
		END
		WHERE login IS NOT NULL AND is_service_account = 1;`,
		)
	default:
		return fmt.Errorf("dialect not supported: %s", p.dialect)
	}
	return err
}
