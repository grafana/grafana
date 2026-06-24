---
canonical: https://grafana.com/docs/grafana/latest/alerting/mystery-alert/explain-firing-alerts/
description: Use the Explain action and Grafana Assistant to add summary and description context to firing alert instances.
keywords:
  - grafana
  - alerting
  - assistant
  - explain
labels:
  products:
    - cloud
    - enterprise
menuTitle: Explain firing alerts
title: Explain firing alerts
weight: 110
refs:
  view-alert-state:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/alerting/monitor-status/view-alert-state/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/alerting-and-irm/alerting/monitor-status/view-alert-state/
  evaluate-alert-quality:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/alerting/mystery-alert/evaluate-alert-quality/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/alerting-and-irm/alerting/mystery-alert/evaluate-alert-quality/
  irm-workflow:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/alerting/mystery-alert/irm-workflow/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/alerting-and-irm/alerting/mystery-alert/irm-workflow/
  declare-incident:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/alerting/monitor-status/declare-incident-from-alert/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/alerting-and-irm/alerting/monitor-status/declare-incident-from-alert/
---

# Explain firing alerts

When a firing alert has a vague name, an empty summary, or no description, on-call engineers need context fast. **Explain** uses Grafana Assistant to infer what the alert means and suggest actionable annotations.

## Before you begin

- You need a firing alert instance. Refer to [View alert state](ref:view-alert-state).
- Grafana Assistant must be available in your environment.

## Explain an alert instance

1. Navigate to **Alerts & IRM** → **Alerting** → **Alert rules** or **Alerts**.
1. Open a **firing** alert instance with missing or very short summary and description annotations.
1. Click **Explain**.

An **Explain** drawer opens with:

- A proposed **summary** for notifications
- A proposed **description** with runbook-style context
- Notes on which signals were used (query, labels, similar alerts, notification history)

{{< admonition type="note" >}}
Explain is most useful when `summary` or `description` annotations are empty or too short to act on. Refer to [Evaluate alert quality](ref:evaluate-alert-quality) to decide whether the alert needs better documentation or is likely noise.
{{< /admonition >}}

## Add context to the alert rule

If the generated context is accurate, persist it on the alert rule so future notifications are actionable.

1. In the Explain drawer, review the proposed summary and description.
1. Click **Add this context to the alert**.
1. Confirm to update the alert rule annotations.

## Declare an incident

If the alert requires coordinated response, [declare an incident from the firing alert](ref:declare-incident). The incident links back to the alert rule and continues the workflow in [Grafana IRM](ref:irm-workflow).

## Assistant inputs and outputs

Explain sends the following to Grafana Assistant:

| Input | Used for |
| --- | --- |
| Alert rule query and expressions | Interpreting what is being measured |
| Labels and existing annotations | Instance-specific context |
| Notification history (bonus) | Whether the alert was previously silenced or ignored |
| IRM incident history (bonus) | Past incidents triggered by this rule |

| Output | Destination |
| --- | --- |
| Proposed summary | Explain drawer; optional notification template |
| Proposed description | Explain drawer; optional notification template |
| Recurrence and quality signals | [Evaluate alert quality](ref:evaluate-alert-quality) |

## Next steps

- [Evaluate alert quality](ref:evaluate-alert-quality) — decide if the alert is under-documented or useless
- [IRM workflow](ref:irm-workflow) — close the loop after incident resolution
