---
canonical: https://grafana.com/docs/grafana/latest/alerting/mystery-alert/
description: Hackathon project documentation for making alert notifications actionable with summary, description, and Assistant-powered context.
keywords:
  - grafana
  - alerting
  - hackathon
  - summary
  - description
  - assistant
labels:
  products:
    - cloud
    - enterprise
    - oss
menuTitle: Mystery Alert (hackathon)
title: The Mystery Alert
weight: 165
refs:
  annotation-label:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/alerting/fundamentals/alert-rules/annotation-label/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/alerting-and-irm/alerting/fundamentals/alert-rules/annotation-label/
  declare-incident:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/alerting/monitor-status/declare-incident-from-alert/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/alerting-and-irm/alerting/monitor-status/declare-incident-from-alert/
  mystery-alert-irm:
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/alerting-and-irm/irm/mystery-alert/
---

{{< docs/public-preview product="The Mystery Alert hackathon project" >}}

# The Mystery Alert

Turn vague, unactionable alerts into context-rich notifications — before they page someone at 3am, and after they fire.

This documentation describes a **hackathon project** that connects Grafana Alerting, Grafana Assistant, and [Grafana IRM](ref:mystery-alert-irm) into a single workflow.

## The problem

You get paged. You open Grafana and see a vague alert name, a raw query, and nothing else. You ignore the notification, go back to bed, and wake up to a customer escalation.

Grafana Alerting already supports [summary and description annotations](ref:annotation-label) that make notifications actionable. This project puts them to work — automatically at rule creation, on demand when an alert fires, and after an incident is resolved in IRM.

## End-to-end workflow

| Phase | Product | What happens |
| --- | --- | --- |
| **Prevent** | Grafana Alerting | Require or auto-generate summary and description when creating alert rules |
| **Explain** | Grafana Alerting + Assistant | Add context to firing alerts with missing annotations |
| **Respond** | Grafana IRM | [Declare an incident](ref:declare-incident) from the alert and collaborate on resolution |
| **Improve** | Grafana IRM + Grafana Alerting | Ask whether the alert was useful and feed incident learnings back into the rule |

## Explore

{{< section withDescriptions="true" >}}

## Related IRM documentation

Continue the workflow in Grafana IRM:

- [The Mystery Alert in Grafana IRM](/docs/grafana-cloud/alerting-and-irm/irm/mystery-alert/) — alert usefulness check-in and incident-to-alert feedback loop
