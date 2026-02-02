package sqlstore

import (
	"context"
	"fmt"
	"html"

	"github.com/grafana/grafana/pkg/models"
)

func (ss *SQLStore) GetReportListJobQueue(ctx context.Context, query *models.GetReportListJobQueue) error {
	filterByUser := ""
	if !query.Auth.IsOrgAdmin {
		filterByUser = fmt.Sprintf("AND r.user_id = %d", query.Auth.UserID)
	}
	query.Query = fmt.Sprintf("%%%s%%", html.EscapeString(query.Query))
	return ss.WithDbSession(ctx, func(dbSession *DBSession) error {
		results := make([]*models.RSReportInfo, 0)
		rawSql := fmt.Sprintf(`SELECT r.id, map.job_id, r.name, r.report_type, r.schedule_type, r.enabled, d.title, d.uid,
		r.created_at, r.updated_at, r.next_at, r.last_at, u.name as created_by, u.id as user_id,
		t.count_runs, f.count_fail,COALESCE(j.description, s.description) as last_fail, j.file_key, j.deleted,COALESCE(j.value,s.value), dj.dynamic_recipients, r.is_dynamic_bcc_recipients, r.dynamic_bursting,
		CASE WHEN last_at = 0 THEN 'none' WHEN COALESCE(j.value, s.value) = -1 THEN 'fail' WHEN COALESCE(j.value,s.value) = -2 THEN 'skipped' ELSE 'success' END as state
		FROM (
			SELECT last_runs.report_id, last_runs.job_id, max(job_status.id) as status_id
		FROM job_queue j
		INNER JOIN (
			SELECT max(j.id) as job_id, j.report_data_id as report_id
			FROM job_queue j
			GROUP BY 2
		) last_runs ON last_runs.job_id = j.id
		LEFT JOIN job_status ON job_id = job_status.job_queue_id
		GROUP BY 1,2
		) map
		LEFT JOIN report_data r ON r.id = map.report_id
		LEFT JOIN job_queue j ON j.id = map.job_id AND (j.value = -1 OR j.value = -2)
		LEFT JOIN job_queue dj ON dj.id = map.job_id
		LEFT JOIN job_status s ON s.id = map.status_id AND (s.value = -1 OR s.value = -2)
		LEFT JOIN "user" u ON u.id = r.user_id
		LEFT JOIN dashboard d ON d.id = r.dashboard_id
		LEFT JOIN (
			SELECT r.id, count(*) as count_fail
				FROM job_queue
				LEFT JOIN job_status s ON s.job_queue_id = job_queue.id
				LEFT JOIN report_data r ON job_queue.report_data_id = r.id
				WHERE COALESCE(job_queue.value, s.value) != 1 AND COALESCE(job_queue.value, s.value) != -2
				GROUP BY 1
		) f ON f.id = r.id
		LEFT JOIN (
			SELECT q.report_data_id as id, count(*) as count_runs
		FROM job_queue q
		GROUP BY 1
		) t ON t.id = r.id
		WHERE r.name ILIKE '%v'
		%s
		AND r.org_id = %d`, query.Query, filterByUser, query.Auth.OrgID)
		err := dbSession.SQL(rawSql).
			Find(&results)
		if err != nil {
			return err
		}
		for i, result := range results {
			results[i].Deleted = result.Deleted || result.FileKey == ""
		}
		query.Result = results
		return nil
	})
}

func (ss *SQLStore) GetRSJobQueueByJobId(ctx context.Context, query *models.GetRSJobQueueByJobId) error {
	return ss.WithDbSession(ctx, func(dbSession *DBSession) error {
		queue := &models.RSJobQueue{}

		sess := dbSession.Table("job_queue").
			Join("RIGHT", "report_data", "report_data.id = job_queue.report_data_id").
			Where("report_data.org_id = ?", query.Auth.OrgID).
			Where("job_queue.id = ?", query.JobId)

		if !query.Auth.IsOrgAdmin {
			sess.Where("report_data.user_id = ?", query.Auth.UserID)
		}

		_, err := sess.Get(queue)
		if err != nil {
			return err
		}

		queue.Deleted = queue.Deleted || queue.FileKey == ""

		status := make([]*models.RSJobStatus, 0)
		err = dbSession.Table("job_status").
			Where("job_status.job_queue_id = ?", queue.Id).
			OrderBy("job_status.description ASC").
			Find(&status)
		if err != nil {
			return err
		}
		job := &models.GetRSJobQueue{}
		job.Queue = queue
		job.Status = status

		query.Result = job
		return nil
	})
}
