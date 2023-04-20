---
aliases:
  - metrics/
  - unified-alerting/fundamentals/
title: Introduction to Alerting
weight: 105
---

# Introduction to Alerting

Whether you’re starting or expanding your implementation of Grafana Alerting, learn more about the key concepts and available features that help you create, manage, and take action on your alerts and improve your team’s ability to resolve issues quickly.

The following diagram gives you an overview of how Grafana Alerting works and introduces you to some of the key concepts that work together and form the core of our flexible and powerful alerting engine.

{{< figure src="/media/docs/alerting/how-alerting-works.png" max-width="750px" caption="How Alerting works" >}}

You can either create your alerting resources (alert rules, notification policies, and so on) directly in the Grafana UI, using provisioning, or in your Grafana Mimir or Loki instances.

**Alert rules**

An alert rule is a set of evaluation criteria for when an alert rule should fire. An alert rule consists of one or more queries and expressions, a condition, and the duration over which the condition needs to be met to start firing.

Add annotations to your alert rule to provide additional information about the alert rule and add labels to uniquely identify your alert rule and configure alert routing. Labels link alert rules to notification policies, so you can easily manage which policy should handle which alerts and who gets notified.

Once alert rules are created, they go through various states and transitions. An alert rule can produce multiple alert instances - one alert instance for each time series.

The alert rule state is determined by the “worst case” state of the alert instances produced and the states can be Normal, Pending, or Firing. For example, if one alert instance is firing, the alert rule state will also be firing.

The alert rule health is determined by the status of the evaluation of the alert rule, which can be Ok, Error, and NoData.

**Alert instances**

For Grafana-managed alert rules, multiple alert instances can be created as a result of one alert rule (also known as a multi-dimensional alerting) and they can be in Normal, Pending, Alerting, No Data, Error states. For Mimir or Loki-managed alert rules, alert instances are only created when the threshold condition defined in an alert rule is breached.

Alerting alert instances are grouped by labels according to the notification policy. This controls de-duplication and groups alert instances to send to your contact points.

**Notification policy**

Set where, when, and how firing alert instances get routed.

Each notification policy contains a set of label matchers to indicate which alerts rules or instances it is responsible for. It also has a contact point assigned to it that consists of one or more contact point types, such as Slack or email. Contact points define how your contacts are notified when an alert instance fires.

Use message templates for your notifications to create reusable custom templates and use them in contact points.

Add silences to stop notifications from one or more alert instances or use mute timings to specify time intervals when you don’t want new notifications to be generated or sent out. The difference between the two being that a silence only lasts for only a specified window of time whereas a mute timing recurs on a schedule, for example, during a maintenance period.
