package sqlstore

import (
	"context"
	"fmt"
	"strings"
	"time"

	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/util"
	"github.com/lib/pq"
)

func (ss *SQLStore) GetAllRS(ctx context.Context, query *models.GetAll) error {
	return ss.WithDbSession(ctx, func(dbSession *DBSession) error {
		results := make([]*models.RSData, 0)

		sess := dbSession.Table("report_data").
			Join("LEFT", "report_scheduler", "report_scheduler.id = report_data.report_scheduler_id").
			Where("report_data.user_id = ?", query.UserId).
			Where("report_data.org_id = ?", query.OrgId).
			Where("report_data.name ILIKE ?", "%"+query.QueryName+"%").
			OrderBy("report_data.name")

		if query.QueryDashId != 0 {
			sess = sess.Where("report_data.dashboard_id = ?", query.QueryDashId)
		}

		if err := sess.
			Find(&results); err != nil {
			return err
		}

		query.Result = results
		return nil
	})
}
func (ss *SQLStore) GetRSById(ctx context.Context, query *models.GetById) error {
	return ss.WithDbSession(ctx, func(dbSession *DBSession) error {
		results := make([]*models.RSData, 0)
		queryString := dbSession.Table("report_data").
			Join("LEFT", "report_scheduler", "report_scheduler.id = report_data.report_scheduler_id").
			Where("report_data.org_id = ?", query.OrgId).
			Where("report_data.id = ?", query.Id)

		if !query.IsOrgAdmin {
			queryString = queryString.Where("report_data.user_id = ?", query.UserId)
		}

		if err := queryString.Find(&results); err != nil {
			return err
		}

		if len(results) == 0 {
			return models.ErrReportSchedulerNotFound
		}

		query.Result = results[0]
		return nil
	})
}
func (ss *SQLStore) GetRSByIds(ctx context.Context, query *models.GetByIds) error {
	return ss.WithDbSession(ctx, func(dbSession *DBSession) error {
		results := make([]*models.RSData, 0)

		queryString := dbSession.Table("report_data").
			Join("LEFT", "report_scheduler", "report_scheduler.id = report_data.report_scheduler_id").
			Where("report_data.org_id = ?", query.OrgId).
			In("report_data.id", query.Ids)

		if !query.IsOrgAdmin {
			queryString = queryString.Where("report_data.user_id = ?", query.UserId)
		}

		if err := queryString.Find(&results); err != nil {
			return err
		}

		if len(results) == 0 {
			return models.ErrReportSchedulerNotFound
		}

		query.Result = results
		return nil
	})
}
func (ss *SQLStore) GetRSByDashIds(ctx context.Context, query *models.GetByDashIds) error {
	return ss.WithDbSession(ctx, func(dbSession *DBSession) error {
		results := make([]*models.RSData, 0)
		if err := dbSession.Table("report_data").
			Join("LEFT", "report_scheduler", "report_scheduler.id = report_data.report_scheduler_id").
			In("report_data.dashboard_id", query.DashIds).
			Where("report_data.user_id = ?", query.UserId).
			Where("report_data.org_id = ?", query.OrgId).
			OrderBy("report_data.name").
			Find(&results); err != nil {
			return err
		}

		query.Result = results
		return nil
	})
}

