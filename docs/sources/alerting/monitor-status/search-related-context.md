---
canonical: https://grafana.com/docs/grafana/latest/alerting/monitor-status/search-related-context/
description: Search notification history from the Alert Activity page for related firing alerts that share correlation labels with a source instance.
keywords:
  - grafana
  - alerting
  - triage
  - notification history
  - related context
labels:
  products:
    - cloud
    - enterprise
menuTitle: Search related context
title: Search for related context
weight: 410
refs:
  alerts-page:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/alerting/monitor-status/alerts-page/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/alerting-and-irm/alerting/monitor-status/alerts-page/
  view-active-notifications:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/alerting/monitor-status/view-active-notifications/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/alerting-and-irm/alerting/monitor-status/view-active-notifications/
  generate-required-annotations:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/alerting/alerting-rules/generate-required-annotations/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/alerting-and-irm/alerting/alerting-rules/generate-required-annotations/
  annotation-label:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/alerting/fundamentals/alert-rules/annotation-label/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/alerting-and-irm/alerting/fundamentals/alert-rules/annotation-label/
---

{{< docs/public-preview product="Search for related context" >}}

# Search for related context

When a firing alert instance has empty or generic [summary and description](ref:annotation-label) annotations, on-call engineers still need to answer: **What else fired around this thing?**

**Search for related context** searches notification history for other firing alerts in the last 24 hours that share **correlation labels** with the source instance — for example the same `service`, `namespace`, or `cluster`. Results open in a drawer with an executive summary and expandable per-notification drill-down.

## Before you begin

- Open the [Alerts page](ref:alerts-page) at **Alerts & IRM** → **Alerting** → **Alerts**.
- Notification history must be enabled (`alertingNotificationHistoryGlobal` and `kubernetesAlertingHistorian` feature toggles).
- Alert triage must be enabled (`alertingTriage`).

## Open related context search

| Location                              | Placement                                                                                        |
| ------------------------------------- | ------------------------------------------------------------------------------------------------ |
| **Instance details drawer** (primary) | Header actions beside **Silence**, or prominently in the drawer body when annotations are sparse |
| **Instance row** (secondary)          | Below **Instance details** in the row actions                                                    |

Both entry points open the same related context drawer for the selected rule and instance.

1. On the **Alerts** page, find a firing instance with little useful context.
1. Open **Instance details**, or use the row action on the instance.
1. Click **Search for related context**.

## Related context drawer

The drawer subtitle reads: **Other notifications in the last 24 hours that may relate to this alert**.

### Executive summary

When results exist, a summary block appears above the list. It is built from notification metadata only — not an LLM.

The summary may include:

- **Search scope** — correlation labels used, for example `service=payments`
- **Headline** — for example `Found 7 notifications across 3 rules via 2 contact points.`
- **Recency** — for example `Most recent match: 45 minutes ago`
- **Key findings** (up to 3) — annotation snippets from the highest-ranked distinct rules, when available

Example key findings:

- `payments / HighMemory` — "Memory usage above 90% on checkout pods"
- `payments / PodRestarts` — "Pod checkout-7 restarted 5 times in 10m"

### Notification list

Results are ranked by relevance, then by timestamp:

| Element        | Description                                                                                  |
| -------------- | -------------------------------------------------------------------------------------------- |
| Timestamp      | When the notification was sent                                                               |
| Status         | Firing only in v1                                                                            |
| Receiver       | Contact point that received the notification                                                 |
| Rule count     | Number of rules in the notification                                                          |
| Matched labels | Badges showing which correlation label(s) matched                                            |
| Expand         | Lazy-loads firing alerts for that notification — rule link, labels, summary, and description |

The list shows **10** results initially. Click **Show more** to load the next 10.

Click **View all in notification history** to open [notification history](ref:view-active-notifications) filtered by the most selective matched label.

## How matching works

### Correlation labels

Search uses a subset of instance labels — not every label on the alert.

**Included** labels are correlation labels such as:

`service`, `namespace`, `cluster`, `env`, `pod`, `job`, `instance`, `team`, `region`, and similar `*_name` / `*_id` keys.

**Excluded** labels include:

`alertname`, `grafana_folder`, `severity`, `alertstate`, `rule_uid`, and private/internal keys.

Up to **5** correlation labels are used per search, in allowlist order then alphabetically.

{{< admonition type="note" >}}
A search on `{ service=payments, severity=critical }` queries `service=payments` only. It does not match fleet-wide noise from `severity=critical` alone.
{{< /admonition >}}

### Time window and status

- **Time range:** Last 24 hours (`now - 24h` → `now`), independent of the Alerts page time picker
- **Status:** Firing notifications only

### Ranking and self-exclusion

- More shared correlation labels = higher relevance
- Different rules rank above same-rule matches
- The **same rule + same instance** as the source is always excluded
- The **same rule on a different instance** may appear

## Empty states

| State                 | Message                                                          |
| --------------------- | ---------------------------------------------------------------- |
| No results            | `No related context found in the last 24 hours for these labels` |
| No correlation labels | `This instance has no correlation labels to search on`           |

Partial results may still display if some label queries fail.

## Example scenario

**Source:** Firing `HighCPU` on `{ service=payments, pod=checkout-7, severity=critical }` with empty summary and description.

**History (last 24h):** Notifications for `HighMemory`, `PodRestarts`, and `LatencySLO` sharing `service=payments`.

**Expected:**

- Search uses `service=payments`
- Cross-rule matches appear with `matched: service=payments` badges
- Expanding a row shows firing alerts with rule links and annotations
- The same `HighCPU` instance is excluded; `HighCPU` on a different pod may appear

## Improve the source alert

When key findings surface useful annotation text from related rules, edit the source rule and use [Autofill](ref:generate-required-annotations) or enter **Summary** and **Description** manually in **6. Configure notification message**.

## Out of scope (v1)

- LLM-generated narrative summaries
- Resolved notifications
- Changes to the global notification history page
