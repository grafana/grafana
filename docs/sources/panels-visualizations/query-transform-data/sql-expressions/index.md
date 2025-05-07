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

{{< docs/private-preview product="SQL expressions" >}}

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

## Compatible data sources

The following are compatible data sources:

**Full support:** All query types for each data source are supported.

- Elasticsearch
- MySQL
- Loki
- Graphite
- Google Sheets
- Amazon Athena

**Partial support:** The following data sources offer limited or conditional support. Some allow different types of queries, depending on the service being accessed. For example, Azure Monitor can query multiple services, each with its own query format. In some cases, you can also change the query type within a panel.

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

For data to be used in SQL expressions, it must be in a **tabular format**, specifically the **FullLong format**. This means all relevant data is contained within a single table, with values such as metric labels stored as columns and individual cells. Because not all data sources return results in this format by default, Grafana will automatically convert compatible query results to FullLong format when they are referenced in a SQL expression.

## SQL conversion rules

When a RefID is referenced within a SQL statement (e.g., `SELECT * FROM A`), the system invokes a distinct SQL conversion process.

The SQL conversion path:

- The query result is treated as a single data frame, without labels, and is mapped directly to a tabular format.
- If the frame type is present and is either numeric, wide time series, or multi-frame time series (for example, labeled formats), Grafana automatically converts the data into a table structure.

## Known limitations

- Currently, only one SQL expression is supported per panel or alert.
- Grafana supports certain data sources. Refer to [compatible data sources](#compatible-data-sources) for a current list.

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