func (ss *SQLStore) InsertRS(ctx context.Context, query *models.InsertRS) error {
	return ss.WithTransactionalDbSession(ctx, func(sess *DBSession) error {
		// Check if name exists
		if err := checkIfNameExists(sess, query.Data.Name, query.Data.OrgId, query.Data.UserId, query.Data.DashboardId); err != nil {
			return err
		}

		if err := insertScheduler(sess, query); err != nil {
			return err
			//return errors.New("error at report scheduler insertion")
		}
		if err := insertRSData(sess, query); err != nil {
			return err
			//return errors.New("error at report data insertion")
		}

		return nil
	})
}
func (ss *SQLStore) UpdateRS(ctx context.Context, query *models.UpdateRS) error {
	return ss.WithTransactionalDbSession(ctx, func(sess *DBSession) error {
		// Query the report by Id to know its name
		// Then compare the old name with the updated
		// name from queryParams if the condition is valid
		// that means it is required to check if the name
		// exists already or not
		selectOne := models.GetById{
			UserId:     query.UserId,
			OrgId:      query.Data.OrgId,
			Id:         query.Data.Id,
			IsOrgAdmin: query.IsOrgAdmin,
		}
		if err := ss.GetRSById(ctx, &selectOne); err != nil {
			return err
		}
		if query.Data.DashboardId != selectOne.Result.DashboardId {
			return models.ErrReportEditFailed
		}
		if query.Data.Name != selectOne.Result.Name {
			existing := models.RSData{}
			queryString := sess.Table("report_data").
				Select("name").
				Where("report_data.name = ?", query.Data.Name).
				Where("report_data.dashboard_id = ? ", query.Data.DashboardId)
			if !query.IsOrgAdmin {
				queryString = queryString.Where("report_data.user_id = ?", query.UserId)
			}
			has, _ := queryString.Get(&existing)
			if has {
				return models.ErrReportSchedulerNameExists
			}
		}

		query.Scheduler.Id = selectOne.Result.RSchedulerId
		if err := updateScheduler(sess, query); err != nil {
			return err
		}
		if err := updateRSData(sess, query); err != nil {
			return err
		}

		return nil

	})
}
func (ss *SQLStore) DeleteRS(ctx context.Context, query *models.DeleteRS) error {
	return ss.WithTransactionalDbSession(ctx, func(sess *DBSession) error {
		for _, Id := range query.Ids {
			report := &models.GetById{
				UserId:     query.UserId,
				OrgId:      query.OrgId,
				Id:         Id,
				IsOrgAdmin: query.IsOrgAdmin,
			}
			if err := ss.GetRSById(ctx, report); err != nil {
				return err
			}

			if err := deleteById(sess, "report_data", report.Result.Id); err != nil {
				return err
			}
			if err := deleteById(sess, "report_scheduler", report.Result.RSchedulerId); err != nil {
				return err
			}

			if err := deleteReportEmailRetryByReportId(sess, report.Result.Id); err != nil {
				return err
			}
		}
		return nil
	})
}

func (ss *SQLStore) DeleteUserFromRS(ctx context.Context, query *models.DeleteUserFromRS) error {
	return ss.WithTransactionalDbSession(ctx, func(sess *DBSession) error {
		//-- Remove 'query.EmailId' from recipients from a specific Tenant
		updateSQL := fmt.Sprintf(`UPDATE report_data
		SET recipients = (
			SELECT CASE WHEN string_agg(email, ';') IS NULL THEN '' ELSE string_agg(email, ';') END
			FROM (SELECT unnest(string_to_array(recipients, ';')) AS email) AS emails
			WHERE email != '%s'
		)
		WHERE recipients LIKE '%%%s%%' AND org_id=%d;`, query.EmailId, query.EmailId, query.OrgId)
		if _, err := sess.Exec(updateSQL); err != nil {
			return err
		}

		//-- Remove 'query.EmailId' from bcc_recipients from a specific Tenant
		updateSQL = fmt.Sprintf(`UPDATE report_data
		SET bcc_recipients = (
			SELECT CASE WHEN string_agg(email, ';') IS NULL THEN '' ELSE string_agg(email, ';') END
			FROM (SELECT unnest(string_to_array(bcc_recipients, ';')) AS email) AS emails
			WHERE email != '%s'
		)
		WHERE bcc_recipients LIKE '%%%s%%' AND org_id=%d;`, query.EmailId, query.EmailId, query.OrgId)
		if _, err := sess.Exec(updateSQL); err != nil {
			return err
		}

		//-- After recipient removal, when report have no more recipients, disable it.
		disableSQL := fmt.Sprintf(`UPDATE report_data SET enabled = false
		WHERE ((recipient_mode = 'static') AND (recipients IS NULL OR recipients = '') AND (bcc_recipients IS NULL OR bcc_recipients = '') AND (dynamic_recipient_dash_id IS NULL OR dynamic_recipient_dash_id = 0) AND schedule_type = 'email')`)

		//-- If user is completely deleted, disable his reports
		// DRJ71-16705
		// if query.HardDelete {
		// 	disableSQL += fmt.Sprintf(" OR user_id=%d", query.UserId)
		// }

		if _, err := sess.Exec(disableSQL); err != nil {
			return err
		}
		return nil
	})
}

