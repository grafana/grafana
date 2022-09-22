package orgimpl

import (
	"context"
	"time"

	"github.com/grafana/grafana/pkg/events"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/org"
	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/grafana/grafana/pkg/services/sqlstore/db"
	"github.com/grafana/grafana/pkg/services/sqlstore/migrator"
)

const MainOrgName = "Main Org."

type store interface {
	Get(context.Context, int64) (*org.Org, error)
	Insert(context.Context, *org.Org) (int64, error)
	InsertOrgUser(context.Context, *org.OrgUser) (int64, error)
	DeleteUserFromAll(context.Context, int64) error
	Update(ctx context.Context, cmd *org.UpdateOrgCommand) error

	// TO BE REFACTORED - move logic to service methods and leave CRUD methods for store
	UpdateAddress(context.Context, *org.UpdateOrgAddressCommand) error
	Delete(context.Context, *org.DeleteOrgCommand) error
}

type sqlStore struct {
	db      db.DB
	dialect migrator.Dialect
}

func (ss *sqlStore) Get(ctx context.Context, orgID int64) (*org.Org, error) {
	var orga org.Org
	err := ss.db.WithDbSession(ctx, func(sess *sqlstore.DBSession) error {
		has, err := sess.Where("id=?", orgID).Get(&orga)
		if err != nil {
			return err
		}
		if !has {
			return org.ErrOrgNotFound
		}
		return nil
	})
	if err != nil {
		return nil, err
	}
	return &orga, nil
}

func (ss *sqlStore) Insert(ctx context.Context, org *org.Org) (int64, error) {
	var orgID int64
	var err error
	err = ss.db.WithDbSession(ctx, func(sess *sqlstore.DBSession) error {
		if orgID, err = sess.InsertOne(org); err != nil {
			return err
		}
		if org.ID != 0 {
			// it sets the setval in the sequence
			if err := ss.dialect.PostInsertId("org", sess.Session); err != nil {
				return err
			}
		}
		sess.PublishAfterCommit(&events.OrgCreated{
			Timestamp: org.Created,
			Id:        org.ID,
			Name:      org.Name,
		})
		return nil
	})
	if err != nil {
		return 0, err
	}
	return orgID, nil
}

func (ss *sqlStore) InsertOrgUser(ctx context.Context, cmd *org.OrgUser) (int64, error) {
	var orgID int64
	var err error
	err = ss.db.WithDbSession(ctx, func(sess *sqlstore.DBSession) error {
		if orgID, err = sess.Insert(cmd); err != nil {
			return err
		}
		return nil
	})
	if err != nil {
		return 0, err
	}
	return orgID, nil
}

func (ss *sqlStore) DeleteUserFromAll(ctx context.Context, userID int64) error {
	return ss.db.WithDbSession(ctx, func(sess *sqlstore.DBSession) error {
		if _, err := sess.Exec("DELETE FROM org_user WHERE user_id = ?", userID); err != nil {
			return err
		}
		return nil
	})
}

func (ss *sqlStore) Update(ctx context.Context, cmd *org.UpdateOrgCommand) error {
	return ss.db.WithTransactionalDbSession(ctx, func(sess *sqlstore.DBSession) error {
		if isNameTaken, err := isOrgNameTaken(cmd.Name, cmd.OrgId, sess); err != nil {
			return err
		} else if isNameTaken {
			return models.ErrOrgNameTaken
		}

		org := models.Org{
			Name:    cmd.Name,
			Updated: time.Now(),
		}

		affectedRows, err := sess.ID(cmd.OrgId).Update(&org)

		if err != nil {
			return err
		}

		if affectedRows == 0 {
			return models.ErrOrgNotFound
		}

		sess.PublishAfterCommit(&events.OrgUpdated{
			Timestamp: org.Updated,
			Id:        org.Id,
			Name:      org.Name,
		})

		return nil
	})
}

func isOrgNameTaken(name string, existingId int64, sess *sqlstore.DBSession) (bool, error) {
	// check if org name is taken
	var org models.Org
	exists, err := sess.Where("name=?", name).Get(&org)

	if err != nil {
		return false, nil
	}

	if exists && existingId != org.Id {
		return true, nil
	}

	return false, nil
}

// TODO: refactor move logic to service method
func (ss *sqlStore) UpdateAddress(ctx context.Context, cmd *org.UpdateOrgAddressCommand) error {
	return ss.db.WithTransactionalDbSession(ctx, func(sess *sqlstore.DBSession) error {
		org := models.Org{
			Address1: cmd.Address1,
			Address2: cmd.Address2,
			City:     cmd.City,
			ZipCode:  cmd.ZipCode,
			State:    cmd.State,
			Country:  cmd.Country,

			Updated: time.Now(),
		}

		if _, err := sess.ID(cmd.OrgID).Update(&org); err != nil {
			return err
		}

		sess.PublishAfterCommit(&events.OrgUpdated{
			Timestamp: org.Updated,
			Id:        org.Id,
			Name:      org.Name,
		})

		return nil
	})
}

// TODO: refactor move logic to service method
func (ss *sqlStore) Delete(ctx context.Context, cmd *org.DeleteOrgCommand) error {
	return ss.db.WithTransactionalDbSession(ctx, func(sess *sqlstore.DBSession) error {
		if res, err := sess.Query("SELECT 1 from org WHERE id=?", cmd.ID); err != nil {
			return err
		} else if len(res) != 1 {
			return models.ErrOrgNotFound
		}

		deletes := []string{
			"DELETE FROM star WHERE EXISTS (SELECT 1 FROM dashboard WHERE org_id = ? AND star.dashboard_id = dashboard.id)",
			"DELETE FROM dashboard_tag WHERE EXISTS (SELECT 1 FROM dashboard WHERE org_id = ? AND dashboard_tag.dashboard_id = dashboard.id)",
			"DELETE FROM dashboard WHERE org_id = ?",
			"DELETE FROM api_key WHERE org_id = ?",
			"DELETE FROM data_source WHERE org_id = ?",
			"DELETE FROM org_user WHERE org_id = ?",
			"DELETE FROM org WHERE id = ?",
			"DELETE FROM temp_user WHERE org_id = ?",
			"DELETE FROM ngalert_configuration WHERE org_id = ?",
			"DELETE FROM alert_configuration WHERE org_id = ?",
			"DELETE FROM alert_instance WHERE rule_org_id = ?",
			"DELETE FROM alert_notification WHERE org_id = ?",
			"DELETE FROM alert_notification_state WHERE org_id = ?",
			"DELETE FROM alert_rule WHERE org_id = ?",
			"DELETE FROM alert_rule_tag WHERE EXISTS (SELECT 1 FROM alert WHERE alert.org_id = ? AND alert.id = alert_rule_tag.alert_id)",
			"DELETE FROM alert_rule_version WHERE rule_org_id = ?",
			"DELETE FROM alert WHERE org_id = ?",
			"DELETE FROM annotation WHERE org_id = ?",
			"DELETE FROM kv_store WHERE org_id = ?",
		}

		for _, sql := range deletes {
			_, err := sess.Exec(sql, cmd.ID)
			if err != nil {
				return err
			}
		}

		return nil
	})
}
