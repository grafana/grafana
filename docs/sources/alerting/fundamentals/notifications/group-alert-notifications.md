---
canonical: https://grafana.com/docs/grafana/latest/alerting/fundamentals/notifications/group-alert-notifications/
description: Learn about how notification policies group alert notifications
keywords:
  - grafana
  - alerting
  - notification policies
labels:
  products:
    - cloud
    - enterprise
    - oss
title: Group alert notifications
menuTitle: Grouping
weight: 114
refs:
  alert-labels:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/alerting/fundamentals/alert-rules/annotation-label/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/alerting-and-irm/alerting/fundamentals/alert-rules/annotation-label/
  notification-policies:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/alerting/fundamentals/notifications/notification-policies/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/alerting-and-irm/alerting/fundamentals/notifications/notification-policies/
  silences:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/alerting/configure-notifications/create-silence/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/alerting-and-irm/alerting/configure-notifications/create-silence/
---

# Group alert notifications

Grouping in Grafana Alerting allows you to batch relevant alerts together into a smaller number of notifications. This is particularly important if notifications are delivered to first-responders, such as engineers on-call, where receiving lots of notifications in a short period of time can be overwhelming. In some cases, it can negatively impact a first-responders ability to respond to an incident. For example, consider a large outage where many of your systems are down. In this case, grouping can be the difference between receiving 1 phone call and 100 phone calls.