// Todo: should add delete on cascade if dashboard is deleted.
func (ss *SQLStore) DeleteRSByDashIds(ctx context.Context, query *models.DeleteRSByDashIds) error {
	return ss.WithTransactionalDbSession(ctx, func(sess *DBSession) error {
		reports := &models.GetByDashIds{
			UserId:  query.UserId,
			OrgId:   query.OrgId,
			DashIds: query.Ids,
		}
		if err := ss.GetRSByDashIds(ctx, reports); err != nil {
			return err
		}

		for _, report := range reports.Result {
			if err := deleteById(sess, "report_data", report.Id); err != nil {
				return err
			}
			if err := deleteById(sess, "report_scheduler", report.RSchedulerId); err != nil {
				return err
			}
		}
		return nil
	})
}

func (ss *SQLStore) InsertRSJobQueue(ctx context.Context, query *models.InsertRSJobQueue) error {
	return ss.WithTransactionalDbSession(ctx, func(sess *DBSession) error {
		if _, err := sess.Table("job_queue").
			Insert(query); err != nil {
			return err
		}
		return nil
	})
}
func (ss *SQLStore) UpdateRSJobQueue(ctx context.Context, query *models.UpdateRSJobQueue) error {
	return ss.WithTransactionalDbSession(ctx, func(sess *DBSession) error {
		if _, err := sess.Table("job_queue").
			Where("job_queue.id = ?", query.Id).
			Update(query); err != nil {
			return err
		}
		return nil
	})
}
func (ss *SQLStore) InsertRSJobStatus(ctx context.Context, query *models.InsertRSJobStatus) error {
	return ss.WithTransactionalDbSession(ctx, func(sess *DBSession) error {
		if _, err := sess.Table("job_status").
			Insert(query); err != nil {
			return err
		}
		return nil
	})
}

func (ss *SQLStore) EnableRS(ctx context.Context, query *models.EnableRS) error {
	return ss.WithTransactionalDbSession(ctx, func(sess *DBSession) error {

		if len(query.Ids) == 0 {
			return models.ErrReportSchedulerListEmpty
		}
		reports := models.GetByIds{
			UserId:     query.UserId,
			OrgId:      query.OrgId,
			Ids:        query.Ids,
			IsOrgAdmin: query.IsOrgAdmin,
		}
		if err := ss.GetRSByIds(ctx, &reports); err != nil {
			return err
		}

		for _, report := range reports.Result {
			nextAt, _ := util.GetNextAt(report.RScheduler.Cron, report.RScheduler.Timezone)
			update := struct {
				Enabled   bool
				NextAt    int64
				UpdatedAt time.Time
			}{
				Enabled:   true,
				NextAt:    nextAt.Unix(),
				UpdatedAt: time.Now().UTC(),
			}

			QueryString := sess.Table("report_data").
				Where("report_data.id = ?", report.Id).
				UseBool("enabled")

			if !query.IsOrgAdmin {
				QueryString = QueryString.Where("report_data.user_id = ?", query.UserId)
			}
			if _, err := QueryString.Update(&update); err != nil {
				return err
			}
		}

		return nil
	})
}
func (ss *SQLStore) DisableRS(ctx context.Context, query *models.DisableRS) error {
	return ss.WithTransactionalDbSession(ctx, func(sess *DBSession) error {

		if len(query.Ids) == 0 {
			return models.ErrReportSchedulerListEmpty
		}

		update := struct{ Enabled bool }{Enabled: false}
		queryString := sess.Table("report_data").
			Where("report_data.org_id = ?", query.OrgId).
			In("report_data.id", query.Ids).
			UseBool("enabled")

		if !query.IsOrgAdmin {
			queryString = queryString.Where("report_data.user_id = ?", query.UserId)
		}
		if _, err := queryString.Update(&update); err != nil {
			return err
		}
		return nil
	})
}
func (ss *SQLStore) ExecuteRS(dashboardService dashboards.DashboardService, ctx context.Context, query *models.GetJobById) error {
	report := &models.GetById{
		UserId:     query.UserId,
		OrgId:      query.OrgId,
		Id:         query.Id,
		IsOrgAdmin: query.IsOrgAdmin,
	}
	err := ss.GetRSById(ctx, report)
	if err != nil {
		return err
	}

	dashQuery := &dashboards.GetDashboardQuery{
		ID:    report.Result.DashboardId,
		OrgID: report.Result.OrgId,
	}

	var dynamicRecipientDashUID string
	if report.Result.DynamicRecipientDashId > 0 {
		dynamicRecipientDashQuery := &dashboards.GetDashboardQuery{
			ID:    report.Result.DynamicRecipientDashId,
			OrgID: report.Result.OrgId,
		}

		dynamicRecipientDash, err := dashboardService.GetDashboard(ctx, dynamicRecipientDashQuery)
		if err != nil {
			return err
		}

		dynamicRecipientDashUID = dynamicRecipientDash.UID
	}

	dash, err := dashboardService.GetDashboard(ctx, dashQuery)
	if err != nil {
		return err
	}

	if report.Result.TimeRange == "" {
		timeRange, err := dash.Data.Get("time").Get("from").String()
		if err != nil {
			return err
		}
		report.Result.TimeRange = timeRange
	}

	result := report.Result
	query.Result = &models.ExecuteRS{
		Id:                      result.Id,
		Name:                    result.Name,
		Uid:                     dash.UID,
		DashName:                dash.Title,
		NextAt:                  result.NextAt.Int64,
		TimeRange:               result.TimeRange,
		TimeRangeTo:             result.TimeRangeTo,
		Filter:                  result.Filter,
		Orientation:             result.Orientation,
		Layout:                  result.Layout,
		TableScaling:            result.TableScaling,
		Enabled:                 result.Enabled,
		Timezone:                result.Timezone,
		Cron:                    result.Cron,
		Subject:                 result.Subject,
		Recipients:              result.Recipients,
		BCCRecipients:           result.BCCRecipients,
		ReplyTo:                 result.ReplyTo,
		Message:                 result.Message,
		Description:             result.Description,
		UserId:                  result.UserId,
		OrgId:                   result.OrgId,
		ReportType:              result.ReportType,
		ScheduleType:            result.ScheduleType,
		ServerDir:               result.ServerDir,
		HasDateStamp:            result.HasDateStamp,
		DateStampFormat:         result.DateStampFormat,
		HasTimeStamp:            result.HasTimeStamp,
		NoDataCondition:         result.NoDataCondition,
		CompressAttachment:      result.CompressAttachment,
		CSVDelimiter:            result.CSVDelimiter,
		ExportOptions:           result.ExportOptions,
		FtpConfigId:             result.FtpConfigId,
		IsDynamicBccRecipients:  result.IsDynamicBccRecipients,
		RecipientMode:           result.RecipientMode,
		DynamicRecipientDashUid: dynamicRecipientDashUID,
		DynamicBursting:         result.DynamicBursting,
	}

	return nil
}

