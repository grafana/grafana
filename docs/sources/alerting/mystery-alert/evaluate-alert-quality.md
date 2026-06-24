---
canonical: https://grafana.com/docs/grafana/latest/alerting/mystery-alert/evaluate-alert-quality/
description: Decide whether an alert is under-documented or genuinely useless using history, similar alerts, and query analysis.
keywords:
  - grafana
  - alerting
  - alert quality
labels:
  products:
    - cloud
    - enterprise
menuTitle: Evaluate alert quality
title: Evaluate alert quality
weight: 120
refs:
  explain-firing-alerts:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/alerting/mystery-alert/explain-firing-alerts/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/alerting-and-irm/alerting/mystery-alert/explain-firing-alerts/
  view-alert-state-history:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/alerting/monitor-status/view-alert-state-history/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/alerting-and-irm/alerting/monitor-status/view-alert-state-history/
  prevent-missing-context:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/alerting/mystery-alert/prevent-missing-context/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/alerting-and-irm/alerting/mystery-alert/prevent-missing-context/
---

# Evaluate alert quality

Not every vague alert needs a better description. Some alerts are noisy, misconfigured, or no longer relevant. Use impact evaluation to decide the right next step.

## Signals to check

| Signal | What it tells you |
| --- | --- |
| **Similar alerts** | Other rules with comparable queries or labels that already have good summaries |
| **Notification history** | Whether responders acknowledged, silenced, or ignored pages |
| **Alert state history** | Whether the alert is recurring or flapping. Refer to [View alert state and history](ref:view-alert-state-history). |
| **Query analysis** | Whether the query is too broad, missing filters, or otherwise low-signal |
| **IRM incident history** | Whether past incidents linked to this alert were marked as not useful |

## Decision guide

### Alert is not recurring

The alert may simply be **under-documented**.

1. Run [Explain firing alerts](ref:explain-firing-alerts).
1. Check similar alerts for summary and description text to reuse.
1. Review notification history for past responder actions.
1. Add generated context to the rule with **Add this context to the alert**.

### Alert is recurring

The alert may be **noisy or useless**.

1. Check notification and IRM history for repeated silences or unresolved pages.
1. Review alert state history for flapping patterns.
1. Consider tuning the threshold, adding runbook context, or removing the rule.

{{< admonition type="tip" >}}
A recurring alert with good annotations is still worth fixing at the source — adjust the query or threshold rather than only improving the text.
{{< /admonition >}}

## Bulk identification (bonus)

Platform teams can filter the alert rules list for rules with missing or very short summary and description annotations, then apply Explain or generation in bulk.

## Next steps

- [Prevent missing context](ref:prevent-missing-context) — stop new vague rules from being created
- [Explain firing alerts](ref:explain-firing-alerts) — generate context for a firing instance
