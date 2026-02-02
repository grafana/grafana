package sqlstore

import (
	"context"

	"github.com/grafana/grafana/pkg/models"
)

func (ss *SQLStore) GetFTPConfig(ctx context.Context, query *models.GetFTPConfig) error {
	return ss.WithDbSession(ctx, func(dbSession *DBSession) error {
		results := make([]*models.FTPConfig, 0)

		sess := dbSession.Table("report_ftp_config").Where("report_ftp_config.id = ?", query.Id)

		if err := sess.Find(&results); err != nil {
			return err
		}
		if len(results) == 0 {
			query.Result = &models.FTPConfig{}
			return nil
		}
		query.Result = results[0]
		query.Result.HasPassword = query.Result.Password != ""
		query.Result.Password = ""
		return nil
	})
}

func (ss *SQLStore) GetFTPConfigs(ctx context.Context, query *models.GetFTPConfigs) error {
	return ss.WithDbSession(ctx, func(dbSession *DBSession) error {
		results := make([]*models.FTPConfig, 0)

		sess := dbSession.Table("report_ftp_config").Where("report_ftp_config.org_id = ?", query.OrgId)

		if err := sess.Find(&results); err != nil {
			return err
		}
		if len(results) == 0 {
			query.Result = results
			return nil
		}
		query.Result = results
		for _, v := range query.Result {
			v.HasPassword = v.Password != ""
			v.Password = ""
		}
		return nil
	})
}

func (ss *SQLStore) GetReportByFtpConfig(ctx context.Context, query *models.GetReportByFtpConfig) error {
	return ss.WithDbSession(ctx, func(dbSession *DBSession) error {
		count, _ := dbSession.Table("report_data").Where("report_ftp_config_id = ?", query.FtpConfigId).Count()

		if count == 0 {
			query.Result = nil
			return nil
		}

		query.Result = &count
		return nil
	})
}

func (ss *SQLStore) IsDefaultFtpConfig(ctx context.Context, query *models.IsDefaultFTPConfig) error {
	return ss.WithDbSession(ctx, func(dbSession *DBSession) error {
		count, _ := dbSession.Table("report_ftp_config").Where("id = ? and (default_ftp is true or default_ftp is NULL)", query.FtpConfigId).Count()

		if count == 0 {
			query.Result = nil
			return nil
		}

		query.Result = &count
		return nil
	})
}

func (ss *SQLStore) SetFTPConfig(ctx context.Context, cmd *models.SetFTPConfigCmd) error {
	configQuery := &models.GetFTPConfig{OrgId: cmd.OrgID}
	configQuery.Result = &models.FTPConfig{}

	if configQuery.Result.Id != 0 {
		err := ss.ModifyFTPConfig(ctx, &models.ModifyFTPConfigCmd{
			Id:       configQuery.Result.Id,
			OrgID:    cmd.OrgID,
			Host:     cmd.Host,
			Port:     cmd.Port,
			Username: cmd.Username,
			Password: cmd.Password,
		})
		return err
	}

	return ss.WithTransactionalDbSession(ctx, func(dbSession *DBSession) error {
		sess := dbSession.Table("report_ftp_config")
		_, err := sess.Insert(cmd)
		if err != nil {
			return err
		}
		return nil
	})
}

func (ss *SQLStore) SetDefaultFTPConfig(ctx context.Context, cmd *models.SetDefaultFTPConfigCmd) error {
	return ss.WithTransactionalDbSession(ctx, func(dbSession *DBSession) error {
		modify := &models.SetDefaultFTPConfigCmd{
			IsDefault: false,
		}
		sess := dbSession.Table("report_ftp_config")
		if _, err := sess.Table("report_ftp_config").Cols("default_ftp").Where("org_id = ? AND id != ?", cmd.OrgID, cmd.Id).Update(modify); err != nil {
			return err
		}
		modify = &models.SetDefaultFTPConfigCmd{
			IsDefault: true,
		}
		if _, err := sess.Table("report_ftp_config").Cols("default_ftp").Where("org_id = ? AND id = ?", cmd.OrgID, cmd.Id).Update(modify); err != nil {
			return err
		}
		return nil
	})
}

func (ss *SQLStore) ModifyFTPConfig(ctx context.Context, cmd *models.ModifyFTPConfigCmd) error {
	return ss.WithTransactionalDbSession(ctx, func(dbSession *DBSession) error {
		modify := &models.ModifyFTPConfigCmd{
			Id:       cmd.Id,
			OrgID:    cmd.OrgID,
			Host:     cmd.Host,
			Port:     cmd.Port,
			Username: cmd.Username,
			Password: cmd.Password,
		}
		sess := dbSession.Table("report_ftp_config")
		if _, err := sess.Table("report_ftp_config").
			Where("report_ftp_config.org_id = ?", cmd.OrgID).Where("report_ftp_config.id = ?", cmd.Id).Update(modify); err != nil {
			return err
		}

		return nil
	})
}

func (ss *SQLStore) DeleteFTPConfig(ctx context.Context, id, orgID int64) error {
	return ss.WithTransactionalDbSession(ctx, func(dbSession *DBSession) error {
		sess := dbSession.Table("report_ftp_config")
		if _, err := sess.Where("id = ? AND org_id = ?", id, orgID).Delete(new(models.FTPConfig)); err != nil {
			return err
		}
		return nil
	})
}
