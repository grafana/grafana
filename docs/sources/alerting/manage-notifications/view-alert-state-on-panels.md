---
canonical: https://grafana.com/docs/grafana/latest/alerting/manage-notifications/view-alert-state-on-panels/
description: View alert rules
keywords:
  - grafana
  - alerting
  - guide
  - rules
  - view
labels:
  products:
    - cloud
    - enterprise
    - oss
title: View alert state on panels
weight: 430
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
  link-alert-rules-to-dashboards:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/alerting/alerting-rules/link-alert-rules-to-dashboards/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/alerting-and-irm/alerting/alerting-rules/link-alert-rules-to-dashboards/
---

# View alert state on panels

When an [alert rule is linked to a time series panel](ref:link-alert-rules-to-dashboards), the time series panel displays the alert state and alert events.

A heart icon near the panel title shows the current alert state:

- A broken red heart when the alert is in `Alerting` state.
- A green heart when the alert is in `Normal` state.

Colored annotations indicate changes in alert state, such as pending, alerting, and resolving.

{{< figure src="/media/docs/alerting/panel-displays-alert-state.png" max-width="1200px" alt="A panel with a firing alert and annotations that display the pending and alerting state changes." >}}

Additionally, Grafana provides an [alert list panel](ref:alert-list-panel) that you can add to a dashboard to display a list of alerts and their states.

{{< figure src="/static/img/docs/alert-list-panel/alert-list-panel.png" max-width="850px" alt="Two alert list panels displaying distinct lists of alerts." >}}

You can configure the alert list panel with various visualization options and filters to control how alerts are displayed. For more details, refer to the [Alert list documentation](ref:alert-list-panel).

{{< docs/play title="this demo dashboard with alert list panels and linked alert rules" url="https://play.grafana.org/d/000000074/" >}}
