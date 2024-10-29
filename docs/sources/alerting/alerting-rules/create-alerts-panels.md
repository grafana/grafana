---
canonical: https://grafana.com/docs/grafana/latest/alerting/alerting-rules/create-alerts-panels/
description: Create alert rules from panels.  Reuse the queries in the panel and create alert rules based on them.
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
title: Create alert rules from panels
weight: 300
refs:
  time-series-visualizations:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/panels-visualizations/visualizations/time-series/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/visualizations/panels-visualizations/visualizations/time-series/
---

## Create alert rules from panels

Create alert rules from time series panels. By doing so, you can reuse the queries in the panel and create alert rules based on them.

1. Navigate to a dashboard in the **Dashboards** section.
2. Hover over the top-right corner of a time series panel and click the panel menu icon.
3. From the dropdown menu, select **More...** > **New alert rule**.

The New alert rule form opens where you can configure and create your alert rule based on the query used in the panel.

{{% admonition type="note" %}}
Changes to the panel aren't reflected on the linked alert rules. If you change a query, you have to update it in both the panel and the alert rule.

Alert rules are only supported in [time series](ref:time-series-visualizations) visualizations.
{{% /admonition %}}

{{< docs/play title="visualizations with linked alerts in Grafana" url="https://play.grafana.org/d/000000074/" >}}

## View alert rules from panels

To view alert rules associated with a time series panel, complete the following steps.

1. Open the panel editor by hovering over the top-right corner of any panel
1. Click the panel menu icon that appears.
1. Click **Edit**.
1. Click the **Alert** tab to view existing alert rules or create a new one.
