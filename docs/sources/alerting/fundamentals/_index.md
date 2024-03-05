---
aliases:
  - metrics/
  - unified-alerting/fundamentals/
canonical: https://grafana.com/docs/grafana/latest/alerting/fundamentals/
description: Learn about the fundamentals of Grafana Alerting as well as the key features it offers
labels:
  products:
    - cloud
    - enterprise
    - oss
menuTitle: Introduction
title: Introduction to Alerting
weight: 100
---

# Introduction to Alerting

Whether you’re just starting out or you're a more experienced user of Grafana Alerting, learn more about the fundamentals and available features that help you create, manage, and respond to alerts; and improve your team’s ability to resolve issues quickly.

The following diagram gives you an overview of Grafana Alerting and introduces you to some of the fundamental features that are the principles of how Grafana Alerting works.

{{< figure src="/media/docs/alerting/how-alerting-works.png" max-width="750px" caption="How Alerting works" >}}

## How it works at a glance

- Grafana alerting periodically queries data sources and evaluates the condition defined in the alert rule
- If the condition is breached, an alert instance fires
- Firing instances are routed to notification policies based on matching labels
- Notifications are sent out to the contact points specified in the notification policy

## Fundamentals

The following concepts are key to your understanding of how Grafana Alerting works.

### Alert rules

An alert rule consists of one or more queries and expressions that select the data you want to measure. It also contains a condition, which is the threshold that an alert rule must meet or exceed in order to fire.

Add annotations to your alert rule to provide additional information about the alert rule and add labels to uniquely identify your alert rule and configure alert routing. Labels link alert rules to notification policies, so you can easily manage which policy should handle which alerts and who gets notified.

Once alert rules are created, they go through various states and transitions. An alert rule can produce multiple alert instances - one alert instance for each time series.

The alert rule state is determined by the “worst case” state of the alert instances produced and the states can be Normal, Pending, or Firing. For example, if one alert instance is firing, the alert rule state will also be firing.

The alert rule health is determined by the status of the evaluation of the alert rule, which can be Ok, Error, and NoData.

### Labels and states

Alert rules are uniquely identified by sets of key/value pairs called labels. Each key is a label name and each value is a label value. For example, one alert might have the labels `foo=bar` and another alert rule might have the labels `foo=baz`. An alert rule can have many labels such as `foo=bar,bar=baz`, but it cannot have the same label twice such as `foo=bar,foo=baz`. Two alert rules cannot have the same labels either, and if two alert rules have the same labels such as `foo=bar,bar=baz` and `foo=bar,bar=baz` then one of the alerts will be discarded. Firing alerts are resolved when the condition in the alert rule is no longer met, or the alert rule is deleted.

In Grafana-managed alert rules, alert rules can be in Normal, Pending, Alerting, No Data or Error states. In datasource-managed alert rules, such as Mimir and Loki, alert rules can be in Normal, Pending and Alerting, but not NoData or Error.

### Alert instances

For Grafana-managed alert rules, multiple alert instances can be created as a result of one alert rule (also known as a multi-dimensional alerting) and they can be in Normal, Pending, Alerting, No Data, Error states. For Mimir or Loki-managed alert rules, alert instances are only created when the threshold condition defined in an alert rule is breached.

### Contact points

Contact points determine where notifications are sent. For example, you might have a contact point that sends notifications to an email address, to Slack, to an incident management system (IRM) such as Grafana OnCall or Pagerduty, or to a webhook.

The notifications that are sent from contact points can be customized using notification templates. You can use notification templates to change the title, message, and structure of the notification. Notification templates are not specific to individual integrations or contact points.

### Notification policies

Notification policies group alerts and then route them to contact points. They determine when notifications are sent, and how often notifications should be repeated.

Alerts are matched to notification policies using label matchers. These are human-readable expressions that assert if the alert's labels exactly match, do not exactly match, contain, or do not contain some expected text. For example, the matcher `foo=bar` matches alerts with the label `foo=bar` while the matcher `foo=~[a-zA-Z]+` matches alerts with any label called foo with a value that matches the regular expression `[a-zA-Z]+`.

By default, an alert can only match one notification policy. However, with the `continue` feature alerts can be made to match any number of notification policies at the same time. For more information on notification policies, see [fundamentals of Notification Policies][notification-policies].

### Silences and mute timings

Silences and mute timings allow you to pause notifications for specific alerts or even entire notification policies. Use a silence to pause notifications on an ad-hoc basis, such as during a maintenance window; and use mute timings to pause notifications at regular intervals, such as evenings and weekends.

## Provisioning

You can create your alerting resources (alert rules, notification policies, and so on) in the Grafana UI; configmaps, files and configuration management systems using file-based provisioning; and in Terraform using API-based provisioning.

## Principles

In Prometheus-based alerting systems, you have an alert generator that creates alerts and an alert receiver that receives alerts. For example, Prometheus is an alert generator and is responsible for evaluating alert rules, while Alertmanager is an alert receiver and is responsible for grouping, inhibiting, silencing, and sending notifications about firing and resolved alerts.

Grafana Alerting is built on the Prometheus model of designing alerting systems. It has an internal alert generator responsible for scheduling and evaluating alert rules, as well as an internal alert receiver responsible for grouping, inhibiting, silencing, and sending notifications. Grafana doesn’t use Prometheus as its alert generator because Grafana Alerting needs to work with many other data sources in addition to Prometheus. However, it does use Alertmanager as its alert receiver.

Alerts are sent to the alert receiver where they are routed, grouped, inhibited, silenced and notified. In Grafana Alerting, the default alert receiver is the Alertmanager embedded inside Grafana, and is referred to as the Grafana Alertmanager. However, you can use other Alertmanagers too, and these are referred to as [External Alertmanagers][external-alertmanagers].

{{% docs/reference %}}
[external-alertmanagers]: "/docs/grafana/ -> /docs/grafana/<GRAFANA_VERSION>/alerting/set-up/configure-alertmanager"
[external-alertmanagers]: "/docs/grafana-cloud/ -> /docs/grafana-cloud/alerting-and-irm/alerting/set-up/configure-alertmanager"
[notification-policies]: "/docs/grafana/ -> /docs/grafana/<GRAFANA_VERSION>/alerting/fundamentals/notification-policies/notifications"
[notification-policies]: "/docs/grafana-cloud/ -> /docs/grafana-cloud/alerting-and-irm/alerting/fundamentals/notification-policies/notifications"
{{% /docs/reference %}}
