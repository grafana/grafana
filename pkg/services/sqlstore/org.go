package sqlstore

import (
	"context"
	"fmt"
	"time"

	"github.com/grafana/grafana/pkg/events"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/setting"
	"xorm.io/xorm"
)

// MainOrgName is the name of the main organization.
const MainOrgName = "Main Org."

func (ss *SQLStore) SearchOrgs(ctx context.Context, query *models.SearchOrgsQuery) error {
	return ss.WithDbSession(ctx, func(dbSession *DBSession) error {
		query.Result = make([]*models.OrgDTO, 0)
		sess := dbSession.Table("org")
		if query.Query != "" {
			sess.Where("name LIKE ?", query.Query+"%")
		}
		if query.Name != "" {
			sess.Where("name=?", query.Name)
		}

		if len(query.Ids) > 0 {
			sess.In("id", query.Ids)
		}

		if query.Limit > 0 {
			sess.Limit(query.Limit, query.Limit*query.Page)
		}

		sess.Cols("id", "name")
		err := sess.Find(&query.Result)
		return err
	})
}

func (ss *SQLStore) GetOrgById(ctx context.Context, query *models.GetOrgByIdQuery) error {
	return ss.WithDbSession(ctx, func(dbSession *DBSession) error {
		var org models.Org
		exists, err := dbSession.ID(query.Id).Get(&org)
		if err != nil {
			return err
		}

		if !exists {
			return models.ErrOrgNotFound
		}

		query.Result = &org
		return nil
	})
}

func (ss *SQLStore) GetOrgByNameHandler(ctx context.Context, query *models.GetOrgByNameQuery) error {
	return ss.WithDbSession(ctx, func(dbSession *DBSession) error {
		var org models.Org
		exists, err := dbSession.Where("name=?", query.Name).Get(&org)
		if err != nil {
			return err
		}

		if !exists {
			return models.ErrOrgNotFound
		}

		query.Result = &org
		return nil
	})
}

// GetOrgByName gets an organization by name.
func (ss *SQLStore) GetOrgByName(name string) (*models.Org, error) {
	var org models.Org
	exists, err := ss.engine.Where("name=?", name).Get(&org)
	if err != nil {
		return nil, err
	}
	if !exists {
		return nil, models.ErrOrgNotFound
	}

	return &org, nil
}

