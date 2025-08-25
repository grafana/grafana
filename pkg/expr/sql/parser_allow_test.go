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
			name: "many allowed functions",
			q:    example_many_allowed_functions,
			err:  nil,
		},
		{
			name: "many more allowed functions",
			q:    example_many_more_allowed_functions,
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
			name: "null literal",
			q:    `SELECT 1 as id, NULL as null_col`,
			err:  nil,
		},
		{
			name: "val tuple in read query",
			q:    `SELECT 1 WHERE 1 IN (1, 2, 3)`,
			err:  nil,
		},
		{
			name: "group concat in read query",
			q:    `SELECT 1 as id, GROUP_CONCAT('will_', 'concatenate') as concat_val`,
			err:  nil,
		},
		{
			name: "collate in read query",
			q:    `SELECT 'some text' COLLATE utf8mb4_bin`,
			err:  nil,
		},
		{
			name: "allow substring_index",
			q:    `SELECT __value__, SUBSTRING_INDEX(name, '.', -1) AS code FROM A`,
			err:  nil,
		},
		{
			name: "json functions",
			q:    example_json_functions,
			err:  nil,
		},
		{
			name: "range condition (between)",
			q:    `SELECT '2024-04-01 15:30:00' BETWEEN '2024-04-01 15:29:00' AND '2024-04-01 15:31:00'`,
			err:  nil,
		},
		{
			name: "window functions",
			q:    example_window_functions,
			err:  nil,
		},
		{
			name: "json table",
			q:    "SELECT * FROM mockGitHubIssuesDSResponse, JSON_TABLE(labels, '$[*]' COLUMNS(val VARCHAR(255) PATH '$')) AS jt WHERE CAST(jt.val AS CHAR) LIKE 'type%'",
			err:  nil,
		},
	}
	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			_, err := AllowQuery("A", tc.q)
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

var example_many_allowed_functions = `WITH sample_data AS (
  SELECT 
    100 AS value,
    'example' AS name,
   '2025-01-01 00:00:00' AS created_at
  UNION ALL SELECT 
    50 AS value,
    'test' AS name,
    DATE_SUB('2025-01-01 00:00:00', INTERVAL 1 DAY) AS created_at
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
  DATE_FORMAT('2025-01-01 00:00:00', '%Y-%m-%d') AS date_format,
  '2025-01-01 00:00:00' AS date_now,
  DATE_ADD(created_at, INTERVAL 1 DAY) AS date_add,
  DATE_SUB(created_at, INTERVAL 1 DAY) AS date_sub,
  YEAR(created_at) AS date_year,
  MONTH(created_at) AS date_month,
  DAY(created_at) AS date_day,
  WEEKDAY(created_at) AS date_weekday,
  DATEDIFF('2025-01-01 00:00:00', created_at) AS date_datediff,
  UNIX_TIMESTAMP(created_at) AS date_unix_timestamp,
  FROM_UNIXTIME(1634567890) AS date_from_unixtime,
  
  -- Type conversion
  CAST(value AS CHAR) AS type_cast,
  CONVERT(value, CHAR) AS type_convert
FROM sample_data
GROUP BY name, value, created_at
LIMIT 10`

var example_json_functions = `SELECT 
  JSON_OBJECT('key1', 'value1', 'key2', 10) AS json_obj,
  JSON_ARRAY(1, 'abc', NULL, TRUE) AS json_arr,
  JSON_EXTRACT('{"id": 123, "name": "test"}', '$.id') AS json_ext,
  JSON_UNQUOTE(JSON_EXTRACT('{"name": "test"}', '$.name')) AS json_unq,
  JSON_CONTAINS('{"a": 1, "b": 2}', '{"a": 1}') AS json_contains,
  JSON_SET('{"a": 1}', '$.b', 2) AS json_set,
  JSON_REMOVE('{"a": 1, "b": 2}', '$.b') AS json_remove,
  JSON_LENGTH('{"a": 1, "b": {"c": 3}}') AS json_len,
  JSON_SEARCH('{"a": "xyz", "b": "abc"}', 'one', 'abc') AS json_search,
  JSON_TYPE('{"a": 1}') AS json_type`

