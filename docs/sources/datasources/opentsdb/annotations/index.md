---
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
  query-editor:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/datasources/opentsdb/query-editor/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana/<GRAFANA_VERSION>/datasources/opentsdb/query-editor/
  template-variables:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/datasources/opentsdb/template-variables/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana/<GRAFANA_VERSION>/datasources/opentsdb/template-variables/
  alerting:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/datasources/opentsdb/alerting/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana/<GRAFANA_VERSION>/datasources/opentsdb/alerting/
---

# OpenTSDB annotations

Annotations allow you to overlay event information on graphs, providing context for metric changes. The OpenTSDB data source supports both metric-specific annotations and global annotations stored in OpenTSDB.

For general information about annotations in Grafana, refer to [Annotate visualizations](ref:annotations).

## Annotation types

OpenTSDB supports two types of annotations:

| Type                   | Description                                                                                          | Use case                                                               |
| ---------------------- | ---------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| **Metric annotations** | Annotations attached to a specific time series (TSUID). Retrieved by querying the associated metric. | Track events affecting a specific host or service.                     |
| **Global annotations** | Annotations not tied to any time series. Apply system-wide.                                          | Track deployments, maintenance windows, or infrastructure-wide events. |

## How Grafana retrieves annotations

When you configure an annotation query, Grafana queries OpenTSDB for the specified metric and retrieves any annotations associated with that metric's time series. The query includes the `globalAnnotations=true` parameter, which allows Grafana to also retrieve global annotations when enabled.

Grafana displays the `description` field from each annotation as the annotation text.

## Configure an annotation query

To add OpenTSDB annotations to a dashboard:

1. Click the dashboard settings icon (gear) in the top navigation.
1. Select **Annotations** in the left menu.
1. Click **Add annotation query**.
1. Select the **OpenTSDB** data source.
1. Configure the annotation query fields as described in the following table.
1. Click **Save dashboard**.

## Annotation query fields

| Field                       | Description                                                                      |
| --------------------------- | -------------------------------------------------------------------------------- |
| **Name**                    | A descriptive name for this annotation query. Appears in the annotation legend.  |
| **Data source**             | Select the OpenTSDB data source.                                                 |
| **Enabled**                 | Toggle to enable or disable this annotation query.                               |
| **OpenTSDB metrics query**  | The metric name to query for annotations (for example, `events.deployment`).     |
| **Show Global Annotations** | Toggle to include global annotations that aren't tied to a specific time series. |

## Example annotation queries

The following examples demonstrate common annotation use cases.

### Track application deployments

Monitor when deployments occur for a specific application:

| Field                   | Value           |
| ----------------------- | --------------- |
| Name                    | App Deployments |
| OpenTSDB metrics query  | `deploy.myapp`  |
| Show Global Annotations | disabled        |

This query retrieves annotations attached to the `deploy.myapp` metric, showing deployment events for that specific application.

### Monitor infrastructure-wide events

Capture system-wide events such as network changes or datacenter maintenance:

| Field                   | Value                   |
| ----------------------- | ----------------------- |
| Name                    | Infrastructure Events   |
| OpenTSDB metrics query  | `events.infrastructure` |
| Show Global Annotations | enabled                 |

This query retrieves both metric-specific and global annotations, providing a complete picture of infrastructure events.

### Track incidents and outages

Mark incident start and resolution times:

| Field                   | Value             |
| ----------------------- | ----------------- |
| Name                    | Incidents         |
| OpenTSDB metrics query  | `events.incident` |
| Show Global Annotations | enabled           |

### Monitor configuration changes

Track when configuration changes are applied:

| Field                   | Value           |
| ----------------------- | --------------- |
| Name                    | Config Changes  |
| OpenTSDB metrics query  | `events.config` |
| Show Global Annotations | disabled        |

### Correlate multiple event types

You can add multiple annotation queries to a single dashboard to correlate different event types. For example:

1. Add a "Deployments" annotation query for `deploy.*` metrics.
1. Add an "Incidents" annotation query for `events.incident`.
1. Add a "Maintenance" annotation query with global annotations enabled.

This allows you to see how deployments, incidents, and maintenance windows relate to your metric data.