func checkIfNameExists(sess *DBSession, name string, orgId int64, userId int64, dashId int64) error {
	existing := models.RSData{}
	if has, _ := sess.Table("report_data").
		Select("name").
		Where("report_data.org_id = ?", orgId).
		Where("report_data.user_id = ?", userId).
		Where("report_data.name = ?", name).
		Where("report_data.dashboard_id = ? ", dashId).
		Get(&existing); has {
		return models.ErrReportSchedulerNameExists
	}
	return nil
}
func checkIfIdsExists(sess *DBSession, ids []int64, orgId int64) error {
	// In case of duplicated IDs
	check := make(map[int64]int)
	reqIds := make([]int64, 0)
	for _, val := range ids {
		check[val] = 1
	}
	for id := range check {
		reqIds = append(reqIds, id)
	}

	results := make([]*models.RSData, 0)

	if err := sess.Table("report_data").
		Select("id").
		In("report_data.id", reqIds).
		Where("report_data.org_id = ?", orgId).
		Find(&results); err != nil {
		return models.ErrReportSchedulerNameExists
	}

	if len(results) != len(reqIds) {
		return models.ErrInvalidId
	}

	//resIds := make([]int64, 0)
	//for _, result := range results {
	//	resIds = append(resIds, result.Id)
	//}

	return nil
}

func insertRSData(sess *DBSession, query *models.InsertRS) error {
	if query == nil {
		return nil
	}
	query.Data.SchedulerId = query.Scheduler.Id
	if _, err := sess.Table("report_data").
		Insert(&query.Data); err != nil {
		return err
	}
	return nil
}
func insertScheduler(sess *DBSession, query *models.InsertRS) error {
	if query == nil {
		return nil
	}

	if _, err := sess.Table("report_scheduler").
		Insert(&query.Scheduler); err != nil {
		return err
	}

	return nil
}

