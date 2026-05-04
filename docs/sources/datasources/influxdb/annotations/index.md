---
description: Using annotations with the InfluxDB data source in Grafana
keywords:
  - grafana
  - influxdb
  - annotations
  - events
  - influxql
  - flux
  - sql
labels:
  products:
    - cloud
    - enterprise
    - oss
menuTitle: Annotations
title: InfluxDB annotations
weight: 500
review_date: 2026-05-01
---

# InfluxDB annotations

Annotations overlay event data on your dashboard graphs, helping you correlate events with metrics. You can use InfluxDB as a data source for annotations to display events such as deployments, alerts, or other significant occurrences on your visualizations.

For general information about annotations, refer to [Annotate visualizations](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/dashboards/build-dashboards/annotate-visualizations/).

## Before you begin

Before creating InfluxDB annotations, ensure you have:

- An InfluxDB data source configured in Grafana
- Data in InfluxDB containing event information with timestamp fields
- Read access to the InfluxDB database or bucket containing your events

## Create an annotation query

To add an InfluxDB annotation to your dashboard:

1. Navigate to your dashboard and click **Dashboard settings** (gear icon).
1. Select **Annotations** in the left menu.
1. Click **Add annotation query**.
1. Enter a **Name** for the annotation.
1. Select your **InfluxDB** data source from the **Data source** drop-down.
1. Configure the annotation query and field mappings.
1. Click **Save dashboard**.

## InfluxQL annotations

For InfluxQL-configured data sources, write an InfluxQL query in the **InfluxQL Query** field. Your query **must** include `WHERE $timeFilter` to scope the results to the dashboard's time range.

### Field mappings

Field mappings tell Grafana which InfluxDB columns contain the annotation data. If your query returns only one column, you don't need to enter anything in the field mapping fields.

| Field | Description |
| ----- | ----------- |
| **Text** | The column containing the annotation description displayed when you hover over the annotation. |
| **Tags** | The column containing tags for the annotation. The value can be a comma-separated string. Tags help categorize and filter annotations. |
| **TimeEnd** | The column containing an end time for range annotations. Range annotations display as a shaded region on the graph instead of a single vertical line. |

### InfluxQL annotation query example

The following query retrieves deployment events and displays them as annotations:

```sql
SELECT title, description
FROM events
WHERE $timeFilter
ORDER BY time ASC
```

### Range annotation example

To display events with duration as shaded regions:

```sql
SELECT description, tags, end_time
FROM maintenance_windows
WHERE $timeFilter
ORDER BY time ASC
```

Configure the field mappings as follows:

- **Text:** `description`
- **Tags:** `tags`
- **TimeEnd:** `end_time`

## Flux annotations

For Flux-configured data sources, annotations use the standard Flux query editor. Write a Flux query that returns data frames with time, text, and optional tag fields.

### Flux annotation query example

```flux
from(bucket: "events")
  |> range(start: v.timeRangeStart, stop: v.timeRangeStop)
  |> filter(fn: (r) => r["_measurement"] == "deployments")
  |> pivot(rowKey: ["_time"], columnKey: ["_field"], valueColumn: "_value")
```

Grafana processes the resulting data frames as annotation events. Ensure the query returns a `_time` column and at least one text column.

## SQL annotations

SQL-configured data sources (InfluxDB 3.x) use the standard Grafana annotation query editor. Write an SQL query that returns a time column and at least one text column. Use the `$__timeFilter(time)` macro to scope results to the dashboard time range.

### SQL annotation query example

```sql
SELECT time, title, description
FROM events
WHERE $__timeFilter(time)
ORDER BY time ASC
```

### SQL range annotation example

To display events with duration as shaded regions, return both a start time and an end time:

```sql
SELECT time, end_time, description, tags
FROM maintenance_windows
WHERE $__timeFilter(time)
ORDER BY time ASC
```

Configure the field mappings:

- **Text:** `description`
- **Tags:** `tags`
- **TimeEnd:** `end_time`

## Use template variables in annotations

You can use template variables in your annotation queries to filter annotations based on dashboard variable selections. For example:

```sql
SELECT title, description
FROM events
WHERE $timeFilter AND environment = '$environment'
ORDER BY time ASC
```

If your annotations aren't appearing or you encounter errors, refer to [Troubleshoot InfluxDB data source issues](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/datasources/influxdb/troubleshooting/#annotation-errors).
