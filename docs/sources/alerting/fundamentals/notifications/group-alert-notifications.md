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

Grouping is an important feature of Grafana Alerting as it allows you to batch relevant alerts together into a smaller number of notifications. This is particularly important if notifications are delivered to first-responders, such as engineers on-call, where receiving lots of notifications in a short period of time can be overwhelming and in some cases can negatively impact a first-responders ability to respond to an incident. For example, consider a large outage where many of your systems are down. In this case, grouping can be the difference between receiving 1 phone call and 100 phone calls.

## Group notifications

Grouping combines similar alert instances within a specific period into a single notification, reducing alert noise.

In the notification policy, you can configure how to group multiple alerts into a single notification:

- The `Group by` option specifies the criteria for grouping incoming alerts within the policy. The default is by alert rule.
- [Timing options](#timing-options) determine when to sent the notification.

{{< figure src="/media/docs/alerting/alerting-notification-policy-diagram-with-labels-v3.png" max-width="750px" alt="A diagram about the components of a notification policy, including labels and groups" >}}

### Group by alert rule or labels

By default, notification policies in Grafana **group alerts by the alert rule**, grouping by the `alertname` and `grafana_folder` labels (since alert names are not unique across folders).

If you want to **group alerts by other labels**, something other than the alert rule, change the `Group by` option to any other combination of labels.

### A single group for all alerts

If you want to group all alerts handled by the notification policy in a single group (without grouping notifications by alert rule or other labels), you can do so by leaving `Group by` empty.

### Disable grouping

If you want to receive every alert as a separate notification, you can do so by grouping by a special label called `...`.

## Timing options

The timing options decide how often notifications are sent for each group of alerts. There are three timers that you need to know about: Group wait, Group interval, and Repeat interval.

#### Group wait

Group wait is the amount of time Grafana waits before sending the first notification for a new group of alerts. The longer Group wait is the more time you have for other alerts to arrive. The shorter Group wait is the earlier the first notification is sent, but at the risk of sending incomplete notifications. You should always choose a Group wait that makes the most sense for your use case.

**Default** 30 seconds

#### Group interval

Once the first notification has been sent for a new group of alerts, the Group interval timer starts. This is the amount of wait time before notifications about changes to the group are sent. For example, another firing alert might have just been added to the group while an existing alert might have resolved. If an alert was too late to be included in the first notification due to Group wait, it is included in subsequent notifications after Group interval. Once Group interval has elapsed, Grafana resets the Group interval timer. This repeats until there are no more alerts in the group after which the group is deleted.

**Default** 5 minutes

#### Repeat interval

Repeat interval decides how often notifications are repeated if the group has not changed since the last notification. You can think of these as reminders that some alerts are still firing. Repeat interval is closely related to Group interval, which means your Repeat interval must not only be greater than or equal to Group interval, but also must be a multiple of Group interval. If Repeat interval is not a multiple of Group interval it is coerced into one. For example, if your Group interval is 5 minutes, and your Repeat interval is 9 minutes, the Repeat interval is rounded up to the nearest multiple of 5 which is 10 minutes.

**Default** 4 hours
