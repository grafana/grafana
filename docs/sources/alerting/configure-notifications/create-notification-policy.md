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
  notification-policies:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/alerting/fundamentals/notifications/notification-policies/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/alerting-and-irm/alerting/fundamentals/notifications/notification-policies/
---

# Configure notification policies

Notification policies determine how alerts are routed to contact points.

Policies have a tree structure and each policy can have one or more child policies. Each policy, except for the default policy, can also match specific alert labels.

Each alert is evaluated by the default policy and subsequently by each child policy.

If the **Continue matching subsequent sibling nodes** option is enabled for a child policy, evaluation continues even after one or more matches. A parent policy’s configuration settings and contact point information govern the behavior of an alert that does not match any of the child policies. A default policy governs any alert that does not match a child policy.

You can configure Grafana-managed notification policies as well as notification policies for an external Alertmanager data source.

For more information on notification policies, refer to [fundamentals of Notification Policies](ref:notification-policies).

## Edit the default notification policy

1. In the left-side menu, click **Alerts & IRM** and then **Alerting**.
1. Click **Notification policies**.
1. From the **Choose Alertmanager** dropdown, select an external Alertmanager. By default, the **Grafana Alertmanager** is selected.
1. In the Default policy section, click **...** -> **Edit**.
1. In **Default contact point**, update the contact point for where to send notifications when alert rules do not match any specific policy.
1. In **Group by**, choose labels to group alerts by. If multiple alerts are matched for this policy, then they are grouped by these labels. A notification is sent per group. If the field is empty (default), then all notifications are sent in a single group. Use a special label `...` to group alerts by all labels (which effectively disables grouping).
1. In **Timing options**, select from the following options:
   - **Group wait** Time to wait to buffer alerts of the same group before sending an initial notification. Default is 30 seconds.
   - **Group interval** Minimum time interval between two notifications for a group. Default is 5 minutes.
   - **Repeat interval** Minimum time interval for re-sending a notification if no new alerts were added to the group. Default is 4 hours.
1. Click **Save** to save your changes.

## Add a child policy

You can create a child policy under a default policy or under an existing child policy.

If you want to choose where to position your policy, see the section on **Add a sibling policy**.

1. In the left-side menu, click **Alerts & IRM** and then **Alerting**.
2. Click **Notification policies**.
3. From the **Choose Alertmanager** dropdown, select an Alertmanager. By default, the **Grafana Alertmanager** is selected.
4. Click **+New child policy** from the default policy.
5. In the Matching labels section, add one or more rules for matching alert labels.
6. In the **Contact point** dropdown, select the contact point to send notification to if alert matches only this specific policy and not any of the child policies.
7. Optionally, enable **Continue matching subsequent sibling nodes** to continue matching sibling policies even after the alert matched the current policy. When this option is enabled, you can get more than one notification for one alert.
8. Optionally, enable **Override grouping** to specify the same grouping as the default policy. If this option is not enabled, the default policy grouping is used.
9. Optionally, enable **Override general timings** to override the timing options configured in the group notification policy.
10. Click **Save policy** to save your changes.

## Add a sibling policy

1. In the left-side menu, click **Alerts & IRM** and then **Alerting**.
1. Click **Notification policies**.
1. Find the child policy you want to create a sibling for.
1. Click **Add new policy** -> **New sibling above** or **New sibling below**.

   Notification policies are evaluated from top to bottom, so it is key to be able to choose which notification policy receives alerts first. Adding sibling notification policies instead of always inserting a child policy as well as being able to choose where to insert is key to managing where your alerts go.

1. Click **Save policy** to save your changes.

## Search for policies

Grafana allows you to search within the tree of policies by the following:

- **Label matchers**
- **Contact Points**

To search by contact point simply select a contact point from the **Search by contact point** dropdown. The policies that use that contact point are highlighted in the user interface.

To search by label matchers simply enter a valid matcher in the **Search by matchers** input field. Multiple matchers can be combined with a comma (`,`).

It is important to note that all matched policies are **exact** matches. Grafana supports regular expressions for creating label matchers. It does not support regular expression or partial matching in the search for policies.

## Mute timings

Mute timings are not inherited from a parent notification policy. They have to be configured in full on each level.

## Example

An example of an alert configuration.

- Create a "default" contact point for slack notifications, and set it on the default policy.
- Edit the default policy grouping to group alerts by `cluster`, `namespace` and `severity` so that you get a notification per alert rule and specific Kubernetes cluster and namespace.
- Create specific route for alerts coming from the development cluster with an appropriate contact point.
- Create a specific route for alerts with "critical" severity with a more invasive contact point integration, like pager duty notification.
- Create specific routes for particular teams that handle their own on-call rotations.
