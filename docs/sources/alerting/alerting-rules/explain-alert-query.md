---
canonical: https://grafana.com/docs/grafana/latest/alerting/alerting-rules/explain-alert-query/
description: Use the Explain toggle in the alert rule form to interpret the query and alert condition while creating or editing a rule.
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
  incident-context-for-alerts:
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/alerting-and-irm/irm/respond-to-alerts/incident-context-for-alerts/
---

{{< docs/public-preview product="Explain alert queries" >}}

# Explain alert queries

In **2. Define query and alert condition**, enable the **Explain** toggle to get an Assistant interpretation of the query and alert condition while you create or edit a Grafana-managed alert rule.

Use Explain to understand what the rule measures before you autofill **Summary** and **Description** in **6. Configure notification message**.

## Enable Explain

1. Open **Alerts & IRM** → **Alerting** → **Alert rules** → **New alert rule** or **Edit** on an existing rule.
1. In **2. Define query and alert condition**, turn on the **Explain** toggle above the query editor.
1. Enter or update the query and alert condition.
1. Review the Explain output for the query, threshold, and evaluation context.

## Use with Autofill

Explain helps you validate the query logic during rule authoring. When you are ready to add notification context:

1. Continue to **6. Configure notification message**.
1. Click **Autofill** to generate **Summary** and **Description** from the rule configuration.

Refer to [Require and autofill annotations](ref:generate-required-annotations).

## Assistant inputs

Explain uses the alert rule query, alert condition, labels, and evaluation settings. It may also use:

- Similar alerts with existing summaries and descriptions
- Notification history for the rule
- [IRM incident context](/docs/grafana-cloud/alerting-and-irm/irm/respond-to-alerts/incident-context-for-alerts/) for rules linked to past incidents