func updateRSData(sess *DBSession, query *models.UpdateRS) error {
	if query == nil {
		return nil
	}

	nullable := []string{"filter", "time_range", "csv_delimiter"}
	if query.Data.ScheduleType == "email" {
		nullable = append(nullable, "recipients", "bcc_recipients")
	}

	query.Data.SchedulerId = query.Scheduler.Id
	if _, err := sess.Table("report_data").
		Where("report_data.id = ?", query.Data.Id).
		Nullable(nullable...).
		UseBool("has_date_stamp", "has_time_stamp", "no_data_condition", "compress_attachment", "table_scaling", "is_dynamic_bcc_recipients", "dynamic_bursting").
		Update(&query.Data); err != nil {
		return err
	}
	return nil
}
func updateScheduler(sess *DBSession, query *models.UpdateRS) error {
	if query == nil {
		return nil
	}

	if _, err := sess.Table("report_scheduler").
		Where("report_scheduler.id = ?", query.Scheduler.Id).
		Update(&query.Scheduler); err != nil {
		return err
	}

	return nil
}
func deleteById(sess *DBSession, table string, id int64) error {
	if id == 0 {
		return models.ErrInvalidId
	}
	if _, err := sess.Table(table).Delete(struct{ Id int64 }{Id: id}); err != nil {
		return nil
	}
	return nil
}

func deleteReportEmailRetryByReportId(sess *DBSession, id int64) error {
	if id == 0 {
		return models.ErrInvalidId
	}
	if _, err := sess.Table("report_email_retry").Delete(&struct {
		ReportID int64 `xorm:"'report_id'"`
	}{ReportID: id}); err != nil {
		return err
	}
	return nil
}

func (ss *SQLStore) RemoveOrDisableOrgSchedules(ctx context.Context, cmd *models.RemoveOrDisableOrgSchedules) error {
	return ss.WithTransactionalDbSession(ctx, func(sess *DBSession) error {
		if cmd.IsOffboarded {
			var rawSql = "DELETE from report_scheduler where id IN (select report_scheduler_id from report_data where org_id = ?)"
			_, err := sess.Exec(rawSql, cmd.OrgId)
			if err != nil {
				return err
			}
			rawSql = "DELETE FROM report_data WHERE org_id = ?"
			_, err = sess.Exec(rawSql, cmd.OrgId)
			if err != nil {
				return err
			}
		} else {
			var rawSql = "UPDATE report_data SET enabled=false where org_id = ? "
			_, err := sess.Exec(rawSql, cmd.OrgId)
			if err != nil {
				return err
			}
		}
		return nil
	})
}

func (ss *SQLStore) GetReportOrg(ctx context.Context, query *models.GetReportTenantDetails) error {
	return ss.WithDbSession(ctx, func(dbSession *DBSession) error {
		results := make([]*models.ReportTenantDetails, 0)
		if err := dbSession.Table("report_tenant_details").
			Where("report_tenant_details.org_id = ?", query.OrgId).
			Find(&results); err != nil {
			return err
		}

		if len(results) == 0 {
			return models.ErrReportTenantDetailsLimitNotFound
		}
		query.Result = results[0]
		return nil
	})
}
func (ss *SQLStore) CreateOrUpdateReportOrg(ctx context.Context, query *models.CreateOrUpdateReportTenantDetails) error {
	// If no error means has data.
	hasData := ss.GetReportOrg(ctx, &models.GetReportTenantDetails{OrgId: query.OrgId}) == nil
	return ss.WithTransactionalDbSession(ctx, func(sess *DBSession) error {
		if hasData {
			var sqlUpdates []string
			if query.Limit != 0 {
				update := fmt.Sprintf("\"limit\" = %d", query.Limit)
				sqlUpdates = append(sqlUpdates, update)
			}
			if query.Type != "" {
				update := fmt.Sprintf("\"type\" = '%v'", query.Type)
				sqlUpdates = append(sqlUpdates, update)
			}
			if len(sqlUpdates) == 0 {
				return nil
			}

			columnUpdates := strings.Join(sqlUpdates, ", ")
			whereCondition := fmt.Sprintf(" WHERE org_id = %d", query.OrgId)

			sqlQuery := "UPDATE report_tenant_details set " + columnUpdates + whereCondition

			_, err := sess.Exec(sqlQuery)
			return err
		} else {
			_, err := sess.Table("report_tenant_details").Insert(query)
			return err
		}
	})
}
func (ss *SQLStore) DeleteReportOrg(ctx context.Context, query *models.DeleteReportTenantDetails) error {
	return ss.WithTransactionalDbSession(ctx, func(sess *DBSession) error {
		if _, err := sess.Table("report_tenant_details").
			Delete(query); err != nil {
			return err
		}
		return nil
	})
}

