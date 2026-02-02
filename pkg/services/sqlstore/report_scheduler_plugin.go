package sqlstore

import (
	"context"
	"errors"
	"fmt"
	"html"
	"strings"

	"github.com/grafana/grafana/pkg/bmc"
)

func (ss *SQLStore) GetAllReports(ctx context.Context, query *bmc.GetAllReports) error {
	return ss.WithDbSession(ctx, func(dbSession *DBSession) error {
		results := make([]*bmc.ReportModel, 0)
		query.QueryName = html.EscapeString(query.QueryName)
		rawSql := fmt.Sprintf(`SELECT r.id, r.name, r.description, d.dash_id, d.dash_title, d.dash_uid,
			r.report_type, r.schedule_type, r.time_range, r.time_range_to, r.filter, r.subject, r.message, r.recipients, r.bcc_recipients,
			r.layout, r.orientation, rs.cron, rs.timezone, u.user_id, u.user_name, u.user_email,
			r.created_at, r.updated_at, r.next_at, r.last_at, r.enabled, r.has_date_stamp, r.has_time_stamp, r.no_data_condition,
			r.is_dynamic_bcc_recipients, r.dynamic_bursting, r.recipient_mode, r.date_stamp_format,
	        cd.dash_id AS dynamic_recipient_dash_id, cd.dash_title AS dynamic_recipient_dash_title, cd.dash_uid AS dynamic_recipient_dash_uid
			FROM report_data r
			LEFT JOIN report_scheduler rs ON r.report_scheduler_id = rs.id
			LEFT JOIN ( SELECT id as dash_id, title as dash_title, uid as dash_uid FROM dashboard ) d ON r.dashboard_id = d.dash_id
			LEFT JOIN ( SELECT id as dash_id, title as dash_title, uid as dash_uid FROM dashboard ) cd ON r.dynamic_recipient_dash_id = cd.dash_id
			LEFT JOIN ( SELECT id as user_id, name as user_name, email as user_email FROM "user") u ON r.user_id = u.user_id
			WHERE r.org_id = %d AND r.name ILIKE '%s'`, query.Auth.OrgID, "%"+query.QueryName+"%")

		if !query.Auth.IsOrgAdmin {
			//Return orphan dashboards if user id is -1
			if query.Auth.UserID == -1 {
				rawSql = fmt.Sprintf("%s AND u.user_id is NULL", rawSql)
			} else {
				rawSql = fmt.Sprintf("%s AND r.user_id = %d", rawSql, query.Auth.UserID)
			}
		}

		err := dbSession.SQL(rawSql).Find(&results)

		if err != nil {
			return errors.New("Failed to get reports")
		}

		query.Result = results
		return nil
	})
}

func (ss *SQLStore) GetReportByID(ctx context.Context, query *bmc.GetReportByID) error {
	return ss.WithDbSession(ctx, func(dbSession *DBSession) error {
		results := make([]*bmc.ReportModel, 0)

		sql := `SELECT r.id, r.name, r.description, d.dash_id, d.dash_title, d.dash_uid,
       		r.report_type, r.schedule_type, r.server_dir, r.time_range, r.time_range_to, r.filter,
			r.subject, r.message, r.recipients, r.bcc_recipients, r.layout, r.orientation, rs.cron, rs.timezone,
			u.user_id, u.user_name, u.user_email, r.created_at, r.updated_at, r.next_at, r.last_at, 
			r.enabled, r.has_date_stamp, r.has_time_stamp, r.compress_attachment, r.no_data_condition, r.is_dynamic_bcc_recipients, r.dynamic_bursting, r.recipient_mode,
			cd.dash_id AS dynamic_recipient_dash_id, cd.dash_title AS dynamic_recipient_dash_title, cd.dash_uid AS dynamic_recipient_dash_uid,
 			r.csv_delimiter, r.report_ftp_config_id, r.table_scaling, r.date_stamp_format, r.export_options
			FROM report_data r
			LEFT JOIN report_scheduler rs ON r.report_scheduler_id = rs.id
			LEFT JOIN ( SELECT id as dash_id, title as dash_title, uid as dash_uid FROM dashboard  ) d ON r.dashboard_id = d.dash_id
			LEFT JOIN ( SELECT id as dash_id, title as dash_title, uid as dash_uid FROM dashboard ) cd ON r.dynamic_recipient_dash_id = cd.dash_id
			LEFT JOIN ( SELECT id as user_id, name as user_name, email as user_email FROM "user") u ON r.user_id = u.user_id`

		conditions := make([]string, 0)
		conditions = append(conditions, fmt.Sprintf("r.id = %d", query.ID))
		conditions = append(conditions, fmt.Sprintf("r.org_id = %d", query.Auth.OrgID))
		if !query.Auth.IsOrgAdmin {
			conditions = append(conditions, fmt.Sprintf("r.user_id = %d", query.Auth.UserID))
		}
		sql += " WHERE " + strings.Join(conditions, " AND ")
		sess := dbSession.SQL(sql)

		if err := sess.Find(&results); err != nil {
			return err
		}

		if len(results) == 0 {
			return fmt.Errorf("Report not found")
		}

		query.Result = results[0]
		return nil
	})
}

func (ss *SQLStore) GetReportJobQueue(ctx context.Context, query *bmc.GetReportJobQueue) error {
	return ss.WithDbSession(ctx, func(dbSession *DBSession) error {
		results := make([]*bmc.ReportJobQueue, 0)
		err := dbSession.Table("job_queue").
			Join("RIGHT", "report_data", "report_data.id = job_queue.report_data_id").
			Where("report_data.org_id = ?", query.OrgID).
			Where("job_queue.id = ?", query.JobID).
			Find(&results)
		if err != nil {
			return err
		}
		if len(results) == 0 {
			return fmt.Errorf("Report job not found")
		}
		query.Result = results[0]
		return err
	})
}
