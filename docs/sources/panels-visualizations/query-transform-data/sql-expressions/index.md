---
aliases:
labels:
  products:
    - cloud
    - enterprise
    - oss
menuTitle: SQL expressions
title: SQL expressions
description: Manipulate and transform data in Grafana using SQL expressions.
weight: 45
refs:
  expressions:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/panels-visualizations/query-transform-data/expression-queries/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/visualizations/panels-visualizations/query-transform-data/expression-queries/
---

# SQL expressions

{{< docs/public-preview product="SQL expressions" >}}

SQL Expressions are server-side expressions that manipulate and transform the results of data source queries using MySQL-like syntax. They allow you to easily query and transform your data after it has been queried, using SQL, which provides a familiar and powerful syntax that can handle everything from simple filters to highly complex, multi-step transformations.

In Grafana, a server-side expression is a way to transform or calculate data after it has been retrieved from the data source, but before it is sent to the frontend for visualization. Grafana evaluates these expressions on the server, not in the browser or at the data source.

For general information on Grafana expressions, refer to [Write expression queries](ref:expressions).

![Example of a SQL expression](/media/docs/sql-expressions/sql-expressions-example-1.png)

## Before you begin

- Enable SQL expressions under the feature toggle `sqlExpressions`.
  - If you self-host Grafana, you can find feature toggles in the configuration file `grafana.ini`.

```
[feature_toggles]
enable = sqlExpressions
```

