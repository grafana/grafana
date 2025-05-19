package usermig

import (
	"fmt"

	"github.com/grafana/grafana/pkg/services/sqlstore/migrator"
	"github.com/grafana/grafana/pkg/util/xorm"
)

const (
	AllowSameLoginCrossOrgs = "update login field with orgid to allow for multiple service accounts with same name across orgs"
	DedupOrgInLogin         = "update service accounts login field orgid to appear only once"
)

// Service accounts login were not unique per org. this migration is part of making it unique per org
// to be able to create service accounts that are unique per org
func AddServiceAccountsAllowSameLoginCrossOrgs(mg *migrator.Migrator) {
	mg.AddMigration(AllowSameLoginCrossOrgs, &ServiceAccountsSameLoginCrossOrgs{})
}

var _ migrator.CodeMigration = new(ServiceAccountsSameLoginCrossOrgs)

type ServiceAccountsSameLoginCrossOrgs struct {
	sess    *xorm.Session
	dialect migrator.Dialect
	migrator.MigrationBase
}

func (p *ServiceAccountsSameLoginCrossOrgs) SQL(dialect migrator.Dialect) string {
	return "code migration"
}

func (p *ServiceAccountsSameLoginCrossOrgs) Exec(sess *xorm.Session, mg *migrator.Migrator) error {
	p.sess = sess
	p.dialect = mg.Dialect
	var err error
	switch p.dialect.DriverName() {
	case migrator.Postgres:
		_, err = p.sess.Exec(`
            UPDATE "user"
            SET login = 'sa-' || org_id::text || '-' ||
                CASE
                    WHEN login LIKE 'sa-%' THEN SUBSTRING(login FROM 4)
                    ELSE login
                END
            WHERE login IS NOT NULL
              AND is_service_account = true
              AND login NOT LIKE 'sa-' || org_id::text || '-%';
        `)
	case migrator.MySQL:
		_, err = p.sess.Exec(`
            UPDATE user
            SET login = CONCAT('sa-', CAST(org_id AS CHAR), '-',
                CASE
                    WHEN login LIKE 'sa-%' THEN SUBSTRING(login, 4)
                    ELSE login
                END
            )
            WHERE login IS NOT NULL
              AND is_service_account = 1
              AND login NOT LIKE CONCAT('sa-', org_id, '-%');
        `)
	case migrator.SQLite:
		_, err = p.sess.Exec(`
            UPDATE ` + p.dialect.Quote("user") + `
            SET login = 'sa-' || CAST(org_id AS TEXT) || '-' ||
                CASE
                    WHEN SUBSTR(login, 1, 3) = 'sa-' THEN SUBSTR(login, 4)
                    ELSE login
                END
            WHERE login IS NOT NULL
              AND is_service_account = 1
              AND login NOT LIKE 'sa-' || CAST(org_id AS TEXT) || '-%';
        `)
	case migrator.Spanner:
		_, err = p.sess.Exec(`
            UPDATE user
            SET login = CONCAT('sa-', CAST(org_id AS STRING), '-',
                CASE
                    WHEN login LIKE 'sa-%' THEN SUBSTRING(login, 4)
                    ELSE login
                END
            )
            WHERE login IS NOT NULL
              AND is_service_account
              AND login NOT LIKE CONCAT('sa-', CAST(org_id AS STRING), '-%')
        `)

	default:
		return fmt.Errorf("dialect not supported: %s", p.dialect)
	}
	return err
}

type ServiceAccountsDeduplicateOrgInLogin struct {
	migrator.MigrationBase
}

func (p *ServiceAccountsDeduplicateOrgInLogin) SQL(dialect migrator.Dialect) string {
	return "code migration"
}

func (p *ServiceAccountsDeduplicateOrgInLogin) Exec(sess *xorm.Session, mg *migrator.Migrator) error {
	dialect := mg.Dialect
	var err error

	// var logins []Login
	switch dialect.DriverName() {
	case migrator.Postgres:
		_, err = sess.Exec(`
            UPDATE "user" AS u
            SET login = 'sa-' || org_id::text || SUBSTRING(login FROM LENGTH('sa-' || org_id::text || '-' || org_id::text)+1)
            WHERE login IS NOT NULL
              AND is_service_account = true
              AND login LIKE 'sa-' || org_id::text || '-' || org_id::text || '-%'
              AND NOT EXISTS (
                SELECT 1
                FROM "user" AS u2
                WHERE u2.login = 'sa-' || u.org_id::text || SUBSTRING(u.login FROM LENGTH('sa-' || u.org_id::text || '-' || u.org_id::text)+1)
            );;
        `)
	case migrator.MySQL:
		_, err = sess.Exec(`
            UPDATE user AS u
            LEFT JOIN user AS u2 ON u2.login = CONCAT('sa-', u.org_id, SUBSTRING(u.login, LENGTH(CONCAT('sa-', u.org_id, '-', u.org_id))+1))
            SET u.login = CONCAT('sa-', u.org_id, SUBSTRING(u.login, LENGTH(CONCAT('sa-', u.org_id, '-', u.org_id))+1))
            WHERE u.login IS NOT NULL
                AND u.is_service_account = 1
                AND u.login LIKE CONCAT('sa-', u.org_id, '-', u.org_id, '-%')
                AND u2.login IS NULL;
        `)
	case migrator.SQLite:
		_, err = sess.Exec(`
            UPDATE ` + dialect.Quote("user") + ` AS u
            SET login = 'sa-' || CAST(u.org_id AS TEXT) || SUBSTRING(u.login, LENGTH('sa-'||CAST(u.org_id AS TEXT)||'-'||CAST(u.org_id AS TEXT))+1)
            WHERE u.login IS NOT NULL
                AND u.is_service_account = 1
                AND u.login LIKE 'sa-'||CAST(u.org_id AS TEXT)||'-'||CAST(u.org_id AS TEXT)||'-%'
                AND NOT EXISTS (
                    SELECT 1
                    FROM  ` + dialect.Quote("user") + `AS u2
                    WHERE u2.login = 'sa-' || CAST(u.org_id AS TEXT) || SUBSTRING(u.login, LENGTH('sa-'||CAST(u.org_id AS TEXT)||'-'||CAST(u.org_id AS TEXT))+1)
                );;
        `)
	case migrator.Spanner:
		_, err = sess.Exec(`
            UPDATE ` + dialect.Quote("user") + ` AS u
            SET login = 'sa-' || CAST(u.org_id AS STRING) || SUBSTRING(u.login, LENGTH('sa-'||CAST(u.org_id AS STRING)||'-'||CAST(u.org_id AS STRING))+1)
            WHERE u.login IS NOT NULL
                AND u.is_service_account
                AND u.login LIKE 'sa-'||CAST(u.org_id AS STRING)||'-'||CAST(u.org_id AS STRING)||'-%'
                AND NOT EXISTS (
                    SELECT 1
                    FROM  ` + dialect.Quote("user") + `AS u2
                    WHERE u2.login = 'sa-' || CAST(u.org_id AS STRING) || SUBSTRING(u.login, LENGTH('sa-'||CAST(u.org_id AS STRING)||'-'||CAST(u.org_id AS STRING))+1)
                );;
        `)
	default:
		return fmt.Errorf("dialect not supported: %s", dialect)
	}

	return err
}
