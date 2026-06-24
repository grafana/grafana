---
canonical: https://grafana.com/docs/grafana/latest/alerting/alerting-rules/find-under-documented-alerts/
description: Find Grafana-managed alert rules with missing or short summary and description annotations.
keywords:
  - grafana
  - alerting
  - annotations
  - bulk
labels:
  products:
    - cloud
    - enterprise
    - oss
menuTitle: Find under-documented alerts
title: Find under-documented alerts
weight: 115
refs:
  generate-required-annotations:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/alerting/alerting-rules/generate-required-annotations/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/alerting-and-irm/alerting/alerting-rules/generate-required-annotations/
  explain-alert-instances:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/alerting/monitor-status/explain-alert-instances/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/alerting-and-irm/alerting/monitor-status/explain-alert-instances/
---

{{< docs/public-preview product="Find under-documented alerts" >}}

# Find under-documented alerts

Filter the alert rules list to find Grafana-managed rules with missing or very short `summary` and `description` annotations.

## Filter alert rules

1. Navigate to **Alerts & IRM** → **Alerting** → **Alert rules**.
1. Open the annotation filter.
1. Select **Missing summary or description** or **Short summary or description**.

The list shows only rules that need better notification context.

## Bulk generate annotations

Select one or more filtered rules and click **Generate annotations** to run Grafana Assistant across them.

1. Review proposed summaries and descriptions for each selected rule.
1. Edit or skip individual rules.
1. Save to update annotations in bulk.

For single-rule generation at save time, refer to [Require and generate annotations](ref:generate-required-annotations). For firing instances, use [Explain alert instances](ref:explain-alert-instances).