- If you are using Grafana Cloud, contact [Support](https://grafana.com/help/) to enable this feature.

## Transform data with SQL expressions

SQL expressions allow you to:

- Shape, transform, and modify query results without changing the original query.
- JOIN data from multiple tables.
- Create alerts or recording rules based on transformed data.
- Perform final-stage modifications to datasets, including:
  - Show, hide, or rename columns.
  - Filter rows based on conditions.
  - Aggregate data (for example: sum, average, count).
- Write subqueries and Common Table Expressions (CTEs) to support more complex logic:
  - **Subqueries** are nested queries used for filtering, calculations, or transformations.
  - **CTEs** are temporary named result sets that help make complex queries more readable and reusable.

A key capability of SQL expressions is the ability to JOIN data from multiple tables. This allows users to combine and transform data in a predictable, user-friendly way—even for complex use cases. You can JOIN data from an unlimited number of data source queries.

To work with SQL expressions, you must use data from a backend data source. In Grafana, a backend data source refers to a data source plugin or integration that communicates with a database, service, or API through the Grafana server, rather than directly from the browser (frontend).

## Known limitations

- Currently, only one SQL expression is supported per panel or alert.
- Grafana supports certain data sources. Refer to [compatible data sources](#compatible-data-sources) for a current list.
- Autocomplete is available, but column/field autocomplete is only available after enabling the `sqlExpressionsColumnAutoComplete` feature toggle, which is provided on an experimental basis.

## Compatible data sources

The following are compatible data sources:

**Full support:** Grafana supports all query types for each of these data sources.

- Elasticsearch
- MySQL
- Loki
- Graphite
- Google Sheets
- Amazon Athena

**Partial support:** The following data sources have limited or conditional support. Some support multiple query types depending on the service. For example, Azure Monitor can query multiple services, each with its own query format. In some cases, you can also switch the query type within a panel.

- InfluxDB
- Infinity
- Azure Monitor
- TestData
- Tempo
- Prometheus
- Cloudwatch
- GitHub
- BigQuery

## Create SQL expressions

To create a SQL expression, complete the following steps:

1. Navigate to **Dashboards** in the left-side menu.
1. Select a dashboard and open a dashboard panel.
1. Click the ellipsis in the upper right and select **Edit** .
1. Click **+ Expression**.
1. Select **SQL** from the drop-down.

After you have added a SQL expression, you can select from other data source queries by referencing the RefIDs of the queries in your SQL expression as if they were tables in a SQL database.

{{< admonition type="note" >}}
The **RefID** is a unique identifier assigned to each query within a Grafana panel that serves as a reference name for that query's data.
{{< /admonition >}}

![Using the RefID](/media/docs/sql-expressions/using-the-RefID.png)

## Workflow to build SQL expressions

Use the following workflow to create a SQL expression:

1. **Build your base queries.** Create the individual query and give it a meaningful name. Create the queries (A, B, etc.) that provide the data you want to combine or transform using SQL Expressions.
1. **Hide your base queries.** Click the **👁️ Eye icon** next to each base query to hide them from visualization. This keeps your panel clean while still making the data available to the SQL Expression.
1. **Switch to table view**. Set the panel visualization to **Table** to inspect and review the structure and output of your SQL expression as you build and refine it.
1. **Add a SQL Expression**. Add a new query and add select SQL Expression as its type.  
   **Inspect inputs**. Start with simple test queries to understand the shape of your input frames.

   ```sql
   SELECT * FROM A LIMIT 10.
   ```

   This lets you see the available columns and sample rows from `query A`. Repeat this for each input query you want to use (e.g., `SELECT * FROM B LIMIT 10`).

1. **Inspect your data**. Repeat this for each input query to understand the column structure and data types you're working with.

   ```sql
   SELECT * FROM <B, C, D, etc> LIMIT 10
   ```

1. **Construct the SQL expression.** Once you understand your data, you can write your SQL expression to join, filter, or otherwise transform the data.
1. **Validate and iterate**. Click **Refresh** every time you update your SQL query to re-evaluate and see the updated result.

When selecting a visualization type, **ensure your SQL expression returns data in the required shape**. For example, time series panels require a column with a time field (e.g., timestamp) and a numeric value column (e.g., \_\_value\_\_). If the output is not shaped correctly, your visualization may appear empty or fail to render.

The SQL expression workflow in Grafana is designed with the following behaviors:

- **Unhidden queries are visualized automatically.** If an input query is not hidden, Grafana will attempt to render it alongside your SQL expression. This can clutter the output, especially in table visualizations.

- **SQL expression results may not be immediately visible.** You might need to use the data frame selector (dropdown at the bottom of the table panel) to switch between the raw query and the SQL expression result.

- **Non-tabular or incorrectly shaped data will not render in certain panels.** Visualizations such as graphs or gauges require properly structured data. Mismatched formats will result in rendering issues or missing data.

## SQL conversion rules

When you reference a RefID within a SQL statement (e.g., `SELECT * FROM A`), the system invokes a distinct SQL conversion process.

The SQL conversion path:

- The query result appears as a single data frame, without labels, and is mapped directly to a tabular format.
- If the frame type is present and is either numeric, wide time series, or multi-frame time series (for example: labeled formats), Grafana automatically converts the data into a table structure.

## Supported functions

Grafana maintains a complete list of supported SQL keywords, operators, and functions in the SQL expressions query validator implementation.

For the most up-to-date reference of all supported SQL functionality, refer to the `allowedNode` and `allowedFunction` definitions in the Grafana [codebase](https://github.com/grafana/grafana/blob/main/pkg/expr/sql/parser_allow.go).

## Alerting and recording rules

SQL expressions integrates alerting and recording rules, allowing you to define complex conditions and metrics using standard SQL queries. The system processes your query results and automatically creates alert instances or recorded metrics based on the returned data structure.

For SQL Expressions to work properly with alerting and recording rules, your query must return:

- One numeric column - **_required_**. This contains the value that triggers alerts or gets recorded.
- Unique string column combinations - **_required_**. Each row must have a unique combination of string column values.
- One or more string columns - _optional_. These become **labels** for the alert instances or metrics. Examples: `service`, `region`. 

Consider the following query results:

```sql
error_count,service,region
25,auth-service,us-east
0,payment-service,us-west
15,user-service,eu-west
```

This query returns:

- the numeric column `error_count` (values: 25, 0, 15)
- the string columns `service` and `region`

For alert rules, this creates three alert instances:

- First instance with labels {service=auth-service, region=us-east} and value 25 (triggers alert - high error count)
- Second instance with labels {service=payment-service, region=us-west} and value 0 (no alert - zero errors)
- Third instance with labels {service=user-service, region=eu-west} and value 15 (triggers alert - elevated error count)

For recording rules, creates one metric with three series:

- First series: error_count_total{service=auth-service, region=us-east} 25
- Second series: error_count_total{service=payment-service, region=us-west} 0
- Third series: error_count_total{service=user-service, region=eu-west} 15

Following are some best practices for alerting and recording rules:

- Keep numeric values meaningful (for example: error counts, request duration).
- Use clear, descriptive column names - these become your labels.
- Keep string values short and consistent.
- Avoid too many unique label combinations, as this can result in high cardinality. 
- Always use `GROUP BY` to avoid duplicate label errors.
- Aggregate numeric values logically (for example: `SUM(error_count)`).

## Supported data source formats

Grafana supports three types of data source response formats:

1. **Single Table-like Frame**:  
   This refers to data returned in a standard tabular structure, where all values are organized into rows and columns, similar to what you'd get from a SQL query.
   - **Example**: Any query against a SQL data source (e.g., PostgreSQL, MySQL) with the format set to Table.

2. **Dataplane: Time Series Format**:  
   This format represents time series data with timestamps and associated values. It is typically returned from monitoring data sources.
   - **Example**: Prometheus or Loki Range Queries (queries that return a set of values over time).

3. **Dataplane: Numeric Long Format**:  
   This format is used for point-in-time (instant) metric queries that return a single value (or a set of values) at a specific moment.
   - **Example**: Prometheus or Loki Instant Queries (queries that return the current value of a metric).

For more information on Dataplane formats, refer to [Grafana Dataplane Documentation](https://grafana.com/developers/dataplane).

The following non-tabular formats are automatically converted to a tabular format (`FullLong`) when used in SQL expressions:

- **Time Series Wide**: Label keys become column names.
- **Time Series Multi**: Label values become the values in each row (or null if a label is missing).
- **Numeric Wide**: The `value` column contains the numeric metric value.
- **Numeric Multi**: If a display name exists, it will appear in the `display_name` column.

During conversion:

- Label keys become column names.
- Label values populate the corresponding rows (null if a label is missing).
- The `value` column contains the numeric metric.
- If available, the `display_name` column contains a human-readable name.
- The `metric_name` column stores the raw metric identifier.
- For time series data, Grafana includes a `time` column with timestamps

## SQL expressions examples

1. Create the following Prometheus query:

   ```promql
   sum(
     rate(go_cpu_classes_gc_total_cpu_seconds_total{namespace=~".*(namespace).*5."}[$__rate_interval])
   ) by (namespace)
   ```

   The panel displays the CPU usage by Go garbage collection (GC) over time, broken down by namespace.

   ![Example using a Prometheus query](/media/docs/sql-expressions/sql-expressions-prom-query-example.png)

2. Add the SQL expression `SELECT * from A`. After you add a SQL expression that selects from RefID A, Grafana converts it to a table response:

   ![Add the SQL expression](/media/docs/sql-expressions/add-the-sql-expression.png)

## LLM integration

The Grafana LLM plugin seamlessly integrates AI-powered assistance into your SQL expressions workflow.

{{< admonition type="note" >}}
The Grafana LLM plugin is currently in public preview, meaning Grafana offers limited support, and breaking changes might occur prior to the feature being made generally available.
{{< /admonition >}}

To use this integration, first [install and configure the LLM plugin](https://grafana.com/grafana/plugins/grafana-llm-app/). After installation, open your dashboard and select **Edit** to open the panel editor. Navigate to the **Queries** tab and scroll to the bottom where you'll find two new buttons positioned to the right of the **Run query** button in your SQL Expressions query.

{{< figure src="/media/docs/sql-expressions/sqlexpressions-LLM-integration-v12.2.png" caption="LLM integration" >}}

Click **Explain query** to open a drawer that displays a detailed explanation of your query, including its business meaning and performance statistics. Once the explanation is generated, the button changes to **View explanation**.

Click **Improve query** to open a suggestions drawer that contains performance and reliability enhancements, column naming best practices, and guidance on panel optimization. Click **Apply** to implement a suggestion. After you’ve interacted with the interface, you'll see a **Suggestions** button for quick access. Newer suggestions appear at the top, with older ones listed below, creating a history of improvements. If your SQL query has a parsing error, such as a syntax issue, the LLM provides a corrected version. The LLM automatically identifies errors and helps you rewrite the query correctly.
