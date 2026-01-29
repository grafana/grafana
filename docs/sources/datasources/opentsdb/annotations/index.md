---
aliases:
  - ../../data-sources/opentsdb/annotations/
description: Use annotations with the OpenTSDB data source in Grafana
keywords:
  - grafana
  - opentsdb
  - annotations
  - events
labels:
  products:
    - cloud
    - enterprise
    - oss
menuTitle: Annotations
title: OpenTSDB annotations
weight: 450
last_reviewed: 2026-01-28
refs:
  annotations:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/dashboards/build-dashboards/annotate-visualizations/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana/<GRAFANA_VERSION>/dashboards/build-dashboards/annotate-visualizations/
---

# OpenTSDB annotations

Annotations allow you to overlay event information on graphs. The OpenTSDB data source supports both metric-specific annotations and global annotations stored in OpenTSDB.

For general information about annotations in Grafana, refer to [Annotate visualizations](ref:annotations).

## Annotation types

OpenTSDB supports two types of annotations:

| Type | Description |
| ---- | ----------- |
| **Metric annotations** | Annotations attached to a specific time series. Retrieved by querying a metric. |
| **Global annotations** | Annotations not tied to a specific time series. Useful for system-wide events. |

## Configure an annotation query

To add OpenTSDB annotations to a dashboard:

1. Click the dashboard settings icon (gear) in the top navigation.
1. Select **Annotations** in the left menu.
1. Click **Add annotation query**.
1. Select the **OpenTSDB** data source.
1. Configure the annotation query fields.
1. Click **Save dashboard**.

## Annotation query fields

| Field | Description |
| ----- | ----------- |
| **Name** | A descriptive name for this annotation query. |
| **Data source** | Select the OpenTSDB data source. |
| **Enabled** | Toggle to enable or disable this annotation query. |
| **OpenTSDB metrics query** | The metric name to query for annotations (for example, `events.deployment`). |
| **Show Global Annotations** | Toggle to include global annotations that aren't tied to a specific time series. |

## Example annotation queries

### Deployment events

Track application deployments:

| Field | Value |
| ----- | ----- |
| Name | Deployments |
| OpenTSDB metrics query | `events.deployment` |
| Show Global Annotations | disabled |

### System-wide events

Include all global annotations:

| Field | Value |
| ----- | ----- |
| Name | System Events |
| OpenTSDB metrics query | `events.system` |
| Show Global Annotations | enabled |

### Maintenance windows

Track maintenance periods:

| Field | Value |
| ----- | ----- |
| Name | Maintenance |
| OpenTSDB metrics query | `events.maintenance` |
| Show Global Annotations | enabled |

## How annotations appear

Annotations appear as vertical lines on time series panels at the timestamps where events occurred. Hover over an annotation marker to view the event description.

## Write annotations to OpenTSDB

To create annotations that Grafana can display, write them to OpenTSDB using the annotation API. Refer to the [OpenTSDB annotations documentation](http://opentsdb.net/docs/build/html/user_guide/metadata.html#annotations) for details on the annotation format and API.
