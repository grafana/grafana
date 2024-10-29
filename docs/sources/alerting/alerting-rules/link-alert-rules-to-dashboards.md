---
aliases:
  - ../../alerting/alerting-rules/create-alerts-panels/ # /docs/grafana/<GRAFANA_VERSION>/alerting/alerting-rules/create-alerts-panels/
canonical: https://grafana.com/docs/grafana/latest/alerting/alerting-rules/link-alert-rules-to-dashboards/
description: Grafana allows you to link alert rules with panels and dashboards. This helps connect alerts with an existing dashboard and informs alert responders on where to investigate.
keywords:
  - grafana
  - alerting
  - panels
  - create
  - grafana-managed
  - data source-managed
labels:
  products:
    - cloud
    - enterprise
    - oss
title: Link alert rules to dashboards and panels
menuTitle: Link alert rules to dashboards
weight: 300
refs:
  time-series-visualizations:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/panels-visualizations/visualizations/time-series/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/visualizations/panels-visualizations/visualizations/time-series/
  alert-list-panel:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/panels-visualizations/visualizations/alert-list/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/visualizations/panels-visualizations/visualizations/alert-list/
  annotations:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/alerting/fundamentals/alert-rules/annotation-label/#annotations
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/alerting-and-irm/alerting/fundamentals/alert-rules/annotation-label/#annotations
---

# Link alert rules to dashboards and panels

Grafana allows you to link alert rules with panels and dashboards. This helps connect alerts with an existing dashboard and informs alert responders on where to investigate.

An alert rule is linked to a dashboard and panel via the [`dashboardUId` and `panelId` annotations](ref:annotations), respectively. When configuring the alert rule, you can set the dashboard and panel annotations as shown in this [video](https://youtu.be/ClLp-iSoaSY?si=qKWnvSVaQuvYcuw9&t=170).

1. Configure the alert rule.
1. Click **Link dashboard and panel** on the **Configure notification message** section.
1. Select an existing dashboard and panel from the list.

## Create alert rules from panels

You can also create an alert rule from a panel. This allows you to reuse the panel query for the alert rule query and automatically sets the panel and dashboard annotations.

1. Navigate to a dashboard in the **Dashboards** section.
1. Hover over the top-right corner of a time series panel and click the panel menu icon.
1. From the dropdown menu, select **More...** > **New alert rule**.

{{< figure src="/media/docs/alerting/create-alert-rule-from-time-series-panel.png" max-width="1200px" caption="Create an alert rule from a panel." >}}

The New alert rule form opens where you can configure and create your alert rule based on the query used in the panel.

{{% admonition type="note" %}}

Changes to panel and alert rule queries aren't synchronized. If you change a query, you have to update it in both the panel and the alert rule.

{{% /admonition %}}

## View alert rules from panels

This option is available only in [time series panels](ref:time-series-visualizations). To view alert rules associated to a time series panel, complete the following steps.

1. Hover over the top-right corner of the panel and click the panel menu icon.
1. Click **Edit**.
1. Click the **Alert** tab to view existing alert rules or create a new one.

{{< figure src="/media/docs/alerting/view-alert-rule-from-within-a-panel.png" max-width="1200px" caption="The Alert tab of the panel displays the status of the linked alert rule." >}}

## View alert state in dashboards

When an alert rule is linked to a [time series panel](ref:time-series-visualizations), the time series panel displays the alert state and alert events.

A heart icon near the panel title indicates the current alert state, and colored annotations show changes in alert state.

{{< figure src="/media/docs/alerting/panel-displays-alert-state.png" max-width="1200px" caption="A panel with a firing alert and annotations that display the pending and alerting state changes." >}}

#### Alert list panel

Additionally, Grafana provides an [alert list panel](ref:alert-list-panel) to display a list of alerts. You can configure the alert list panel with various visualization options and filters to control how alerts are displayed.

{{< figure src="/static/img/docs/alert-list-panel/alert-list-panel.png" max-width="1200px" caption="Two alert list panels displaying distinct lists of alerts." >}}

{{< docs/play title="this demo dashboard with alert list panels and linked alert rules" url="https://play.grafana.org/d/000000074/" >}}
