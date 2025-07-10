---
aliases:
  - ../notifications/ # /docs/grafana/<GRAFANA_VERSION>/alerting/notifications/
  - ../unified-alerting/notifications/ # /docs/grafana/<GRAFANA_VERSION>/alerting/unified-alerting/notifications/
  - ../alerting-rules/create-notification-policy/ # /docs/grafana/<GRAFANA_VERSION>/alerting/alerting-rules/create-notification-policy/
  - ../manage-notifications/create-notification-policy/ # /docs/grafana/<GRAFANA_VERSION>/alerting/manage-notifications/create-notification-policy/
canonical: https://grafana.com/docs/grafana/latest/alerting/configure-notifications/create-notification-policy/
description: Configure notification policies to determine how alerts are routed to contact points
keywords:
  - grafana
  - alerting
  - guide
  - notification policies
  - routes
labels:
  products:
    - cloud
    - enterprise
    - oss
title: Configure notification policies
weight: 420
refs:
  alertmanager-architecture:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/alerting/configure-notifications/#alertmanager-architecture
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/alerting-and-irm/alerting/configure-notifications/#alertmanager-architecture
  intro-notification-policies:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/alerting/fundamentals/notifications/notification-policies/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/alerting-and-irm/alerting/fundamentals/notifications/notification-policies/
  configure-mute-timings:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/alerting/configure-notifications/mute-timings/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/alerting-and-irm/alerting/configure-notifications/mute-timings/
  configure-contact-points:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/alerting/configure-notifications/manage-contact-points/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/alerting-and-irm/alerting/configure-notifications/manage-contact-points/
  policy-routing:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/alerting/fundamentals/notifications/notification-policies/#routing
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/alerting-and-irm/alerting/fundamentals/notifications/notification-policies/#routing
  policy-inheritance:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/alerting/fundamentals/notifications/notification-policies/#inheritance
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/alerting-and-irm/alerting/fundamentals/notifications/notification-policies/#inheritance
  policy-grouping:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/alerting/fundamentals/notifications/group-alert-notifications/#group-notifications
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/alerting-and-irm/alerting/fundamentals/notifications/group-alert-notifications/#group-notifications
  policy-timing-options:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/alerting/fundamentals/notifications/group-alert-notifications/#timing-options
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/alerting-and-irm/alerting/fundamentals/notifications/group-alert-notifications/#timing-options
---

# Configure notification policies

Notification policies determine how alerts are routed to contact points.

Policies have a tree structure. Each policy can have one or more child policies and a set of label matchers.

Each alert (or alert instance) is evaluated by the default policy and subsequently by each child policy. Alerts are routed to the appropriate notification policy by matching alert labels with the policy's label matchers. For further details, refer to [label matching and routing in notification policies](ref:intro-notification-policies).

{{< figure src="/media/docs/alerting/get-started-notification-policy-tree-combo.png" max-width="750px" alt="A diagram displaying how the notification policy tree routes alerts" >}}

When an alert instance is assigned to a notification policy, the notification policy is responsible for:

- [Grouping similar alerts](ref:policy-grouping) to minimize the number of notifications.
- Controlling when notifications are sent using the [timing options](ref:policy-timing-options).
- Determining the [contact points](ref:configure-contact-points) that receive the alert notification.

{{< admonition type="note" >}}
The default notification policy and its child policies are assigned to a [specific Alertmanager](ref:alertmanager-architecture), and they cannot use contact points or mute timings from other Alertmanagers.
{{< /admonition >}}

## Edit the default notification policy

