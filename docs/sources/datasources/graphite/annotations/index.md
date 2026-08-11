---
aliases:
  - ../../data-sources/graphite/annotations/
description: Use annotations with the Graphite data source in Grafana
keywords:
  - grafana
  - graphite
  - annotations
  - events
labels:
  products:
    - cloud
    - enterprise
    - oss
menuTitle: Annotations
title: Graphite annotations
weight: 350
review_date: 2026-08-11
---

# Graphite annotations

Annotations overlay event data on your dashboard graphs, helping you correlate events with metrics. You can use Graphite as a data source for annotations to display events such as deployments, incidents, or maintenance windows on your visualizations.

For general information about annotations in Grafana, refer to [Annotate visualizations](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/dashboards/build-dashboards/annotate-visualizations/).

## Before you begin

Before creating Graphite annotations, ensure you have:

- A configured Graphite data source in Grafana.
- Metrics or events in Graphite that represent the events you want to annotate.
- Read access to the Graphite instance.

## Annotation query modes

Graphite supports two ways to query annotations. You configure both in the annotation query editor:

| Mode             | Field                    | Description                                                                                                                                         |
| ---------------- | ------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Metric query** | **Graphite Query**       | Runs a standard Graphite metric query. Each returned data point with a non-zero value becomes an annotation, and the series name becomes the title. |
| **Events query** | **Graphite events tags** | Queries the Graphite events API and filters by one or more event tags. Each matching event becomes an annotation.                                   |

Use the metric query mode when an existing metric marks your events, for example a counter that increments on each deployment. Use the events query mode when you record discrete events in Graphite and tag them.

## Create an annotation query

To add a Graphite annotation to your dashboard:

1. Navigate to the dashboard you want to update and click **Edit**.
1. Click the **Add new element** icon (blue plus sign).
1. Click **Annotation query**.
1. Enter a name for the annotation query.
1. If you don't want to use the annotation query right away, clear the **Enabled** checkbox.
1. Select a color for the annotation event markers.
1. Select an option in the **Show annotation controls in** drop-down list to control where on the dashboard the annotation is displayed.
1. Select an option in the **Show in** drop-down list to control the panels in which the annotation is displayed.
1. Click **Open query editor** to open the **Annotation Query** dialog box.
1. Select the **Graphite** data source from the **Data source** drop-down list.
1. Configure one of the annotation query modes:
   - In the **Graphite Query** field, enter a metric query, for example `statsd.application.counters.*.count`.
   - In the **Graphite events tags** field, enter one or more event tags, for example `deploy`.
1. (Optional) Click **Test annotation query** to ensure that the query is working properly.
1. Click **Close** when you've completed the query setup.
1. Click **Save**.
1. (Optional) Enter a description of the changes you've made.
1. Click **Save**.
1. Click **Exit edit**.

{{< admonition type="note" >}}
Enter a value in either the **Graphite Query** field or the **Graphite events tags** field, not both. If you provide a metric query, Grafana uses the metric query mode and ignores the tags.
{{< /admonition >}}

## Metric query annotations

In metric query mode, Grafana runs the value in the **Graphite Query** field as a standard Graphite query over the dashboard time range. Grafana converts the results into annotations using these rules:

- Every data point with a non-zero value creates an annotation. Data points with a value of zero or `null` are skipped.
- The annotation timestamp is the timestamp of the data point.
- The annotation title is the series name returned by Graphite.

Because every non-zero data point creates an annotation, use a metric that only produces values at the moments you want annotated. Metrics that report continuous values produce an annotation at every step interval and flood your dashboard.

### Example: deployment counter

If you increment a counter each time a service deploys, query that counter to mark deployments:

```text
drawAsInfinite(deploys.myservice.count)
```

The `drawAsInfinite()` function is useful for event-style metrics because it renders each occurrence as a vertical marker, which maps cleanly to annotations.

## Events query annotations

In events query mode, Grafana queries the Graphite events API and filters events by the tags you provide in the **Graphite events tags** field. Grafana converts each matching event into an annotation using these rules:

- The annotation timestamp is the event's `when` value.
- The annotation title is the event's `what` value.
- The tags you query with are attached to the annotation.

You can filter events in the following ways:

| Value         | Result                                                           |
| ------------- | ---------------------------------------------------------------- |
| Empty         | Returns all events in the dashboard time range.                  |
| A single tag  | Returns events that include that tag, for example `deploy`.      |
| Multiple tags | Returns events that match the supplied tags.                     |
| A wildcard    | Returns events whose tags match the pattern, for example `web*`. |

### Create events in Graphite

Before you can query events, record them in Graphite. Graphite exposes an HTTP endpoint for creating events:

```sh
curl -X POST http://<GRAPHITE_HOST>/events/ \
  -H "Content-Type: application/json" \
  -d '{
    "what": "Deployed myservice v2.5.0",
    "tags": ["deploy", "myservice"],
    "data": "Deployed new feature flags and performance improvements"
  }'
```

Replace _`<GRAPHITE_HOST>`_ with your Graphite server address. The `what` field becomes the annotation title, and the `tags` field is what you filter on in the **Graphite events tags** field.

## Use template variables in annotations

You can use template variables in both annotation query modes to filter annotations based on dashboard variable selections. Grafana resolves the variables at query time using the current dashboard variable values.

Metric query with a variable:

```text
drawAsInfinite(deploys.$service.count)
```

Events query with a variable:

```text
deploy $environment
```

For more information about template variables, refer to [Graphite template variables](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/datasources/graphite/template-variables/).

## Troubleshoot annotation issues

The following section addresses common issues you might encounter when using Graphite annotations.

### Annotations don't appear

**Possible causes and solutions:**

| Cause                                 | Solution                                                                                                          |
| ------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| Time range doesn't include the events | Expand the dashboard time range to include the event timestamps.                                                  |
| Metric query returns only zero values | Annotations are created only for non-zero data points. Verify the metric produces non-zero values at event times. |
| No matching events                    | Confirm events exist in Graphite for the supplied tags and time range.                                            |
| Both fields are populated             | Clear one of the fields. Grafana uses the metric query mode whenever the **Graphite Query** field has a value.    |

### Annotation title is empty

In events query mode, Grafana uses the event's `what` value as the title. Ensure the `what` field is populated when you create events in Graphite.

For more troubleshooting guidance, refer to [Troubleshoot Graphite data source issues](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/datasources/graphite/troubleshooting/).