## How annotations appear

Annotations appear as vertical lines on time series panels at the timestamps where events occurred. Hover over an annotation marker to view:

- The annotation name (from your query configuration)
- The event description (from the OpenTSDB annotation's `description` field)
- The timestamp

Different annotation queries can be assigned different colors in the dashboard settings to distinguish between event types.

## Create annotations in OpenTSDB

To display annotations in Grafana, you must first create them in OpenTSDB. OpenTSDB provides an HTTP API for managing annotations.

### Annotation data structure

OpenTSDB annotations have the following fields:

| Field         | Required | Description                                                                                |
| ------------- | -------- | ------------------------------------------------------------------------------------------ |
| `startTime`   | Yes      | Unix epoch timestamp in seconds when the event started.                                    |
| `endTime`     | No       | Unix epoch timestamp in seconds when the event ended. Useful for duration-based events.    |
| `tsuid`       | No       | The time series UID to associate this annotation with. If empty, the annotation is global. |
| `description` | No       | Brief description of the event. This text displays in Grafana.                             |
| `notes`       | No       | Detailed notes about the event.                                                            |
| `custom`      | No       | A map of custom key-value pairs for additional metadata.                                   |

### Create a global annotation

Use the OpenTSDB API to create a global annotation:

```sh
curl -X POST http://<OPENTSDB_HOST>:4242/api/annotation \
  -H "Content-Type: application/json" \
  -d '{
    "startTime": 1609459200,
    "description": "Production deployment v2.5.0",
    "notes": "Deployed new feature flags and performance improvements",
    "custom": {
      "version": "2.5.0",
      "environment": "production",
      "deployer": "jenkins"
    }
  }'
```

### Create a metric-specific annotation

To attach an annotation to a specific time series, include the `tsuid`:

```sh
curl -X POST http://<OPENTSDB_HOST>:4242/api/annotation \
  -H "Content-Type: application/json" \
  -d '{
    "startTime": 1609459200,
    "endTime": 1609462800,
    "tsuid": "000001000001000001",
    "description": "Server maintenance",
    "notes": "Scheduled maintenance window for hardware upgrade"
  }'
```

To find the TSUID for a metric, use the OpenTSDB `/api/uid/tsmeta` endpoint.

### Create annotations programmatically

Integrate annotation creation into your deployment pipelines or monitoring systems:

**Deployment script example:**

```sh
#!/bin/bash
VERSION=$1
TIMESTAMP=$(date +%s)

curl -X POST http://opentsdb.example.com:4242/api/annotation \
  -H "Content-Type: application/json" \
  -d "{
    \"startTime\": $TIMESTAMP,
    \"description\": \"Deployed version $VERSION\",
    \"custom\": {
      \"version\": \"$VERSION\",
      \"environment\": \"production\"
    }
  }"
```

For more details on the annotation API, refer to the [OpenTSDB annotation API documentation](http://opentsdb.net/docs/build/html/api_http/annotation/index.html).

## Troubleshoot annotation issues

The following section addresses common issues you may encounter when using OpenTSDB annotations.

### Annotations don't appear

**Possible causes and solutions:**

| Cause                                    | Solution                                                                                                                              |
| ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| Time range doesn't include annotations   | Expand the dashboard time range to include the annotation timestamps.                                                                 |
| Wrong metric name                        | Verify the metric name in your annotation query matches the metric associated with the annotations in OpenTSDB.                       |
| Annotations are global but toggle is off | Enable **Show Global Annotations** if your annotations don't have a TSUID.                                                            |
| No annotations exist                     | Verify annotations exist in OpenTSDB using the API: `curl http://<OPENTSDB_HOST>:4242/api/annotation?startTime=<START>&endTime=<END>` |

### Annotation text is empty

The annotation displays but has no description text.

**Solution:** Ensure the `description` field is populated when creating annotations in OpenTSDB. Grafana displays the `description` field as the annotation text.

## Next steps

- [Build queries](ref:query-editor) to visualize metrics alongside annotations.
- [Use template variables](ref:template-variables) to create dynamic dashboards.
- [Set up alerting](ref:alerting) to get notified when metrics cross thresholds.