1. In the left-side menu, click **Alerts & IRM** and then **Alerting**.
1. Click **Notification policies**.
1. From the **Choose Alertmanager** dropdown, select an external Alertmanager. By default, the **Grafana Alertmanager** is selected.
1. In the Default policy section, click **...** -> **Edit**.
1. In **Default contact point**, update the [contact point](ref:configure-contact-points) for where to send notifications when alert rules do not match any specific policy.
1. In **Group by**, choose labels to group alerts. If multiple alerts match this policy, they are grouped by the selected labels, and notifications are sent per group. For more details on using this option, refer to [Group notifications](ref:policy-grouping).
1. In **Timing options**, set the [timing options](ref:policy-timing-options) to configure when notifications are sent.
   - **Group wait**: the time to wait before sending the first notification for a new group of alerts. Default is 30 seconds.
   - **Group interval**: the time to wait before sending a notification about changes in the alert group. Default is 5 minutes.
   - **Repeat interval**: the time to wait before sending a notification if the group has not changed since the last notification. Default is 4 hours.
1. Click **Save** to save your changes.

## Add a child policy

You can create a child policy under a default policy or under an existing child policy.

If you want to choose where to position your policy, see the section on **Add a sibling policy**.

1. In the left-side menu, click **Alerts & IRM** and then **Alerting**.
1. Click **Notification policies**.
1. From the **Choose Alertmanager** dropdown, select an Alertmanager. By default, the **Grafana Alertmanager** is selected.
1. Click **+New child policy** from the default policy or an existing child policy.
1. In the Matching labels section of the child policy, add one or more matching label rules to narrow down a specific case from the parent policy.

   For instance, a child policy of the default policy handles `team=security` alerts, or a child policy handles only the `severity=critical` alerts of a parent policy.

1. In the **Contact point** dropdown, select the [contact point](ref:configure-contact-points) to send notifications. If left empty, the contact point of the parent policy is [inherited](ref:policy-inheritance).
1. Optionally, enable **Continue matching subsequent sibling nodes** to continue matching sibling policies even after the alert matched the current policy. If enabled, multiple policies can handle the same alert.
1. Optionally, enable **Override grouping** to set different [grouping](ref:policy-grouping) than the parent policy. If disabled, the grouping of the parent policy is [inherited](ref:policy-inheritance).
1. Optionally, enable **Override general timings** to set different [timing options](ref:policy-timing-options) than the parent policy. If disabled, the timing options of the parent policy are [inherited](ref:policy-inheritance).
1. Click **Save policy** to save your changes.

## Add a sibling policy

1. In the left-side menu, click **Alerts & IRM** and then **Alerting**.
1. Click **Notification policies**.
1. Find the child policy you want to create a sibling for.
1. Click **Add new policy** -> **New sibling above** or **New sibling below**.

   It's important to determine which policy receives the alert first and to set the correct order of sibling and child policies.

   Policies are evaluated from top to bottom. If a matching policy is found, the system continues to evaluate its child policies in the order they are displayed. For more details, refer to [notification policies routing](ref:policy-routing).

1. Follow the instructions from step 5 onward in [adding a child policy](#add-a-child-policy).

## Search for policies

Grafana allows you to search within the tree of policies by the following:

- **Label matchers**
- **Contact Points**

To search by contact point simply select a contact point from the **Search by contact point** dropdown. The policies that use that contact point are highlighted in the user interface.

To search by label matchers simply enter a valid matcher in the **Search by matchers** input field. Multiple matchers can be combined with a comma (`,`).

It is important to note that all matched policies are **exact** matches. Grafana supports regular expressions for creating label matchers. It does not support regular expression or partial matching in the search for policies.

## Mute timings

Mute timings are not inherited from a parent notification policy, and they have to be configured on each level. For instructions, refer to [Configure mute timings](ref:configure-mute-timings).

## Example

An example of an alert configuration.

- Create a "default" contact point for slack notifications, and set it on the default policy.
- Edit the default policy grouping to group alerts by `cluster`, `namespace` and `severity` so that you get a notification per alert rule and specific Kubernetes cluster and namespace.
- Create specific route for alerts coming from the development cluster with an appropriate contact point.
- Create a specific route for alerts with "critical" severity with a more invasive contact point integration, like pager duty notification.
- Create specific routes for particular teams that handle their own on-call rotations.
