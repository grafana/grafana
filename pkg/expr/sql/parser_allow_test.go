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
		{
			name: "case statement",
			q:    example_case_statement,
			err:  nil,
		},
		{
			name: "all allowed functions",
			q:    example_all_allowed_functions,
			err:  nil,
		},
		{
			name: "paren select allowed",
			q:    `(SELECT * FROM a_table) UNION ALL (SELECT * FROM a_table2)`,
			err:  nil,
		},
		{
			name: "allows keywords 'is', 'not', 'null'",
			q:    `SELECT * FROM a_table WHERE a_column IS NOT NULL`,
			err:  nil,
		},
		{
			name: "window functions",
			q:    example_window_functions,
			err:  nil,
		},
		{
			name: "group concat and match",
			q:    example_group_concat_and_match,
			err:  nil,
		},
		{
			name: "values and default",
			q:    example_values_and_default,
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

var example_case_statement = `SELECT 
  value,
  CASE 
    WHEN value > 100 THEN 'High'
    WHEN value > 50 THEN 'Medium'
    ELSE 'Low'
  END AS category
FROM metrics`

var example_all_allowed_functions = `WITH sample_data AS (
  SELECT 
    100 AS value,
    'example' AS name,
    NOW() AS created_at
  UNION ALL SELECT 
    50 AS value,
    'test' AS name,
    DATE_SUB(NOW(), INTERVAL 1 DAY) AS created_at
)
SELECT
  -- Conditional functions
  IF(value > 100, 'High', 'Low') AS conditional_if,
  COALESCE(value, 0) AS conditional_coalesce,
  IFNULL(value, 0) AS conditional_ifnull,
  NULLIF(value, 0) AS conditional_nullif,
  
  -- Aggregation functions
  SUM(value) AS agg_sum,
  AVG(value) AS agg_avg,
  COUNT(*) AS agg_count,
  MIN(value) AS agg_min,
  MAX(value) AS agg_max,
  STDDEV(value) AS agg_stddev,
  STD(value) AS agg_std,
  STDDEV_POP(value) AS agg_stddev_pop,
  VARIANCE(value) AS agg_variance,
  VAR_POP(value) AS agg_var_pop,
  
  -- Mathematical functions
  ABS(value) AS math_abs,
  ROUND(value, 2) AS math_round,
  FLOOR(value) AS math_floor,
  CEILING(value) AS math_ceiling,
  CEIL(value) AS math_ceil,
  SQRT(ABS(value)) AS math_sqrt,
  POW(value, 2) AS math_pow,
  POWER(value, 2) AS math_power,
  MOD(value, 10) AS math_mod,
  LOG(value) AS math_log,
  LOG10(value) AS math_log10,
  EXP(value) AS math_exp,
  SIGN(value) AS math_sign,
  
  -- String functions
  CONCAT('value: ', CAST(value AS CHAR)) AS str_concat,
  LENGTH(name) AS str_length,
  CHAR_LENGTH(name) AS str_char_length,
  LOWER(name) AS str_lower,
  UPPER(name) AS str_upper,
  SUBSTRING(name, 1, 5) AS str_substring,
  TRIM(name) AS str_trim,
  
  -- Date functions
  STR_TO_DATE('2023-01-01', '%Y-%m-%d') AS date_str_to_date,
  DATE_FORMAT(NOW(), '%Y-%m-%d') AS date_format,
  NOW() AS date_now,
  CURDATE() AS date_curdate,
  CURTIME() AS date_curtime,
  DATE_ADD(created_at, INTERVAL 1 DAY) AS date_add,
  DATE_SUB(created_at, INTERVAL 1 DAY) AS date_sub,
  YEAR(created_at) AS date_year,
  MONTH(created_at) AS date_month,
  DAY(created_at) AS date_day,
  WEEKDAY(created_at) AS date_weekday,
  DATEDIFF(NOW(), created_at) AS date_datediff,
  UNIX_TIMESTAMP(created_at) AS date_unix_timestamp,
  FROM_UNIXTIME(1634567890) AS date_from_unixtime,
  
  -- Type conversion
  CAST(value AS CHAR) AS type_cast,
  CONVERT(value, CHAR) AS type_convert
FROM sample_data
GROUP BY name, value, created_at
LIMIT 10`

var example_window_functions = `
WITH sales AS (
  SELECT 
    product_id,
    sale_date,
    amount,
    ROW_NUMBER() OVER (PARTITION BY product_id ORDER BY sale_date) as row_num,
    RANK() OVER (PARTITION BY product_id ORDER BY amount DESC) as rank_val,
    DENSE_RANK() OVER (PARTITION BY product_id ORDER BY amount DESC) as dense_rank_val,
    FIRST_VALUE(amount) OVER (PARTITION BY product_id ORDER BY sale_date) as first_sale,
    LAST_VALUE(amount) OVER (PARTITION BY product_id ORDER BY sale_date) as last_sale,
    NTH_VALUE(amount, 2) OVER (PARTITION BY product_id ORDER BY sale_date) as second_sale,
    LEAD(amount) OVER (PARTITION BY product_id ORDER BY sale_date) as next_sale,
    LAG(amount) OVER (PARTITION BY product_id ORDER BY sale_date) as prev_sale,
    PERCENT_RANK() OVER (PARTITION BY product_id ORDER BY amount) as percent_rank_val,
    CUME_DIST() OVER (PARTITION BY product_id ORDER BY amount) as cume_dist_val
  FROM sales_data
)
SELECT * FROM sales
WHERE row_num <= 10`

var example_group_concat_and_match = `
SELECT 
  category,
  GROUP_CONCAT(product_name ORDER BY price DESC SEPARATOR '; ') as products,
  GROUP_CONCAT(DISTINCT tag) as unique_tags,
  MATCH(description) AGAINST('keyword' IN BOOLEAN MODE) as relevance
FROM products
WHERE MATCH(name, description) AGAINST('search terms' IN NATURAL LANGUAGE MODE)
GROUP BY category
HAVING relevance > 0.5`

var example_values_and_default = `
WITH RECURSIVE dates(dt) AS (
  VALUES('2023-01-01')
  UNION ALL
  SELECT DATE_ADD(dt, INTERVAL 1 DAY)
  FROM dates
  WHERE dt < '2023-12-31'
)
SELECT 
  dt,
  COALESCE(amount, DEFAULT) as amount_with_default,
  NULLIF(status, DEFAULT) as non_default_status
FROM dates
LEFT JOIN transactions ON dates.dt = transactions.date`
