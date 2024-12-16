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
refs:
  shared-alert-labels:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/alerting/fundamentals/alert-rules/annotation-label/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/alerting-and-irm/alerting/fundamentals/alert-rules/annotation-label/
  shared-notification-policies:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/alerting/fundamentals/notifications/notification-policies/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/alerting-and-irm/alerting/fundamentals/notifications/notification-policies/
  shared-silences:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/alerting/configure-notifications/create-silence/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/alerting-and-irm/alerting/configure-notifications/create-silence/
  contact-points:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/alerting/fundamentals/notifications/contact-points/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/alerting-and-irm/alerting/fundamentals/notifications/contact-points/
  notification-timings:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/alerting/fundamentals/notifications/group-alert-notifications/#timing-options
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/alerting-and-irm/alerting/fundamentals/notifications/group-alert-notifications/#timing-options
  mute-timings:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/alerting/configure-notifications/mute-timings/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/alerting-and-irm/alerting/configure-notifications/mute-timings/
  group-alert-notifications:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/alerting/fundamentals/notifications/group-alert-notifications/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/alerting-and-irm/alerting/fundamentals/notifications/group-alert-notifications/
---

# Notification policies

Notification policies provide you with a flexible way of designing how to handle notifications and minimize alert noise.

Using label matchers, alert instances are [routed to notification policies](#routing). The notification policy can then [group multiple alert instances into a single notification](ref:group-alert-notifications) and deliver it to the contact point.

{{< figure src="/media/docs/alerting/how-alerting-works.png" max-width="750px" alt="How Alerting works" >}}

Notification policies are _not_ a list, but rather are structured according to a [tree structure](https://en.wikipedia.org/wiki/Tree_structure):

- The root of the notification policy tree is the **Default notification policy**.
- Each policy can have child policies.
- Each policy can have sibling policies, sharing the same parent and hierarchical level.

Each policy consists of a set of label matchers (0 or more) that specify which alerts they are or aren't interested in handling. A matching policy refers to a notification policy with label matchers that match the alert instance’s labels.

{{< docs/shared lookup="alerts/how_label_matching_works.md" source="grafana" version="<GRAFANA_VERSION>" >}}

{{< figure src="/media/docs/alerting/notification-routing.png" max-width="750px" caption="Matching alert instances with notification policies" alt="Example of a notification policy tree" >}}

## Routing

To determine which notification policies handle an alert instance, the system looks for matching policies starting from the top of the tree—beginning with the default notification policy.

If a matching policy is found, the system continues to evaluate its child policies in the order they are displayed. If a child policy matches the alert, the system then evaluates its child policies recursively until no more matching child policies are found. In this case, only the deepest matching child policy handles the alert instance.

By default, once a matching policy is found, the system does not continue to look for sibling policies. If you want sibling policies of one matching policy to handle the alert instance as well, then enable **Continue matching siblings** on the particular matching policy.

{{% admonition type="note" %}}

The default notification policy matches all alert instances. It always handles alert instances if there are no child policies or if none of the child policies match the alert instance's labels—this prevents any alerts from being missed.

If alerts use multiple labels, these labels must also be present in a notification policy to match and route notifications to a specific contact point.

{{% /admonition %}}

{{< collapse title="Routing example" >}}

Here's a breakdown of the previous example:

**Pod stuck in CrashLoop** does not have a `severity` label, so none of its child policies are matched. It does have a `team=operations` label, so the first policy is matched.

The `team=security` policy is not a match and **Continue matching siblings** was not configured for that policy.

**Disk Usage – 80%** has both a `team` and `severity` label, and matches a child policy of the operations team.

{{% admonition type="note" %}}
When an alert matches both a parent policy and a child policy (like it does in this case), the routing follows the child policy (`severity`) as it provides a more specific match.
{{% /admonition %}}

**Unauthorized log entry** has a `team` label but does not match the first policy (`team=operations`) since the values are not the same, so it will continue searching and match the `team=security` policy. It does not have any child policies, so the additional `severity=high` label is ignored.

{{< /collapse >}}

This routing and tree structure makes it convenient to organize and handle alerts for dedicated teams, while also narrowing down specific cases within the team by applying additional labels.

## Inheritance

In addition to child policies being a useful concept for routing alert instances, they also inherit properties from their parent policy. This also applies to child policies of the default notification policy.

By default, a child policy inherits the following notification properties from its parent:

- [Contact point](ref:contact-points)
- [Grouping options](ref:group-alert-notifications)
- [Timing options](ref:notification-timings)

Then, each policy can overwrite these properties if needed.

The inheritance of notification properties, together with the routing process, is an effective method for grouping related notifications and handling specific cases through child policies.

**Inheritance example**

{{< figure src="/media/docs/alerting/notification-inheritance.png" max-width="750px" alt="Simple example inhering notification settings" >}}

This example shows how the notification policy tree from the previous example allows the child policies of the `team=operations` to inherit its contact point. In this way, you can avoid specifying the same contact point multiple times for each child policy.
