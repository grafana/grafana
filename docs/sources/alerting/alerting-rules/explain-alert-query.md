---
canonical: https://grafana.com/docs/grafana/latest/alerting/alerting-rules/explain-alert-query/
description: Use the Explain toggle while creating or editing an alert rule to open Grafana Assistant for the query and condition.
keywords:
  - grafana
  - alerting
  - explain
  - assistant
labels:
  products:
    - cloud
    - enterprise
menuTitle: Explain alert queries
title: Explain alert queries
weight: 96
refs:
  generate-required-annotations:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/alerting/alerting-rules/generate-required-annotations/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/alerting-and-irm/alerting/alerting-rules/generate-required-annotations/
  create-grafana-managed-rule:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/alerting/alerting-rules/create-grafana-managed-rule/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/alerting-and-irm/alerting/alerting-rules/create-grafana-managed-rule/
---

{{< docs/public-preview product="Explain alert queries" >}}

# Explain alert queries

While you create or edit a Grafana-managed alert rule, turn on **Explain** in **2. Define query and alert condition** to open Grafana Assistant for the query and alert condition.

## Use Explain

1. Open **Alerts & IRM** → **Alerting** → **Alert rules** → **New alert rule** or **Edit**.
1. In **2. Define query and alert condition**, turn on **Explain** above the query editor.
1. Enter or update the query and alert condition.
1. Review the Assistant response.

## What you get

Assistant helps you understand what the rule measures and when it fires before you add notification text.

When you are ready, continue to **6. Configure notification message** and click **Autofill** or enter **Summary** and **Description** manually. Refer to [Require and autofill annotations](ref:generate-required-annotations).
