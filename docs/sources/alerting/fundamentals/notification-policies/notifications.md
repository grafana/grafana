---
aliases:
  - ../notifications/
  - alerting/manage-notifications/create-notification-policy/
description: Notification policies
keywords:
  - grafana
  - alerting
  - alertmanager
  - notification policies
  - contact points
  - silences
title: Notification policies
weight: 410
---

# Notification policies

Notification policies provide you with a flexible way of routing alerts to various different receivers. Using label matchers, you can modify alert notification delivery without having to update every individual alert rule.

Learn more about how notification policies work and are structured, so that you can make the most out of setting up your notification policies.

## Policy tree

Notification policies are _not_ a list, but rather are structured according to a [tree structure](https://en.wikipedia.org/wiki/Tree_structure). This means that each policy can have child policies, and so on. The root of the notification policy tree is called the **Default notification policy**.

Each policy consists of a set of label matchers (0 or more) that specify which labels they are or aren't interested in handling.

For more information on label matching, see [how label matching works]({{< relref "../annotation-label/labels-and-label-matchers.md" >}}).

{{% admonition type="note" %}}
If you haven't configured any label matchers for your notification policy, your notification policy will match _all_ alert instances. This may prevent child policies from being evaluated unless you have enabled **Continue matching siblings** on the notification policy.
{{% /admonition %}}

## Routing

To determine which notification policy will handle which alert instances, you have to start by looking at the existing set of notification policies, starting with the default notification policy.

If no policies other than the default policy are configured, the default policy will handle the alert instance.

If policies other than the default policy are defined, it will inspect those notification policies in descending order.

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

Grouping is a key concept in Grafana Alerting that categorizes alert instances of similar nature into a single funnel. This allows you to properly route alert notifications during larger outages when many parts of a system fail at once causing a high number of alerts to fire simultaneously.

Grouping options determine _which_ alert instances are bundled together.

When an alert instance is matched to a specific notification policy, it no longer has any association with its alert rule.

To group alert instances by the original alert rule, set the grouping using `alertname` and `grafana_folder` (since alert names are not unique across multiple folders).

This is also the default setting for the built-in Grafana Alertmanager.

Should you wish to group alert instances by something other than the alert rule, check the grouping to any other combination of label keys.

#### Turn off grouping

Should you wish to receive every alert instance as a separate notification, choose to do so by grouping by a special label called `...`.

#### Everything in a single group

Should you wish to receive all alert instance in a single notification, create an empty list of labels to group by.

### Timing options

Timing options can be updated and affect _when_ a group of notifications are sent to their corresponding contact point.

#### Group wait

The waiting time until the initial notification is sent for a **new group** created by an incoming alert.

**Default** 30 seconds

#### Group interval

The waiting time to send a batch of alert instances for **existing groups**.

{{% admonition type="note" %}}
This means that notifications will **not** be sent any sooner than 5 minutes (default) since the last batch of updates were delivered, regardless of whether the alert rule interval for those alert instances was lower.
{{% /admonition %}}

**Default** 5 minutes

#### Repeat interval

The waiting time to resend an alert after they have successfully been sent. This means notifications for **firing** alerts will be re-delivered every 4 hours (default).

**Default** 4 hours
