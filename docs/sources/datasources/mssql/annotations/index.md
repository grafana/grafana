---
aliases:
  - ../../data-sources/mssql/annotations/
description: Using annotations with Microsoft SQL Server in Grafana
keywords:
  - grafana
  - MSSQL
  - Microsoft
  - SQL
  - annotations
  - events
labels:
  products:
    - cloud
    - enterprise
    - oss
menuTitle: Annotations
title: Microsoft SQL Server annotations
weight: 500
---

# Microsoft SQL Server annotations

Annotations overlay event markers on your dashboard visualizations, helping you correlate metric behavior with events like deployments, incidents, or configuration changes. You can use the Microsoft SQL Server data source to create annotation queries that display SQL query results as annotation events.

For general information about annotations, refer to [Annotate visualizations](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/dashboards/build-dashboards/annotate-visualizations/).

## Before you begin

Before you create MSSQL annotations, ensure you have:

- A [configured Microsoft SQL Server data source](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/datasources/mssql/configure/)
- A table containing event data with at least a time column and a description column
- Familiarity with [T-SQL](https://learn.microsoft.com/en-us/sql/t-sql/language-reference) query syntax

## Create an annotation query

To add a Microsoft SQL Server annotation to your dashboard:

1. Navigate to your dashboard and click **Dashboard settings** (gear icon).
1. Select **Annotations** in the left menu.
1. Click **Add annotation query**.
1. Enter a **Name** for the annotation.
1. Select your **Microsoft SQL Server** data source from the **Data source** drop-down.
1. Write a SQL query that returns the required columns.
1. Click **Save dashboard**.

## Annotation query columns

Your annotation query must return columns with specific names. Grafana uses these names to map query results to annotation fields.

| Column    | Required | Description                                                                                           |
|-----------|----------|-------------------------------------------------------------------------------------------------------|
| `time`    | Yes      | The date/time of the event. Can be a native SQL date/time type or a Unix epoch value in seconds.      |
| `timeend` | No       | The end time for region annotations. Same format as `time`. Creates a shaded region instead of a line. |
| `text`    | Yes      | The event description displayed in the annotation tooltip.                                            |
| `tags`    | No       | Comma-separated string used for event tags. Tags help categorize and filter annotations.              |

## Example: Annotation with epoch time

Given a table that stores events with Unix epoch timestamps:

```sql
CREATE TABLE [events] (
  time_sec bigint,
  description nvarchar(100),
  tags nvarchar(100),
)
```

Query to display events as annotations:

```sql
SELECT
  time_sec as time,
  description as [text],
  tags
FROM
  [events]
WHERE
  $__unixEpochFilter(time_sec)
ORDER BY 1
```

The `$__unixEpochFilter` macro automatically filters events to the dashboard's selected time range.

## Example: Region annotation with start and end times

To display annotations as shaded regions (spanning a duration), include both `time` and `timeend` columns:

```sql
SELECT
  time_sec as time,
  time_end_sec as timeend,
  description as [text],
  tags
FROM
  [events]
WHERE
  $__unixEpochFilter(time_sec)
ORDER BY 1
```

## Example: Annotation with native datetime column

If your table uses native SQL `datetime` or `datetime2` columns instead of epoch values:

```sql
SELECT
  time,
  measurement as text,
  convert(varchar, valueOne) + ',' + convert(varchar, valueTwo) as tags
FROM
  metric_values
WHERE
  $__timeFilter(time)
ORDER BY 1
```

The `$__timeFilter` macro works with native SQL date/time types and filters to the dashboard time range.

## Use template variables

You can use [template variables](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/datasources/mssql/template-variables/) in your annotation queries to make them dynamic. For example, filter events by a selected server:

```sql
SELECT
  time_sec as time,
  description as [text],
  tags
FROM
  [events]
WHERE
  $__unixEpochFilter(time_sec)
  AND server IN ($server)
ORDER BY 1
```

## Get help

If your annotations aren't appearing or behaving as expected, refer to [Troubleshoot Microsoft SQL Server data source issues](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/datasources/mssql/troubleshooting/) for common solutions.