func isOrgNameTaken(name string, existingId int64, sess *DBSession) (bool, error) {
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

func createOrg(name string, userID int64, engine *xorm.Engine) (models.Org, error) {
	org := models.Org{
		Name:    name,
		Created: time.Now(),
		Updated: time.Now(),
	}
	if err := inTransactionWithRetryCtx(context.Background(), engine, func(sess *DBSession) error {
		if isNameTaken, err := isOrgNameTaken(name, 0, sess); err != nil {
			return err
		} else if isNameTaken {
			return models.ErrOrgNameTaken
		}

		if _, err := sess.Insert(&org); err != nil {
			return err
		}

		user := models.OrgUser{
			OrgId:   org.Id,
			UserId:  userID,
			Role:    models.ROLE_ADMIN,
			Created: time.Now(),
			Updated: time.Now(),
		}

		_, err := sess.Insert(&user)

		sess.publishAfterCommit(&events.OrgCreated{
			Timestamp: org.Created,
			Id:        org.Id,
			Name:      org.Name,
		})

		return err
	}, 0); err != nil {
		return org, err
	}

	return org, nil
}

// CreateOrgWithMember creates an organization with a certain name and a certain user as member.
func (ss *SQLStore) CreateOrgWithMember(name string, userID int64) (models.Org, error) {
	return createOrg(name, userID, ss.engine)
}

func (ss *SQLStore) CreateOrg(ctx context.Context, cmd *models.CreateOrgCommand) error {
	org, err := createOrg(cmd.Name, cmd.UserId, ss.engine)
	if err != nil {
		return err
	}

	cmd.Result = org
	return nil
}

func (ss *SQLStore) UpdateOrg(ctx context.Context, cmd *models.UpdateOrgCommand) error {
	return ss.WithTransactionalDbSession(ctx, func(sess *DBSession) error {
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

		sess.publishAfterCommit(&events.OrgUpdated{
			Timestamp: org.Updated,
			Id:        org.Id,
			Name:      org.Name,
		})

		return nil
	})
}

func (ss *SQLStore) UpdateOrgAddress(ctx context.Context, cmd *models.UpdateOrgAddressCommand) error {
	return ss.WithTransactionalDbSession(ctx, func(sess *DBSession) error {
		org := models.Org{
			Address1: cmd.Address1,
			Address2: cmd.Address2,
			City:     cmd.City,
			ZipCode:  cmd.ZipCode,
			State:    cmd.State,
			Country:  cmd.Country,

			Updated: time.Now(),
		}

		if _, err := sess.ID(cmd.OrgId).Update(&org); err != nil {
			return err
		}

		sess.publishAfterCommit(&events.OrgUpdated{
			Timestamp: org.Updated,
			Id:        org.Id,
			Name:      org.Name,
		})

		return nil
	})
}

func (ss *SQLStore) DeleteOrg(ctx context.Context, cmd *models.DeleteOrgCommand) error {
	return ss.WithTransactionalDbSession(ctx, func(sess *DBSession) error {
		if res, err := sess.Query("SELECT 1 from org WHERE id=?", cmd.Id); err != nil {
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
			_, err := sess.Exec(sql, cmd.Id)
			if err != nil {
				return err
			}
		}

		return nil
	})
}

func verifyExistingOrg(sess *DBSession, orgId int64) error {
	var org models.Org
	has, err := sess.Where("id=?", orgId).Get(&org)
	if err != nil {
		return err
	}
	if !has {
		return models.ErrOrgNotFound
	}
	return nil
}

func (ss *SQLStore) getOrCreateOrg(sess *DBSession, orgName string) (int64, error) {
	var org models.Org
	if ss.Cfg.AutoAssignOrg {
		has, err := sess.Where("id=?", ss.Cfg.AutoAssignOrgId).Get(&org)
		if err != nil {
			return 0, err
		}
		if has {
			return org.Id, nil
		}

		if ss.Cfg.AutoAssignOrgId != 1 {
			ss.log.Error("Could not create user: organization ID does not exist", "orgID",
				ss.Cfg.AutoAssignOrgId)
			return 0, fmt.Errorf("could not create user: organization ID %d does not exist",
				ss.Cfg.AutoAssignOrgId)
		}

		org.Name = MainOrgName
		org.Id = int64(ss.Cfg.AutoAssignOrgId)
	} else {
		org.Name = orgName
	}

	org.Created = time.Now()
	org.Updated = time.Now()

	if org.Id != 0 {
		if _, err := sess.InsertId(&org); err != nil {
			return 0, err
		}
	} else {
		if _, err := sess.InsertOne(&org); err != nil {
			return 0, err
		}
	}

	sess.publishAfterCommit(&events.OrgCreated{
		Timestamp: org.Created,
		Id:        org.Id,
		Name:      org.Name,
	})

	return org.Id, nil
}

func getOrCreateOrg(sess *DBSession, orgName string) (int64, error) {
	var org models.Org
	if setting.AutoAssignOrg {
		has, err := sess.Where("id=?", setting.AutoAssignOrgId).Get(&org)
		if err != nil {
			return 0, err
		}
		if has {
			return org.Id, nil
		}

		if setting.AutoAssignOrgId != 1 {
			sqlog.Error("Could not create user: organization ID does not exist", "orgID",
				setting.AutoAssignOrgId)
			return 0, fmt.Errorf("could not create user: organization ID %d does not exist",
				setting.AutoAssignOrgId)
		}

		org.Name = MainOrgName
		org.Id = int64(setting.AutoAssignOrgId)
	} else {
		org.Name = orgName
	}

	org.Created = time.Now()
	org.Updated = time.Now()

	if org.Id != 0 {
		if _, err := sess.InsertId(&org); err != nil {
			return 0, err
		}
	} else {
		if _, err := sess.InsertOne(&org); err != nil {
			return 0, err
		}
	}

	sess.publishAfterCommit(&events.OrgCreated{
		Timestamp: org.Created,
		Id:        org.Id,
		Name:      org.Name,
	})

	return org.Id, nil
}
