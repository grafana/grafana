package sql

import (
	"testing"

	"github.com/stretchr/testify/require"
)

func TestAllowQuery(t *testing.T) {
	testCases := []struct {
		name string
		q    string
		err  error
	}{
		{
			name: "a big catch all for now",
			q:    example_metrics_query,
			err:  nil,
		},
		{
			name: "an example from todd",
			q:    example_argo_commit_example,
			err:  nil,
		},
	}
	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			_, err := AllowQuery(tc.q)
			if tc.err != nil {
				require.Error(t, err)
			} else {
				require.NoError(t, err)
			}
		})
	}
}

var example_metrics_query = `WITH
  metrics_this_month AS (
    SELECT
      Month,
      namespace,
      sum(BillableSeries) AS billable_series
    FROM metrics
    WHERE
      Month = "2024-11"
    GROUP BY 
      Month,
      namespace
    ORDER BY billable_series DESC
  ),
  total_metrics AS (
    SELECT SUM(billable_series) AS metrics_billable_series_total
    FROM metrics_this_month
  ),
  total_traces AS (
    -- "usage" is a reserved keyword in MySQL. Quote it with backticks.
    SELECT SUM(value) AS traces_usage_total
    FROM traces
  ),
  usage_by_team AS (
    SELECT
      COALESCE(teams.team, 'unaccounted') AS team,
      1 + 0 AS team_count,
      -- Metrics
      SUM(COALESCE(metrics_this_month.billable_series, 0)) AS metrics_billable_series,
      -- Traces
      SUM(COALESCE(traces.value, 0)) AS traces_usage
    -- FROM teams
    -- FULL OUTER JOIN metrics_this_month
    FROM metrics_this_month
    FULL OUTER JOIN teams
      ON teams.namespace = metrics_this_month.namespace
    FULL OUTER JOIN traces
      ON teams.namespace = traces.namespace
    GROUP BY
      -- COALESCE(teams.team, 'unaccounted')
      teams.team
    ORDER BY metrics_billable_series DESC
  )

SELECT *
FROM usage_by_team
CROSS JOIN total_metrics
CROSS JOIN total_traces`

var example_argo_commit_example = `WITH
gh AS
  (SELECT Count(*) AS commits
   FROM
     (SELECT *
      FROM oss_repo
      UNION ALL SELECT *
      FROM ent_repo) AS ent_repos),
argo_success AS
  (SELECT IF(argo.status = 'Succeeded', argo.value, 0) AS value FROM argo),
argo_failure AS
  (SELECT IF(argo.status = 'Failed', argo.value, 0) AS value FROM argo)
SELECT IF(env.value > 1, TRUE, workflows.runs < 1 OR gh.commits < 1) AS status,
       gh.commits AS 'merged commits to main (OSS + enterprise)',
       drone.value AS 'enterprise downstream publish',
       workflows.runs AS 'github trigger instant workflow runs today',
       argo_success.value AS 'argo success',
       argo_failure.value AS 'argo failure',
       (env.value - 1) AS 'new dev instant deployments'
FROM drone,
     env,
     gh,
     argo_success,
     argo_failure,
     workflows;`
