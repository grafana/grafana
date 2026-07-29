---
aliases:
  - ../../data-sources/loki/annotations/
description: Use annotations with the Loki data source in Grafana
keywords:
  - grafana
  - loki
  - logging
  - annotations
  - events
labels:
  products:
    - cloud
    - enterprise
    - oss
menuTitle: Annotations
title: Loki annotations
weight: 400
review_date: 2026-07-29
---

# Loki annotations

[Annotations](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/dashboards/build-dashboards/annotate-visualizations/) overlay rich event information on top of graphs. With the Loki data source, annotations are built from log queries: each log line that a LogQL query returns within the dashboard time range becomes an annotation, so you can correlate log events with the rest of your dashboard data.

## Before you begin

Before you create Loki annotations, ensure you have:

- A [configured Loki data source](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/datasources/loki/configure/).
- A [LogQL](https://grafana.com/docs/loki/latest/logql/) log query that returns the events you want to annotate.

## How Loki annotations work

Unlike data sources that build annotations from a separate query language, Loki annotations use the same LogQL log queries you use elsewhere. Grafana runs your log query for the dashboard time range and turns each returned log line into an annotation. By default, Grafana uses the log content as the annotation text and the log stream labels as tags, so you don't need to create any additional mapping.

You can only use log queries as a source for annotations. Metric queries aren't supported.

## Create an annotation query

To add a Loki annotation to a dashboard:

1. Open the dashboard where you want to add annotations.
1. Click **Edit**, then click **Settings** in the top navigation.
1. Select the **Annotations** tab.
1. Click **Add annotation query**.
1. Enter a **Name** for the annotation, for example, `Deploy events`.
1. Select your **Loki** data source.
1. Enter a LogQL log query and configure the optional fields described in the following table.
1. Click **Save dashboard**.

The annotation query editor provides the following fields:

| Field     | Description                                                                                                                                          |
| --------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Query** | The LogQL log query that selects the log lines to annotate.                                                                                          |
| **Title** | _Optional._ A template for the annotation title. Reference stream labels with `{{label}}`, for example `{{level}}`.                                  |
| **Tags**  | _Optional._ A comma-separated list of label keys to use as annotation tags. When empty, Grafana uses the log stream labels as tags.                  |
| **Text**  | _Optional._ A template for the annotation text. Reference stream labels with `{{label}}`. When empty, Grafana uses the log line content as the text. |

## Troubleshoot annotations

If annotations don't appear as expected, try the following solutions.

### Annotations don't appear

- Verify the log query returns results in [Explore](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/explore/) for the same time range. Annotations come from returned log lines, so a query that returns no logs produces no annotations.
- Confirm the query is a log query, not a metric query.
- Widen the dashboard time range to include the log events you expect.

### Too many annotations appear

- Add label filters or a line filter to your LogQL query to narrow the returned log lines.
- Reduce the maximum number of lines the query returns.

## Related resources

- [Annotate visualizations](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/dashboards/build-dashboards/annotate-visualizations/)
- [Loki query editor](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/datasources/loki/query-editor/)
- [Configure the Loki data source](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/datasources/loki/configure/)
