---
canonical: https://grafana.com/docs/grafana/latest/alerting/alerting-rules/generate-required-annotations/
description: Require summary and description annotations on Grafana-managed alert rules and use Autofill to generate them from the alert query.
keywords:
  - grafana
  - alerting
  - summary
  - description
  - annotations
  - autofill
labels:
  products:
    - cloud
    - enterprise
    - oss
menuTitle: Required annotations
title: Require and autofill annotations
weight: 95
refs:
  annotation-label:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/alerting/fundamentals/alert-rules/annotation-label/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/alerting-and-irm/alerting/fundamentals/alert-rules/annotation-label/
  create-grafana-managed-rule:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/alerting/alerting-rules/create-grafana-managed-rule/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/alerting-and-irm/alerting/alerting-rules/create-grafana-managed-rule/
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
  provision-alerting:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/alerting/set-up/provision-alerting-resources/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/alerting-and-irm/alerting/set-up/provision-alerting-resources/
---

{{< docs/public-preview product="Required annotations" >}}

# Require and autofill annotations

When you [create or edit a Grafana-managed alert rule](ref:create-grafana-managed-rule), **Summary** and **Description** are required in **6. Configure notification message**. Use **Autofill** to generate both from the alert query, condition, and evaluation settings.

## Required summary and description

In **6. Configure notification message**, enter values for:

| Field           | Maps to                   | Helper text in UI                        |
| --------------- | ------------------------- | ---------------------------------------- |
| **Summary**     | `annotations.summary`     | Short summary of what happened and why.  |
| **Description** | `annotations.description` | Description of what the alert rule does. |

If either field is empty when you click **Save rule**, the form shows a field-level error:

- `Summary is required. Enter a value or use Autofill.`
- `Description is required. Enter a value or use Autofill.`

A notification also appears: **There are errors in the form. Please correct them and try again!**

## Autofill summary and description

Click **Autofill** above the Summary field to generate both annotations from the alert rule configuration.

Autofill uses:

- Alert rule name
- Query and alert condition
- Pending period and evaluation interval

For example, for a rule named `API availability` with query `up{job="api"} == 0`, Autofill may generate:

- **Summary:** `API availability: last() is above 0`
- **Description:** `Alert rule "API availability" monitors query A: up{job="api"} == 0. It fires when last() is above 0. The condition must hold for 5m before firing. Evaluated every 1m.`

Review and edit the generated text before saving.

## Procedure

1. Complete steps 1–5 of the alert rule form, including the query in **2. Define query and alert condition**.
1. In **6. Configure notification message**, click **Autofill** or enter a **Summary** and **Description** manually.
1. Optionally add a **Runbook URL**, custom annotations, or **Link dashboard and panel**.
1. Click **Save rule**.

To preview how Assistant interprets the query before autofill, enable **Explain** in **2. Define query and alert condition**. Refer to [Explain alert queries](ref:explain-alert-query).

When triaging a firing instance on the **Alerts** page, use [Search for related context](ref:search-related-context) to find other notifications that share correlation labels.

## Export updated annotations

After annotations are added or updated in the UI, export the rule for rules-as-code workflows. Refer to [Provision Alerting resources](ref:provision-alerting).

## Scope

This feature applies to Grafana-managed alert rules created or edited in the UI. Data source-managed rules and externally provisioned rules are unchanged.
