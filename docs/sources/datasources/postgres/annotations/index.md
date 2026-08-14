---
description: Using annotations with the PostgreSQL data source in Grafana
keywords:
  - grafana
  - postgresql
  - annotations
  - events
labels:
  products:
    - cloud
    - enterprise
    - oss
menuTitle: Annotations
title: PostgreSQL annotations
weight: 340
review_date: 2026-05-04
---

# PostgreSQL annotations

Annotations overlay event data on your dashboard graphs, helping you correlate events with metrics.
You can use PostgreSQL as a data source for annotations to display events such as deployments, alerts, or other significant occurrences on your visualizations.

For general information about annotations, refer to [Annotate visualizations](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/dashboards/build-dashboards/annotate-visualizations/).

## Before you begin

Before creating PostgreSQL annotations, ensure you have:

- [A configured PostgreSQL data source](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/datasources/postgres/configure/).
- Tables containing event data with timestamp fields.
- Read access to the tables containing your events.

## Create an annotation query

To add a PostgreSQL annotation to your dashboard:

1. Navigate to the dashboard you want to update and click **Edit**.
1. Click the **Add new element** icon (blue plus sign).
1. Click **Annotation query**.
1. Enter a name for the annotation query.
1. If you don't want to use the annotation query right away, clear the **Enabled** checkbox.
1. Select a color for the annotation event markers.
1. Select an option in the **Show annotation controls in** drop-down list to control where on the dashboard the annotation is displayed.
1. Select an option in the **Show in** drop-down list to control the panels in which the annotation is displayed.
1. Click **Open query editor** to open the **Annotation Query** dialog box.
1. Select your **PostgreSQL** data source from the **Data source** drop-down list.
1. Configure the annotation query and field mappings.
1. (Optional) Click **Test annotation query** to ensure that the query is working properly.
1. Click **Close** when you've completed the query setup.
1. Click **Save**.
1. (Optional) Enter a description of the changes you've made.
1. Click **Save**.
1. Click **Exit edit**.

## Query columns

Your annotation query must return a `time` column and can optionally include `timeend`, `text`, and `tags` columns.

| Column    | Required | Description                                                                                   |
| --------- | -------- | --------------------------------------------------------------------------------------------- |
| `time`    | Yes      | The timestamp for the annotation. Can be a native SQL date/time type or UNIX epoch value.     |
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
  metric1 as text,
  concat_ws(', ', metric1::text, metric2::text) as tags
FROM public.test_data
WHERE $__unixEpochFilter(epoch_time)
```

### Range annotation with start and end time

Display events with duration as shaded regions:

```sql
SELECT
  epoch_time as time,
  epoch_time_end as timeend,
  metric1 as text,
  concat_ws(', ', metric1::text, metric2::text) as tags
FROM public.test_data
WHERE $__unixEpochFilter(epoch_time)
```

### Annotation with native SQL date/time

Display events using native PostgreSQL date/time columns:

```sql
SELECT
  native_date_time as time,
  metric1 as text,
  concat_ws(', ', metric1::text, metric2::text) as tags
FROM public.test_data
WHERE $__timeFilter(native_date_time)
```

### Deployment annotations

Display deployment events:

```sql
SELECT
  deployed_at as time,
  concat('Deployed ', version, ' to ', environment) as text,
  environment as tags
FROM deployments
WHERE $__timeFilter(deployed_at)
```

### Range annotation for maintenance windows

Display maintenance windows as shaded regions:

```sql
SELECT
  start_time as time,
  end_time as timeend,
  concat('Maintenance: ', description) as text,
  'maintenance' as tags
FROM maintenance_windows
WHERE $__timeFilter(start_time)
```

## Macros

Use these macros in your annotation queries to filter by the dashboard time range:

| Macro                        | Description                                                      |
| ---------------------------- | ---------------------------------------------------------------- |
| `$__timeFilter(column)`      | Filters by time range using a native SQL date/time column.       |
| `$__unixEpochFilter(column)` | Filters by time range using a column with UNIX epoch timestamps. |

## Best practices

Follow these best practices when creating PostgreSQL annotations:

- **Use time filters:** Always include `$__timeFilter()` or `$__unixEpochFilter()` to limit results to the dashboard time range.
- **Keep queries efficient:** Add indexes on time columns and filter columns to improve query performance.
- **Use meaningful text:** Include descriptive information in the `text` column to make annotations useful.
- **Organize with tags:** Use consistent tag values to categorize annotations and enable filtering.
- **Test queries first:** Verify your query returns expected results in Explore before adding it as an annotation.
