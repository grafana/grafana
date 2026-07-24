---
canonical: https://grafana.com/docs/grafana/latest/alerting/fundamentals/alert-rule-evaluation/evaluation-within-a-group/
description: An alert instance is considered stale when its series disappears for a number of consecutive evaluation intervals. Learn how Grafana resolves them.
keywords:
  - grafana
  - alerting
  - guide
  - state
labels:
  products:
    - cloud
    - enterprise
    - oss
title: How rules are evaluated within a group
menuTitle: Evaluation within a group
weight: 150
refs:
  import-ds-rules:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/alerting/alerting-rules/alerting-migration/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/alerting-and-irm/alerting/alerting-rules/alerting-migration/
---

# How rules are evaluated within a group

Each evaluation group contains an **evaluation interval** that determines how frequently the rule is evaluated. For instance, the evaluation may occur every `10s`, `30s`, `1m`, `10m`, etc.

Rules in different evaluation groups can be evaluated simultaneously.

Rules within the same evaluation group can be evaluated simultaneously or sequentially, depending on the rule type:

- **Grafana-managed** rules within the same group are evaluated concurrently—they are evaluated at different times over the same evaluation interval but display the same evaluation timestamp.

- **Data source-managed** rules within the same group are evaluated sequentially, one after the other—this is useful to ensure that recording rules are evaluated before alert rules.

- **Grafana-managed rules [imported from data source-managed rules](ref:import-ds-rules)** are also evaluated sequentially.
