---
canonical: https://grafana.com/docs/grafana/latest/alerting/alerting-rules/generate-required-annotations/
description: Require summary and description annotations on Grafana-managed alert rules, with optional Assistant generation on save.
keywords:
  - grafana
  - alerting
  - summary
  - description
  - annotations
  - assistant
labels:
  products:
    - cloud
    - enterprise
    - oss
menuTitle: Required annotations
title: Require and generate annotations
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
  provision-alerting:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/alerting/set-up/provision-alerting-resources/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/alerting-and-irm/alerting/set-up/provision-alerting-resources/
---

{{< docs/public-preview product="Required annotations" >}}

# Require and generate annotations

Grafana-managed alert rules now require `summary` and `description` [annotations](ref:annotation-label) before you can save a rule in the UI. You can also generate both fields with Grafana Assistant when you save.

This reduces vague notifications that only show an alert name and query.

## Required summary and description

When you [create or edit a Grafana-managed alert rule](ref:create-grafana-managed-rule), the **Summary** and **Description** fields are mandatory.

- **Summary** maps to `annotations.summary` and appears in notifications.
- **Description** maps to `annotations.description` and provides runbook-style context.

If either field is empty, save is blocked and the form shows a field-level error.

## Generate with Assistant on save

If you save a rule with missing annotations, Grafana Assistant can propose values from the rule query, labels, and existing annotations.

1. Click **Save** on the alert rule form.
1. Review the proposed summary and description.
1. Edit the text if needed.
1. Confirm to save the rule.

## Export updated annotations

After annotations are added or updated in the UI, export the rule for rules-as-code workflows. Refer to [Provision Alerting resources](ref:provision-alerting).

## Scope

This feature applies to Grafana-managed alert rules created or edited in the UI. Data source-managed rules and externally provisioned rules are unchanged.
