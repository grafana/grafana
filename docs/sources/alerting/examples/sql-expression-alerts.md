---
canonical: https://grafana.com/docs/grafana/latest/alerting/examples/sql-expression-alerts
description: This example shows how to create alert rules for data sources that return non-numeric data using SQL expressions.
keywords:
  - grafana
  - alerting
  - sql expressions
  - github
  - non-numeric data
labels:
  products:
    - cloud
    - enterprise
    - oss
menuTitle: SQL expression alerts
title: Create alerts with SQL expressions
weight: 1106
refs:
  sql-expressions:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/panels-visualizations/query-transform-data/sql-expressions/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/visualizations/panels-visualizations/query-transform-data/sql-expressions/
  table-data-example:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/alerting/best-practices/table-data/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/alerting-and-irm/alerting/best-practices/table-data/
  create-grafana-managed-rule:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/alerting/alerting-rules/create-grafana-managed-rule/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/alerting-and-irm/alerting/alerting-rules/create-grafana-managed-rule/
---

# Create alerts with SQL expressions

Some data sources return non-numeric or multi-field data that Grafana Alerting can't evaluate directly. For example, the GitHub data source returns fields like `conclusion`, `event`, `workflow_id`, and `run_number` — a mix of strings and numbers across multiple columns. Attempting to create an alert rule directly on this data produces the following error:

```text
[sse.readDataError] [A] got error: input data must be a wide series but got type long (input refid)
```

This happens because Grafana-managed alert rules require either numeric time series data or [tabular data with exactly one numeric column](ref:table-data-example). When a data source returns multiple columns of mixed types, the data doesn't meet this requirement.

You can solve this by adding a SQL expression that extracts and transforms the fields you need into a single numeric value. This example walks through the process using the GitHub data source.

## Before you begin

Before you begin, ensure you have the following:

- A Grafana instance with the `sqlExpressions` feature toggle enabled. Refer to [SQL expressions](ref:sql-expressions) for setup instructions.
- A configured data source that returns non-numeric data — this example uses the GitHub data source.

## Create a Grafana-managed alert rule with a SQL expression

To create an alert rule for a data source that returns non-numeric data:

1. Go to **Alerting** > **Alert rules** and click **+ New alert rule**.

1. In the **Define query and alert condition** section, enable **Advanced options**.

1. Select your data source and configure the query.

   For example, with the GitHub data source, select `Workflow Runs` as the query type and fill in the **Owner**, **Repository**, and **Workflow** fields.

1. Click **Add expression** and select **SQL**.

1. Write a SQL expression that transforms the query result into a single numeric value.

   The SQL expression references the query by its RefID (for example, `A`). It must return exactly one numeric column. Any string columns in the result become labels for the alert instance.

   The following example counts the number of failed workflow runs:

   ```sql
   SELECT
     SUM(CASE WHEN conclusion = 'failure' THEN 1 ELSE 0 END) AS value
   FROM A
   ```

   Replace `A` with the RefID of your data source query.

1. On the SQL expression, click **Set as alert condition**.

   This is a key step. The alert condition must be set on the SQL expression, not on the original data source query.

1. Click **Preview** to verify the expression returns a numeric result and the alert fires as expected.

1. Complete the remaining alert rule configuration — evaluation group, pending period, notifications — and click **Save rule**. Refer to [Configure Grafana-managed alert rules](ref:create-grafana-managed-rule) for details on these settings.

## Example SQL expressions

The following examples show common patterns for transforming non-numeric data source results into alertable values.

### Alert on failed GitHub workflow runs

Count the number of workflow runs with a `failure` conclusion. The alert fires when the count is greater than zero:

```sql
SELECT
  SUM(CASE WHEN conclusion = 'failure' THEN 1 ELSE 0 END) AS value
FROM A
```

### Alert on a specific workflow run number

Check whether a specific run number exists in the results. Returns `1` if found, `0` otherwise:

```sql
SELECT
  CASE
    WHEN SUM(CASE WHEN run_number = 3 THEN 1 ELSE 0 END) > 0
    THEN 1
    ELSE 0
  END AS alert
FROM A
```

Replace `3` with the run number you want to detect.

### Alert on a boolean field value

Convert a string-based boolean field (such as `is_private`) into a numeric value:

```sql
SELECT
  CASE
    WHEN is_private = 'true' THEN 1
    ELSE 0
  END AS status_code
FROM A
```

## Key considerations

- **Set the SQL expression as the alert condition.** The original data source query returns non-numeric data that can't be evaluated directly. The SQL expression must be the alert condition.
- **Return exactly one numeric column.** Grafana evaluates this column against the threshold. Additional string columns become alert instance labels.
- **Use `GROUP BY` when needed.** If your SQL expression returns multiple rows, ensure each row has a unique combination of label values. Refer to the [SQL expressions alerting documentation](ref:sql-expressions) for details on label handling.
- **The `sqlExpressions` feature toggle must be enabled.** Without it, the SQL option doesn't appear in the expression picker.
