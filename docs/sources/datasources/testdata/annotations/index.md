---
description: Use annotations with the TestData data source to generate simulated annotation events for testing dashboards.
keywords:
  - grafana
  - testdata
  - annotations
  - events
  - testing
labels:
  products:
    - cloud
    - enterprise
    - oss
menuTitle: Annotations
title: TestData annotations
weight: 350
review_date: '2026-08-11'
---

# TestData annotations

The TestData data source can generate simulated [annotation](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/dashboards/build-dashboards/annotate-visualizations/) events. Use it to test how dashboards and panels render annotation markers and overlays without connecting to an external source. The generated events are created in the browser and aren't persisted.

## Before you begin

- [Configure the TestData data source](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/datasources/testdata/configure/).
- Familiarize yourself with [annotations](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/dashboards/build-dashboards/annotate-visualizations/) in Grafana.

## Add an annotation query

To add a dashboard annotation query that uses TestData:

1. Navigate to the dashboard you want to update and click **Edit**.
1. Click **Settings**.
1. Select the **Annotations** tab.
1. Click **Add annotation query**.
1. Enter a name for the annotation.
1. Select the **TestData** data source.
1. Set the **Count** field to the number of events you want to generate. Default: `10`.
1. Click **Save dashboard**.

TestData distributes the generated events evenly across the current dashboard time range. Each event includes sample text with a link and the tags `text` and `server`.

## Use the Annotations scenario in a panel

You can also generate annotation data as a panel query using the **Annotations** scenario. This returns annotation-shaped data frames directly to the panel instead of registering a dashboard-wide annotation query.

To use the Annotations scenario:

1. Add or edit a panel and select the **TestData** data source.
1. Choose the **Annotations** scenario from the **Scenario** drop-down.
1. Set the **Count** field to the number of events you want to generate. Default: `10`.
1. Click **Run queries**.

For a reference of all TestData scenarios, refer to the [TestData query editor](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/datasources/testdata/query-editor/).

## Limitations

- **Events are synthetic.** TestData generates fixed sample text and tags. You can't customize the event content.
- **Events aren't persisted.** The data source builds events in the browser each time the query runs. TestData doesn't store annotations or query an external source.
- **Not evaluated by the alerting engine.** The Annotations scenario runs in the browser, so it can't be used with [Grafana Alerting](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/datasources/testdata/alerting/) or in any context that requires server-side evaluation.
