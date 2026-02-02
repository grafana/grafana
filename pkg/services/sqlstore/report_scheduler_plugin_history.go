package sqlstore

import (
	"context"
	"fmt"

	"github.com/grafana/grafana/pkg/bmc"
)

func (ss *SQLStore) GetReportHistory(ctx context.Context, query *bmc.GetReportHistory) error {
	return ss.WithDbSession(ctx, func(dbSession *DBSession) error {

		nonAdminCondition := ""
		if !query.IsAdmin {
			nonAdminCondition = fmt.Sprintf("AND user_id = %d", query.UserID)
		}
		// The Status value -2 for skipped is for No Data - Conditional Scheduling
		// COALESCE is being used as a fallback mechanism when we dont find data for a job in job_queue we pick it from job_status
		rawSQL := fmt.Sprintf(`SELECT job.id, job.started_at, COALESCE(job.description, status.description) AS description, job.elapsed_time,
		CASE
			WHEN COALESCE(job.value, status.value) = -1 THEN 'Failed'
			WHEN COALESCE(job.value, status.value) = -2 THEN 'Skipped'
			WHEN COALESCE(job.description, status.description) LIKE '3.%%' THEN 'Success'
			WHEN job.started_at + '1h' < NOW() THEN 'Failed'
			WHEN COALESCE(job.description, status.description) IS NOT NULL THEN 'Pending'
			ELSE 'Unknown' END as status,
		CASE
		  WHEN deleted=false AND file_key IS NOT NULL
		  THEN true ELSE false END as can_download
		FROM job_queue job
		LEFT JOIN (
		  SELECT job_queue_id, min(value) as value, max(description) as description
		  FROM job_status
		  GROUP BY job_queue_id
		) status ON status.job_queue_id = job.id
		JOIN report_data report ON report.id = job.report_data_id AND report.org_id = %d %s AND report.id = %d
		ORDER BY started_at DESC
		LIMIT 10`, query.OrgID, nonAdminCondition, query.ReportID)

		if err := dbSession.SQL(rawSQL).
			Find(&query.Results); err != nil {
			return err
		}

		return nil
	})
}
