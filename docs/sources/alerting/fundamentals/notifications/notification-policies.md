---
aliases:
  - ../notification-policies/notifications/ # /docs/grafana/<GRAFANA_VERSION>/alerting/fundamentals/notification-policies/notifications/
canonical: https://grafana.com/docs/grafana/latest/alerting/fundamentals/notifications/notification-policies/
description: Learn about how notification policies work and are structured
keywords:
  - grafana
  - alerting
  - alertmanager
  - notification policies
  - contact points
  - silences
labels:
  products:
    - cloud
    - enterprise
    - oss
title: Notification policies
weight: 113
---

# Notification policies

Notification policies provide you with a flexible way of routing alerts to various different receivers. Using label matchers, you can modify alert notification delivery without having to update every individual alert rule.

Learn more about how notification policies work and are structured, so that you can make the most out of setting up your notification policies.

## Policy tree

Notification policies are _not_ a list, but rather are structured according to a [tree structure](https://en.wikipedia.org/wiki/Tree_structure). This means that each policy can have child policies, and so on. The root of the notification policy tree is called the **Default notification policy**.

Each policy consists of a set of label matchers (0 or more) that specify which labels they are or aren't interested in handling.

For more information on label matching, see [how label matching works][labels-and-label-matchers].

{{% admonition type="note" %}}
If you haven't configured any label matchers for your notification policy, your notification policy will match _all_ alert instances. This may prevent child policies from being evaluated unless you have enabled **Continue matching siblings** on the notification policy.
{{% /admonition %}}

## Routing

To determine which notification policy will handle which alert instances, you have to start by looking at the existing set of notification policies, starting with the default notification policy.

If no policies other than the default policy are configured, the default policy will handle the alert instance.

If policies other than the default policy are defined, it will evaluate those notification policies in the order they are displayed.

If a notification policy has label matchers that match the labels of the alert instance, it will descend in to its child policies and, if there are any, will continue to look for any child policies that might have label matchers that further narrow down the set of labels, and so forth until no more child policies have been found.

If no child policies are defined in a notification policy or if none of the child policies have any label matchers that match the alert instance's labels, the default notification policy is used.

As soon as a matching policy is found, the system does not continue to look for other matching policies. If you want to continue to look for other policies that may match, enable **Continue matching siblings** on that particular policy.

Lastly, if none of the notification policies are selected the default notification policy is used.

### Routing example

Here is an example of a relatively simple notification policy tree and some alert instances.

{{< figure src="/media/docs/alerting/notification-routing.png" max-width="750px" caption="Notification policy routing" >}}

Here's a breakdown of how these policies are selected:

**Pod stuck in CrashLoop** does not have a `severity` label, so none of its child policies are matched. It does have a `team=operations` label, so the first policy is matched.

The `team=security` policy is not evaluated since we already found a match and **Continue matching siblings** was not configured for that policy.

**Disk Usage – 80%** has both a `team` and `severity` label, and matches a child policy of the operations team.

**Unauthorized log entry** has a `team` label but does not match the first policy (`team=operations`) since the values are not the same, so it will continue searching and match the `team=security` policy. It does not have any child policies, so the additional `severity=high` label is ignored.

## Inheritance

In addition to child policies being a useful concept for routing alert instances, they also inherit properties from their parent policy. This also applies to any policies that are child policies of the default notification policy.

The following properties are inherited by child policies:

- Contact point
- Grouping options
- Timing options
- Mute timings

Each of these properties can be overwritten by an individual policy should you wish to override the inherited properties.

To inherit a contact point from the parent policy, leave it blank. To override the inherited grouping options, enable **Override grouping**. To override the inherited timing options, enable **Override general timings**.

### Inheritance example

The example below shows how the notification policy tree from our previous example allows the child policies of the `team=operations` to inherit its contact point.

In this way, we can avoid having to specify the same contact point multiple times for each child policy.

{{< figure src="/media/docs/alerting/notification-inheritance.png" max-width="750px" caption="Notification policy inheritance" >}}

## Additional configuration options

### Grouping

Grouping is an important feature of Grafana Alerting as it allows you to batch relevant alerts together into a smaller number of notifications. This is particularly important if notifications are delivered to first-responders, such as engineers on-call, where receiving lots of notifications in a short period of time can be overwhelming and in some cases can negatively impact a first-responders ability to respond to an incident. For example, consider a large outage where many of your systems are down. In this case, grouping can be the difference between receiving 1 phone call and 100 phone calls.

You choose how alerts are grouped together using the Group by option in a notification policy. By default, notification policies in Grafana group alerts together by alert rule using the `alertname` and `grafana_folder` labels (since alert names are not unique across multiple folders). Should you wish to group alerts by something other than the alert rule, change the grouping to any other combination of labels.

#### Disable grouping

Should you wish to receive every alert as a separate notification, you can do so by grouping by a special label called `...`. This is useful when your alerts are being delivered to an automated system instead of a first-responder.

#### A single group for all alerts

Should you wish to receive all alerts together in a single notification, you can do so by leaving Group by empty.

### Timing options

The timing options decide how often notifications are sent for each group of alerts. There are three timers that you need to know about: Group wait, Group interval, and Repeat interval.

#### Group wait

Group wait is the amount of time Grafana waits before sending the first notification for a new group of alerts. The longer Group wait is the more time you have for other alerts to arrive. The shorter Group wait is the earlier the first notification will be sent, but at the risk of sending incomplete notifications. You should always choose a Group wait that makes the most sense for your use case.

**Default** 30 seconds

#### Group interval

Once the first notification has been sent for a new group of alerts, Grafana starts the Group interval timer. This is the amount of time Grafana waits before sending notifications about changes to the group. For example, another firing alert might have just been added to the group while an existing alert might have resolved. If an alert was too late to be included in the first notification due to Group wait, it will be included in subsequent notifications after Group interval. Once Group interval has elapsed, Grafana resets the Group interval timer. This repeats until there are no more alerts in the group after which the group is deleted.

**Default** 5 minutes

#### Repeat interval

Repeat interval decides how often notifications are repeated if the group has not changed since the last notification. You can think of these as reminders that some alerts are still firing. Repeat interval is closely related to Group interval, which means your Repeat interval must not only be greater than or equal to Group interval, but also must be a multiple of Group interval. If Repeat interval is not a multiple of Group interval it will be coerced into one. For example, if your Group interval is 5 minutes, and your Repeat interval is 9 minutes, the Repeat interval will be rounded up to the nearest multiple of 5 which is 10 minutes.

**Default** 4 hours

{{% docs/reference %}}
[labels-and-label-matchers]: "/docs/grafana/ -> /docs/grafana/<GRAFANA_VERSION>/alerting/fundamentals/alert-rules/annotation-label#how-label-matching-works"
[labels-and-label-matchers]: "/docs/grafana-cloud/ -> /docs/grafana-cloud/alerting-and-irm/alerting/fundamentals/alert-rules/annotation-label#how-label-matching-works"
{{% /docs/reference %}}