var example_many_more_allowed_functions = `
SELECT
  -- Math functions
  LN(10) as ln_val,
  TRUNCATE(12.345, 2) as truncate_val,
  SIN(0.5) as sin_val,
  COS(0.5) as cos_val,
  TAN(0.5) as tan_val,
  ASIN(0.5) as asin_val,
  ACOS(0.5) as acos_val,
  ATAN(0.5) as atan_val,
  ATAN2(1, 2) as atan2_val,
  RAND() as rand_val,
  PI() as pi_val,
  
  -- String functions
  LEFT('hello', 2) as left_val,
  RIGHT('hello', 2) as right_val,
  LTRIM(' hello') as ltrim_val,
  RTRIM('hello ') as rtrim_val,
  REPLACE('hello', 'l', 'x') as replace_val,
  REVERSE('hello') as reverse_val,
  LCASE('HELLO') as lcase_val,
  UCASE('hello') as ucase_val,
  MID('hello', 2, 2) as mid_val,
  REPEAT('a', 3) as repeat_val,
  POSITION('l' IN 'hello') as position_val,
  INSTR('hello', 'l') as instr_val,
  LOCATE('l', 'hello') as locate_val,
  ASCII('A') as ascii_val,
  ORD('A') as ord_val,
  CHAR(65) as char_val,
  REGEXP_SUBSTR('hello world', 'world') as regexp_substr_val,
  
  -- Date functions
  EXTRACT(YEAR FROM '2023-01-01') as extract_val,
  HOUR('12:34:56') as hour_val,
  MINUTE('12:34:56') as minute_val,
  SECOND('12:34:56') as second_val,
  DAYNAME('2023-01-01') as dayname_val,
  MONTHNAME('2023-01-01') as monthname_val,
  DAYOFWEEK('2023-01-01') as dayofweek_val,
  DAYOFMONTH('2023-01-01') as dayofmonth_val,
  DAYOFYEAR('2023-01-01') as dayofyear_val,
  WEEK('2023-01-01') as week_val,
  QUARTER('2023-01-01') as quarter_val,
  TIME_TO_SEC('12:34:56') as time_to_sec_val,
  SEC_TO_TIME(45296) as sec_to_time_val,
  TIMESTAMPDIFF(HOUR, '2023-01-01', '2023-01-02') as timestampdiff_val,
  TIMESTAMPADD(HOUR, 1, '2023-01-01') as timestampadd_val,
  
  -- Type conversion
  CONVERT(12.34, CHAR) as convert_val,
  
  -- JSON functions
  JSON_MERGE_PATCH('{"a": 1}', '{"b": 2}') as json_merge_patch_val,
  JSON_VALID('{"a": 1}') as json_valid_val,
  JSON_KEYS('{"a": 1, "b": 2}') as json_keys_val,
  JSON_QUOTE('hello') as json_quote_val,
  JSON_INSERT('{"a": 1}', '$.b', 2) as json_insert_val,
  JSON_REPLACE('{"a": 1, "b": 2}', '$.b', 3) as json_replace_val
FROM dual;`

var example_window_functions = `
WITH dummy_data AS (
  SELECT 1 as val, 'apple' as txt
  UNION ALL SELECT 2, 'banana'
  UNION ALL SELECT 3, 'cherry'
)
SELECT 
  val,
  txt,
  ROW_NUMBER() OVER (ORDER BY val) as row_num,
  RANK() OVER (ORDER BY val) as rank_val,
  DENSE_RANK() OVER (ORDER BY val) as dense_rank_val,
  LEAD(val) OVER (ORDER BY val) as lead_val,
  LAG(val) OVER (ORDER BY val) as lag_val,
  FIRST_VALUE(val) OVER (ORDER BY val) as first_val,
  LAST_VALUE(val) OVER (ORDER BY val ROWS BETWEEN UNBOUNDED PRECEDING AND UNBOUNDED FOLLOWING) as last_val
FROM dummy_data;`
