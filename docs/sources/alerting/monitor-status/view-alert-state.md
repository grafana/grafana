---
aliases:
  - ../../alerting/alerting-rules/view-state-health/ # /docs/grafana/<GRAFANA_VERSION>/alerting/alerting-rules/view-state-health
  - ../../alerting/manage-notifications/view-state-health/ # /docs/grafana/<GRAFANA_VERSION>/alerting/manage-notifications/view-state-health/
canonical: https://grafana.com/docs/grafana/latest/alerting/monitor-status/view-alert-state/
description: View the state and health of alert rules
keywords:
  - grafana
  - alert rules
  - keep last state
  - guide
  - state
  - health
labels:
  products:
    - cloud
    - enterprise
    - oss
title: View alert state
weight: 420
refs:
  alert-rule-state:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/alerting/fundamentals/alert-rule-evaluation/state-and-health/#alert-rule-state
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/alerting-and-irm/alerting/fundamentals/alert-rule-evaluation/state-and-health/#alert-rule-state
  alert-rule-evaluation:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/alerting/fundamentals/alert-rule-evaluation/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/alerting-and-irm/alerting/fundamentals/alert-rule-evaluation/
  alert-instance-state:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/alerting/fundamentals/alert-rule-evaluation/state-and-health/#alert-instance-state
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/alerting-and-irm/alerting/fundamentals/alert-rule-evaluation/state-and-health/#alert-instance-state
---

# View alert state

An alert rule and its corresponding alert instances can transition through distinct states during their [evaluation](ref:alert-rule-evaluation). There are three key components that helps us understand the behavior of our alerts:

- [Alert Instance State](ref:alert-instance-state): Refers to the state of the individual alert instances.
- [Alert Rule State](ref:alert-rule-state): Determined by the "worst state" among its alert instances.
- [Alert Rule Health](ref:alert-rule-health): Indicates the status in cases of `Error` or `NoData` events.

To view the state and health of your alert rules:

1. In the left-side menu, click **Alerts & IRM** and then **Alerting**.
1. Click **Alert rules** to view the list of existing alerts.
1. Click an alert rule to view its state, health, and state history.
