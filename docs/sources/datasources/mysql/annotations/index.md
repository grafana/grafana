---
description: Using annotations with MySQL in Grafana
keywords:
  - grafana
  - mysql
  - annotations
  - events
labels:
  products:
    - cloud
    - enterprise
    - oss
menuTitle: Annotations
title: MySQL annotations
weight: 340
refs:
  annotate-visualizations:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/dashboards/build-dashboards/annotate-visualizations/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana/<GRAFANA_VERSION>/dashboards/build-dashboards/annotate-visualizations/
---

# MySQL annotations

Annotations overlay event data on your dashboard graphs, helping you correlate events with metrics.
You can use MySQL as a data source for annotations to display events such as deployments, alerts, or other significant occurrences on your visualizations.

For general information about annotations, refer to [Annotate visualizations](ref:annotate-visualizations).

## Before you begin

Before creating MySQL annotations, ensure you have:

- A MySQL data source configured in Grafana.
- Tables containing event data with timestamp fields.
- Read access to the tables containing your events.

## Create an annotation query

To add a MySQL annotation to your dashboard:

1. Navigate to your dashboard and click **Dashboard settings** (gear icon).
1. Select **Annotations** in the left menu.
1. Click **Add annotation query**.
1. Enter a **Name** for the annotation.
1. Select your **MySQL** data source from the **Data source** drop-down.
1. Write a SQL query that returns the required columns.
1. Click **Save dashboard**.

## Query columns

Your annotation query must return a `time` column and can optionally include `timeend`, `text`, and `tags` columns.

| Column    | Required | Description                                                                                   |
| --------- | -------- | --------------------------------------------------------------------------------------------- |
| `time`    | Yes      | The timestamp for the annotation. Can be a SQL datetime or UNIX epoch value.                  |
| `timeend` | No       | The end timestamp for range annotations. Creates a shaded region instead of a vertical line.  |
| `text`    | No       | The annotation description displayed when you hover over the annotation.                      |
| `tags`    | No       | Tags for the annotation as a comma-separated string. Helps categorize and filter annotations. |

## Example queries

The following examples show common annotation query patterns.

### Basic annotation with epoch time

Display events using UNIX epoch timestamps:

```sql
SELECT
  epoch_time as time,
  description as text,
  CONCAT(tag1, ',', tag2) as tags
FROM events
WHERE $__unixEpochFilter(epoch_time)
```

### Annotation with a single tag

Display events with a single tag value:

```sql
SELECT
  epoch_time as time,
  message as text,
  category as tags
FROM event_log
WHERE $__unixEpochFilter(epoch_time)
```

### Range annotation with start and end time

Display events with duration as shaded regions:

```sql
SELECT
  start_time as time,
  end_time as timeend,
  description as text,
  CONCAT(type, ',', severity) as tags
FROM incidents
WHERE $__unixEpochFilter(start_time)
```

### Annotation with native SQL datetime

Display events using native MySQL datetime columns:

```sql
SELECT
  event_date as time,
  message as text,
  CONCAT(category, ',', priority) as tags
FROM system_events
WHERE $__timeFilter(event_date)
```

### Deployment annotations

Display deployment events:

```sql
SELECT
  deployed_at as time,
  CONCAT('Deployed ', version, ' to ', environment) as text,
  environment as tags
FROM deployments
WHERE $__timeFilter(deployed_at)
```

### Maintenance window annotations

Display maintenance windows as range annotations:

```sql
SELECT
  start_time as time,
  end_time as timeend,
  CONCAT('Maintenance: ', description) as text,
  'maintenance' as tags
FROM maintenance_windows
WHERE $__timeFilter(start_time)
```

## Macros

Use these macros in your annotation queries to filter by the dashboard time range:

| Macro                        | Description                                                      |
| ---------------------------- | ---------------------------------------------------------------- |
| `$__timeFilter(column)`      | Filters by time range using a native SQL datetime column.        |
| `$__unixEpochFilter(column)` | Filters by time range using a column with UNIX epoch timestamps. |

## Best practices

Follow these best practices when creating MySQL annotations:

- **Use time filters:** Always include `$__timeFilter()` or `$__unixEpochFilter()` to limit results to the dashboard time range.
- **Keep queries efficient:** Add indexes on time columns and filter columns to improve query performance.
- **Use meaningful text:** Include descriptive information in the `text` column to make annotations useful.
- **Organize with tags:** Use consistent tag values to categorize annotations and enable filtering.
- **Test queries first:** Verify your query returns expected results in Explore before adding it as an annotation.