{{< admonition type="tip" >}}
For a practical example of grouping, refer to our [Getting Started with Grouping tutorial](https://grafana.com/tutorials/alerting-get-started-pt3/).
{{< /admonition  >}}

## Group notifications

Grouping combines similar alert instances within a specific period into a single notification, reducing alert noise.

In the [notification policy](ref:notification-policies), you can configure how to group multiple alerts into a single notification:

- The `Group by` option specifies the criteria for grouping incoming alerts within the policy. The default is by alert rule.
- [Timing options](#timing-options) determine when and how often to send the notification.

{{< figure src="/media/docs/alerting/alerting-notification-policy-diagram-with-labels-v3.png" max-width="750px" alt="A diagram about the components of a notification policy, including labels and groups" >}}

Alert instances are grouped together if they have the same exact label values for the labels configured in the `Group by` option.

For example, given the `Group by` option set to the `team` label:

- `alertname:foo, team=frontend`, and `alertname:bar, team=frontend` are in one group.
- `alertname:foo, team=backend`, and `alertname:qux, team=backend` are in another group.

### Group by alert rule or labels

By default, notification policies in Grafana group alerts by the alert rule. Specifically, they are grouped using the `alertname` and `grafana_folder` labels, as alert rule names are not unique across folders.

If you want to group alerts by other labels, something other than the alert rule, change the `Group by` option to any other combination of labels.

### A single group for all alerts

If you want to group all alerts handled by the notification policy in a single group (without grouping notifications by alert rule or other labels), leave `Group by` empty in the Default policy.

### Disable grouping

If you want to receive every alert as a separate notification, you can do so by grouping by a special label called `...`, ensuring that other labels are not present.

## Timing options

In the notification policy, you can also configure how often notifications are sent for each [group of alerts](#group-notifications). There are three distinct timers applied to groups within the notification policy:

- **[Group wait](#group-wait)**: the time to wait before sending the first notification for a new group of alerts.
- **[Group interval](#group-interval)**: the time to wait before sending a notification about changes in the alert group.
- **[Repeat interval](#repeat-interval)**: the time to wait before sending a notification if the group has not changed since the last notification.

These timers reduce the number of notifications sent. By delaying the delivery of notifications, incoming alerts can be grouped into just one notification instead of many.

{{< figure src="/media/docs/alerting/alerting-timing-options-flowchart-v2.png" max-width="750px" alt="A basic sequence diagram of the the notification policy timers" caption="A basic sequence diagram of the notification policy timers" >}}

<!--
flowchart LR
    A((First alert)) -///-> B
    B[Group wait <br/>  notification] -///-> C
    B -- no changes -///-> D
    C[Group interval <br/>  notification] -- no changes -///-> D
    C -- group changes -///-> C
    D[Repeat interval <br/>  notification]
-->

### Group wait

**Default**: 30 seconds

Group wait is the duration Grafana waits before sending the first notification for a new group of alerts.

The longer the group wait, the more time other alerts have to be included in the initial notification of the new group. The shorter the group wait, the earlier the first notification is sent, but at the risk of not including some alerts.

**Example**

Consider a notification policy that:

- Matches all alert instances with the `team` label—matching labels equals to `team=~.+`.
- Groups notifications by the `team` label—one group for each distinct `team`.
- Sets the Group wait timer to `30s`.

| Time               | Incoming alert instance        | Notification policy group | Number of instances |                                                                         |
| ------------------ | ------------------------------ | ------------------------- | ------------------- | ----------------------------------------------------------------------- |
| 00:00              | `alertname=f1` `team=frontend` | `frontend`                | 1                   | Starts the group wait timer of the `frontend` group.                    |
| 00:10              | `alertname=f2` `team=frontend` | `frontend`                | 2                   |                                                                         |
| 00:20              | `alertname=b1` `team=backend`  | `backend`                 | 1                   | Starts the group wait timer of the `backend` group.                     |
| 00:30<sup>\*</sup> |                                | `frontend`                | 2                   | Group wait elapsed. <br/> Send initial notification reporting 2 alerts. |
| 00:35              | `alertname=b2` `team=backend`  | `backend`                 | 2                   |                                                                         |
| 00:40              | `alertname=b3` `team=backend`  | `backend`                 | 3                   |                                                                         |
| 00:50<sup>\*</sup> |                                | `backend`                 | 3                   | Group wait elapsed. <br/> Send initial notification reporting 3 alerts. |

### Group interval

**Default**: 5 minutes

If an alert was too late to be included in the first notification due to group wait, it is included in subsequent notifications after group interval.

Group interval is the duration to wait before sending notifications about group changes. For instance, a group change may be adding a new firing alert to the group, or resolving an existing alert.

**Example**

Here are the related excerpts from the previous example:

| Time               | Incoming alert instance | Notification policy group | Number of instances |                                                                                                         |
| ------------------ | ----------------------- | ------------------------- | ------------------- | ------------------------------------------------------------------------------------------------------- |
| 00:30<sup>\*</sup> |                         | `frontend`                | 2                   | Group wait elapsed and starts Group interval timer. <br/> Send initial notification reporting 2 alerts. |
| 00:50<sup>\*</sup> |                         | `backend`                 | 3                   | Group wait elapsed and starts Group interval timer. <br/> Send initial notification reporting 3 alerts. |

And below is the continuation of the example setting the Group interval timer to 5 minutes:

| Time               | Incoming alert instance        | Notification policy group | Number of instances |                                                                                                |
| ------------------ | ------------------------------ | ------------------------- | ------------------- | ---------------------------------------------------------------------------------------------- |
| 01:30              | `alertname=f3` `team=frontend` | `frontend`                | 3                   |                                                                                                |
| 02:30              | `alertname=f4` `team=frontend` | `frontend`                | 4                   |                                                                                                |
| 05:30<sup>\*</sup> |                                | `frontend`                | 4                   | Group interval elapsed and resets timer. <br/> Send one notification reporting 4 alerts.       |
| 05:50<sup>\*</sup> |                                | `backend`                 | 3                   | Group interval elapsed and resets timer. <br/> No group changes, and do not send notification. |
| 08:00              | `alertname=f4` `team=backend`  | `backend`                 | 4                   |                                                                                                |
| 10:30<sup>\*</sup> |                                | `frontend`                | 4                   | Group interval elapsed and resets timer. <br/> No group changes, and do not send notification. |
| 10:50<sup>\*</sup> |                                | `backend`                 | 4                   | Group interval elapsed and resets timer. <br/> Send one notification reporting 4 alerts.       |

**How it works**

Once the first notification has been sent for a new group of alerts, the group interval timer starts.

When the group interval timer elapses, the system resets the group interval timer and sends a notification only if there were group changes. This process repeats until there are no more alerts.

It's important to note that an alert instance exits the group after being resolved and notified of its state change. When no alerts remain, the group is deleted, and then the group wait timer handles the first notification for the next incoming alert once again.

### Repeat interval

**Default**: 4 hours

Repeat interval acts as a reminder that alerts in the group are still firing.

The repeat interval timer decides how often notifications are sent (or repeated) if the group has not changed since the last notification.

**How it works**

Repeat interval is evaluated every time the group interval resets. If the alert group has not changed and the time since the last notification was longer than the repeat interval, then a notification is sent as a reminder that the alerts are still firing.

Repeat interval must not only be greater than or equal to group interval, but also must be a multiple of Group interval. If Repeat interval is not a multiple of group interval it is coerced into one. For example, if your Group interval is 5 minutes, and your Repeat interval is 9 minutes, the Repeat interval is rounded up to the nearest multiple of 5 which is 10 minutes.

**Example**

Here are the related excerpts from the previous example:

| Time               | Incoming alert instance | Notification policy group | Number of instances |                                                          |
| ------------------ | ----------------------- | ------------------------- | ------------------- | -------------------------------------------------------- |
| 05:30<sup>\*</sup> |                         | `frontend`                | 4                   | Group interval resets. <br/> Send the last notification. |
| 10:50<sup>\*</sup> |                         | `backend`                 | 4                   | Group interval resets. <br/> Send the last notification. |

And below is the continuation of the example setting the Repeat interval timer to 4 hours:

| Time     | Incoming alert instance | Notification policy group | Number of instances |                                                                                                                                                             |
| -------- | ----------------------- | ------------------------- | ------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 04:05:30 |                         | `frontend`                | 4                   | Group interval resets. The time since the last notification was no longer than the repeat interval.                                                         |
| 04:10:30 |                         | `frontend`                | 4                   | Group interval resets. The time since the last notification was longer than the repeat interval. <br/> Send one notification reminding the 4 firing alerts. |
| 04:10:50 |                         | `backend`                 | 4                   | Group interval resets. The time since the last notification was no longer than the repeat interval.                                                         |
| 04:15:50 |                         | `backend`                 | 4                   | Group interval resets. The time since the last notification was longer than the repeat interval. <br/> Send one notification reminding the 4 firing alerts. |
