---
aliases:
  - ../../alerting/alerting-rules/create-alerts-panels/ # /docs/grafana/<GRAFANA_VERSION>/alerting/alerting-rules/create-alerts-panels/
canonical: https://grafana.com/docs/grafana/latest/alerting/alerting-rules/link-alert-rules-to-panels/
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
title: Create and link alert rules to panels
weight: 200
refs:
  time-series-visualizations:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/panels-visualizations/visualizations/time-series/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/visualizations/panels-visualizations/visualizations/time-series/
  annotations:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/alerting/fundamentals/alert-rules/annotation-label/#annotations
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/alerting-and-irm/alerting/fundamentals/alert-rules/annotation-label/#annotations
  view-alert-state-on-panels:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/alerting/monitor-status/view-alert-state/#view-alert-state-on-panels
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/alerting-and-irm/alerting/monitor-status/view-alert-state/#view-alert-state-on-panels
  images-in-notifications:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/alerting/configure-notifications/template-notifications/images-in-notifications/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/alerting-and-irm/alerting/configure-notifications/template-notifications/images-in-notifications/
---

# Create and link alert rules to panels

Grafana allows you to link an alert rule to a dashboard panel. This can help you:

- Inform alert responders about where to investigate and which data to examine.
- Visualize the alert state directly from dashboards.
- Include a screenshot of the panel in notification messages.

An alert rule is linked to a panel by setting the [`__dashboardUid__` and `__panelId__` annotations](ref:annotations). Both annotations must be set together.

## Link alert rules to panels

When configuring the alert rule, you can set the dashboard and panel annotations as shown in this [video](https://youtu.be/ClLp-iSoaSY?si=qKWnvSVaQuvYcuw9&t=170).

1. Configure the alert rule.
1. In the **Configure notification message** section, click **Link dashboard and panel**.
1. Select an existing dashboard, then choose a panel from the selected dashboard.
1. Complete the alert rule configuration and click **Save rule** to initiate the alert rule.

You can then [view the alert state on the panel](ref:view-alert-state-on-panels).

By default, notification messages include a link to the dashboard panel. Additionally, you can [enable displaying panel screenshots in notifications](ref:images-in-notifications).

{{< figure src="/media/docs/alerting/panel-displays-alert-state.png" max-width="1200px" caption="A panel displaying the alert status and state changes." >}}

## Create alert rules from panels

To streamline alert creation, you can create an alert rule directly from a panel.

1. Navigate to a dashboard in the **Dashboards** section.
1. Hover over the top-right corner of a panel and click the panel menu icon.
1. From the dropdown menu, select **More...** > **New alert rule**.
1. This opens the **Edit rule** form and pre-fills some values:
   - Sets the annotations to the corresponding dashboard and panel.
   - Sets the alert rule query using the panel query.
1. Complete the alert rule configuration and click **Save rule** to initiate the alert rule.

You can then [view the alert state on the panel](ref:view-alert-state-on-panels).

By default, notification messages include a link to the dashboard panel. Additionally, you can [enable displaying panel screenshots in notifications](ref:images-in-notifications).

{{< admonition type="note" >}}
Changes to panel and alert rule queries aren't synchronized. If you change a query, you have to update it in both the panel and the alert rule.
{{< /admonition >}}

## Access linked alert rules from panels

This option is available only in [time series panels](ref:time-series-visualizations). To access alert rules associated to a time series panel, complete the following steps.

1. Hover over the top-right corner of the panel and click the panel menu icon.
1. Click **Edit**.
1. Click the **Alert** tab to view existing alert rules or create a new one.

{{< admonition type="tip" >}}
For a practical example, refer to our [Getting started: Link alerts to visualizations tutorial](http://www.grafana.com/tutorials/alerting-get-started-pt6/).
{{< /admonition >}}
