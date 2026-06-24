---
canonical: https://grafana.com/docs/grafana/latest/alerting/alerting-rules/find-under-documented-alerts/
description: Find Grafana-managed alert rules with missing or short summary and description annotations.
keywords:
  - grafana
  - alerting
  - annotations
  - bulk
  - autofill
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
  explain-alert-query:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/alerting/alerting-rules/explain-alert-query/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/alerting-and-irm/alerting/alerting-rules/explain-alert-query/
  search-related-context:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/alerting/monitor-status/search-related-context/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/alerting-and-irm/alerting/monitor-status/search-related-context/
---

{{< docs/public-preview product="Find under-documented alerts" >}}

# Find under-documented alerts

Filter the alert rules list to find Grafana-managed rules with missing or very short `summary` and `description` annotations, then use **Autofill** to update them.

## Filter alert rules

1. Navigate to **Alerts & IRM** → **Alerting** → **Alert rules**.
1. Open the annotation filter.
1. Select **Missing summary or description** or **Short summary or description**.

The list shows only rules that need better notification context.

## Bulk autofill annotations

1. Select one or more filtered rules and click **Edit**, or open each rule individually.
1. In **6. Configure notification message**, click **Autofill**.
1. Review and edit the generated **Summary** and **Description**.
1. Click **Save rule**.

For a single rule during creation, refer to [Require and autofill annotations](ref:generate-required-annotations). When triaging firing instances, use [Search for related context](ref:search-related-context).