func (ss *SQLStore) CountReportsByTenant(ctx context.Context, query *models.GetCountReportByTenant) error {
	return ss.WithDbSession(ctx, func(dbSession *DBSession) error {
		count, err := dbSession.Table("report_data").
			Where("report_data.org_id = ?", query.OrgId).
			Count()
		if err != nil {
			return err
		}
		query.Result = &count
		return nil
	})
}

func (ss *SQLStore) GetReportOwners(ctx context.Context, query *models.GetReportUsers) error {
	return ss.WithDbSession(ctx, func(dbSession *DBSession) error {
		results := make([]*models.ReportUsers, 0)

		sess := dbSession.Table("user").Alias("u").
			Join("INNER", "report_data", "u.id = report_data.user_id").
			Where("report_data.org_id = ?", query.OrgId)
		if query.MspTeamId > 0 {
			sess.Join("INNER", "team_member tm", "u.id = tm.user_id").
				And("tm.team_id = ?", query.MspTeamId)
		}
		sess.Distinct("u.id, u.name, u.login, u.email").
			OrderBy("u.name")

		if err := sess.
			Find(&results); err != nil {
			return err
		}

		query.Result = results
		return nil
	})
}

func (ss *SQLStore) UpdateReportsOwner(ctx context.Context, query *models.UpdateRSOwner) error {
	return ss.WithDbSession(ctx, func(dbSession *DBSession) error {
		var rawSql = "UPDATE report_data SET user_id= ? where org_id = ? and id=any(?)"
		_, err := dbSession.Exec(rawSql, query.OwnerId, query.OrgId, pq.Array(query.Ids))
		if err != nil {
			return err
		}
		return nil
	})
}

func (ss *SQLStore) GetReportUsers(ctx context.Context, query *models.GetReportUsers) error {
	return ss.WithDbSession(ctx, func(dbSession *DBSession) error {
		results := make([]*models.ReportUsers, 0)
		var rawSql string
		params := make([]interface{}, 0)
		whereClause := `WHERE ( brp.bhd_permission_name = 'administration.reports:manage' OR brp.bhd_permission_name = 'reports:access' ) AND u.org_id = ? `
		var userRoleSql = `SELECT DISTINCT u.id, u.name, u.email, u.login
						FROM ` + ss.dialect.Quote("user") + ` as u
						JOIN user_bhd_role ubr ON u.id = ubr.user_id
						JOIN bhd_role_permission brp ON ubr.bhd_role_id = brp.bhd_role_id `

		var userTeamRoleSql = `SELECT DISTINCT u.id, u.name, u.email, u.login
						FROM ` + ss.dialect.Quote("user") + ` as u
						JOIN team_member tm ON u.id = tm.user_id
						JOIN team_bhd_role tbr ON tm.team_id = tbr.team_id AND tm.org_id = tbr.org_id
						JOIN bhd_role_permission brp ON tbr.bhd_role_id = brp.bhd_role_id `
		var mspTeamFilter = ` JOIN team_member tm_filter 
  						ON tm_filter.user_id = u.id 
  						AND tm_filter.team_id = ? 
  						AND tm_filter.org_id = u.org_id `

		if query.MspTeamId > 0 {
			rawSql = userRoleSql + mspTeamFilter + whereClause + ` UNION ` + userTeamRoleSql + whereClause
			params = append(params, query.MspTeamId, query.OrgId, query.OrgId)
		} else {
			rawSql = userRoleSql + whereClause + ` UNION ` + userTeamRoleSql + whereClause
			params = append(params, query.OrgId, query.OrgId)
		}

		sess := dbSession.SQL(rawSql, params...)
		if err := sess.Find(&results); err != nil {
			return err
		}
		query.Result = results
		return nil
	})
}
