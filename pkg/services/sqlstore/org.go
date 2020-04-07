package sqlstore

import (
	"context"
	"fmt"
	"time"

	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/events"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/setting"
)

const mainOrgName = "Main Org."

func init() {
	bus.AddHandler("sql", GetOrgById)
	bus.AddHandler("sql", CreateOrg)
	bus.AddHandler("sql", UpdateOrg)
	bus.AddHandler("sql", UpdateOrgAddress)
	bus.AddHandler("sql", GetOrgByName)
	bus.AddHandler("sql", SearchOrgs)
	bus.AddHandler("sql", DeleteOrg)
}

func SearchOrgs(query *models.SearchOrgsQuery) error {
	query.Result = make([]*models.OrgDTO, 0)
	sess := x.Table("org")
	if query.Query != "" {
		sess.Where("name LIKE ?", query.Query+"%")
	}
	if query.Name != "" {
		sess.Where("name=?", query.Name)
	}

	if len(query.Ids) > 0 {
		sess.In("id", query.Ids)
	}

	sess.Limit(query.Limit, query.Limit*query.Page)
	sess.Cols("id", "name")
	err := sess.Find(&query.Result)
	return err
}

func GetOrgById(query *models.GetOrgByIdQuery) error {
	var org models.Org
	exists, err := x.Id(query.Id).Get(&org)
	if err != nil {
		return err
	}

	if !exists {
		return models.ErrOrgNotFound
	}

	query.Result = &org
	return nil
}

func GetOrgByName(query *models.GetOrgByNameQuery) error {
	var org models.Org
	exists, err := x.Where("name=?", query.Name).Get(&org)
	if err != nil {
		return err
	}

	if !exists {
		return models.ErrOrgNotFound
	}

	query.Result = &org
	return nil
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

func CreateOrg(cmd *models.CreateOrgCommand) error {
	return inTransaction(func(sess *DBSession) error {

		if isNameTaken, err := isOrgNameTaken(cmd.Name, 0, sess); err != nil {
			return err
		} else if isNameTaken {
			return models.ErrOrgNameTaken
		}

		org := models.Org{
			Name:    cmd.Name,
			Created: time.Now(),
			Updated: time.Now(),
		}

		if _, err := sess.Insert(&org); err != nil {
			return err
		}

		user := models.OrgUser{
			OrgId:   org.Id,
			UserId:  cmd.UserId,
			Role:    models.ROLE_ADMIN,
			Created: time.Now(),
			Updated: time.Now(),
		}

		_, err := sess.Insert(&user)
		cmd.Result = org

		sess.publishAfterCommit(&events.OrgCreated{
			Timestamp: org.Created,
			Id:        org.Id,
			Name:      org.Name,
		})

		return err
	})
}

func UpdateOrg(cmd *models.UpdateOrgCommand) error {
	return inTransaction(func(sess *DBSession) error {

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

func UpdateOrgAddress(cmd *models.UpdateOrgAddressCommand) error {
	return inTransaction(func(sess *DBSession) error {
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

func DeleteOrg(cmd *models.DeleteOrgCommand) error {
	return inTransaction(func(sess *DBSession) error {
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
		if setting.AutoAssignOrgId == 1 {
			org.Name = mainOrgName
			org.Id = int64(setting.AutoAssignOrgId)
		} else {
			sqlog.Info("Could not create user: organization id %v does not exist",
				setting.AutoAssignOrgId)
			return 0, fmt.Errorf("Could not create user: organization id %v does not exist",
				setting.AutoAssignOrgId)
		}
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

func createDefaultOrg(ctx context.Context) error {
	return inTransactionCtx(ctx, func(sess *DBSession) error {
		_, err := getOrCreateOrg(sess, mainOrgName)
		if err != nil {
			return err
		}

		return nil
	})
}
