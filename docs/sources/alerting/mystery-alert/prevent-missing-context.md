---
canonical: https://grafana.com/docs/grafana/latest/alerting/mystery-alert/prevent-missing-context/
description: Require summary and description annotations when creating Grafana-managed alert rules, with optional Assistant generation on save.
keywords:
  - grafana
  - alerting
  - summary
  - description
  - validation
labels:
  products:
    - cloud
    - enterprise
    - oss
menuTitle: Prevent missing context
title: Prevent missing context at rule creation
weight: 100
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
  explain-firing-alerts:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/alerting/mystery-alert/explain-firing-alerts/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/alerting-and-irm/alerting/mystery-alert/explain-firing-alerts/
  provision-alerting:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/alerting/set-up/provision-alerting-resources/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/alerting-and-irm/alerting/set-up/provision-alerting-resources/
---

# Prevent missing context at rule creation

Stop vague alerts at the source by making **summary** and **description** annotations part of the alert rule creation workflow.

## Before you begin

- Familiarize yourself with [labels and annotations](ref:annotation-label), especially the `summary` and `description` keys.
- You need permission to create or edit Grafana-managed alert rules. Refer to [Configure Grafana-managed alert rules](ref:create-grafana-managed-rule).

## Summary and description fields

When you [create a Grafana-managed alert rule](ref:create-grafana-managed-rule), the rule form includes dedicated fields for:

| Field           | Annotation key | Purpose                                           |
| --------------- | -------------- | ------------------------------------------------- |
| **Summary**     | `summary`      | Short text shown in notifications — what happened |
| **Description** | `description`  | Longer context — why it matters and what to do    |

{{< admonition type="tip" >}}
Use template variables such as `{{ $labels.instance }}` in both fields so notifications stay specific to each alert instance.
{{< /admonition >}}

## Validation on save

When you click **Save**, the form validates that both fields are populated.

1. Navigate to **Alerts & IRM** → **Alerting** → **Alert rules** → **New alert rule**.
1. Configure the query, labels, and evaluation settings.
1. Enter a **Summary** and **Description**.
1. Click **Save**.

If either field is empty, save is blocked and inline errors identify the missing fields.

## Generate with Assistant (bonus)

If summary or description is missing when you save, you can optionally generate values with Grafana Assistant instead of writing them manually.

1. Click **Save** with empty summary or description fields.
1. In the generation dialog, review the proposed **Summary** and **Description** created from your query and labels.
1. Edit the text as needed.
1. Confirm to save the rule with the generated annotations.

## Export for rules managed as code (bonus)

After updating annotations in the UI, export the rule so provisioning workflows stay in sync. Refer to [Provision Alerting resources](ref:provision-alerting) for file provisioning, HTTP API, and Terraform options.

## When validation does not apply

This hackathon scope focuses on **Grafana-managed alert rules** created in the UI. Data source-managed rules and rules provisioned outside the UI are out of scope for the initial prototype.

## Next steps

If an alert still fires without enough context, use [Explain firing alerts](ref:explain-firing-alerts) to generate context from the query and alert history.
