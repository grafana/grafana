---
canonical: https://grafana.com/docs/grafana/latest/alerting/mystery-alert/irm-workflow/
description: Connect Grafana Alerting and Grafana IRM to improve alerts after incidents resolve.
keywords:
  - grafana
  - alerting
  - irm
  - incident
labels:
  products:
    - cloud
menuTitle: IRM workflow
title: Alerting and IRM workflow
weight: 130
refs:
  declare-incident:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/alerting/monitor-status/declare-incident-from-alert/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/alerting-and-irm/alerting/monitor-status/declare-incident-from-alert/
  explain-firing-alerts:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/alerting/mystery-alert/explain-firing-alerts/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/alerting-and-irm/alerting/mystery-alert/explain-firing-alerts/
  mystery-alert-irm:
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/alerting-and-irm/irm/mystery-alert/
  irm-usefulness-check-in:
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/alerting-and-irm/irm/mystery-alert/alert-usefulness-check-in/
  irm-link-context:
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/alerting-and-irm/irm/mystery-alert/link-incident-context-to-alerts/
---

# Alerting and IRM workflow

Grafana Alerting detects problems. Grafana IRM coordinates the response and captures what your team learned. This hackathon connects both products so alert quality improves over time.

## Workflow overview

1. **Detect** — Grafana Alerting fires an alert. If context is missing, use [Explain firing alerts](ref:explain-firing-alerts).
1. **Respond** — [Declare an incident from the firing alert](ref:declare-incident). The alert rule links to the incident timeline.
1. **Resolve** — Your team contains and resolves the incident in Grafana IRM.
1. **Learn** — IRM asks whether the triggering alert was useful and suggests improvements to the alert rule.

## During the incident

When you declare an incident from an alert:

- The incident title is pre-filled from the alert rule name.
- The alert rule remains linked to the incident for traceability.
- IRM timeline entries and linked context can inform later alert improvements.

## After the incident

When the incident is resolved, continue in Grafana IRM:

- [Alert usefulness check-in](ref:irm-usefulness-check-in) — answer **Was this alert useful?**
- [Link incident context to alerts](ref:irm-link-context) — feed timeline and incident notes back into alert annotations

{{< admonition type="note" >}}
IRM workflow features in this hackathon are available in Grafana Cloud. Refer to [The Mystery Alert in Grafana IRM](ref:mystery-alert-irm) for the IRM-side documentation.
{{< /admonition >}}

## Suggested Alert or SLO (stretch)

After a resolved incident, Grafana Assistant may suggest a new alert rule or SLO based on incident context. This is a stretch goal for the hackathon prototype.

## Related documentation

- [The Mystery Alert in Grafana IRM](/docs/grafana-cloud/alerting-and-irm/irm/mystery-alert/) — IRM product documentation for this hackathon
- [Resolve and learn from incidents](/docs/grafana-cloud/alerting-and-irm/irm/manage-incidents/resolve-and-learn/) — existing IRM post-incident guidance
