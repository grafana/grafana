---
aliases:
  - ./metrics/ # /docs/grafana/<GRAFANA_VERSION>/alerting/metrics/
  - ./unified-alerting/fundamentals/ # /docs/grafana/<GRAFANA_VERSION>/alerting/unified-alerting/fundamentals/
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
- Firing and resolved alert instances are routed to notification policies based on matching labels
- Notifications are sent out to the contact points specified in the notification policy

## Fundamentals

The following concepts are key to your understanding of how Grafana Alerting works.

### Alert rules

An [alert rule][alert-rules] consists of one or more queries and expressions that select the data you want to measure. It also contains a condition, which is the threshold that an alert rule must meet or exceed in order to fire.

Add labels to uniquely identify your alert rule and configure alert routing. Labels link alert rules to notification policies, so you can easily manage which policy should handle which alerts and who gets notified.

Once alert rules are created, they go through various states and transitions.

### Alert instances

Each alert rule can produce multiple alert instances (also known as alerts) - one alert instance for each time series. This is exceptionally powerful as it allows us to observe multiple series in a single expression.

```promql
sum by(cpu) (
  rate(node_cpu_seconds_total{mode!="idle"}[1m])
)
```

A rule using the PromQL expression above creates as many alert instances as the amount of CPUs we are observing after the first evaluation, enabling a single rule to report the status of each CPU.

{{< figure src="/static/img/docs/alerting/unified/multi-dimensional-alert.png" caption="Multiple alert instances from a single alert rule" >}}

[Alert rules are frequently evaluated][alert-rule-evaluation] and updates the state of their alert instances accordingly. Only alert instances that are in a firing or resolved state are routed to notification policies to be handled.

### Notification policies

[Notification policies][notification-policies] group alerts and then route them to contact points. They determine when notifications are sent, and how often notifications should be repeated.

Alert instances are matched to notification policies using label matchers. This provides a flexible way to organize and route alerts to different receivers.

Each policy consists of a set of label matchers (0 or more) that specify which alert instances (identified by their labels) they are or aren’t interested in handling. Notification policies are defined as a tree structure where the root of the notification policy tree is called the Default notification policy, and each policy can have child policies.

{{< figure src="/media/docs/alerting/notification-routing.png" max-width="750px" caption="Notification policy routing" >}}

### Contact points

[Contact points][contact-points] determine where notifications are sent. For example, you might have a contact point that sends notifications to an email address, to Slack, to an incident management system (IRM) such as Grafana OnCall or Pagerduty, or to a webhook.

Notifications sent from contact points are customizable with notification templates, which can be shared between contact points.

### Silences and mute timings

[Silences][silences] and [mute timings][mute-timings] allow you to pause notifications for specific alerts or even entire notification policies. Use a silence to pause notifications on an ad-hoc basis, such as during a maintenance window; and use mute timings to pause notifications at regular intervals, such as evenings and weekends.

### Architecture

Grafana Alerting is built on the Prometheus model of designing alerting systems.

Prometheus-based alerting systems have two main components:

- an alert generator that evaluates alert rules and sends firing and resolved alerts to the alert receiver.
- an alert receiver (also known as Alertmanager) that receives the alerts and is responsible for handling them and sending their notifications.

Grafana doesn’t use Prometheus as its default alert generator because Grafana Alerting needs to work with many other data sources in addition to Prometheus.

However, Grafana can also use Prometheus as alert generator and external alertmanagers. For more information about how to use distinct alerting systems, refer to the [Grafana alert rule types][alert-rules].

## Design your Alerting system

Monitoring complex IT systems and understanding whether everything is up and running correctly is a difficult task. Setting up an effective alert management system is therefore essential to inform you when things are going wrong before they start to impact your business outcomes.

Designing and configuring an alert management set up that works takes time.

Here are some tips on how to create an effective alert management set up for your business:

**Which are the key metrics for your business that you want to monitor and alert on?**

- Find events that are important to know about and not so trivial or frequent that recipients ignore them.

- Alerts should only be created for big events that require immediate attention or intervention.

- Consider quality over quantity.

**Which type of Alerting do you want to use?**

- Choose between Grafana-managed Alerting or Grafana Mimir or Loki-managed Alerting; or both.

**How do you want to organize your alerts and notifications?**

- Be selective about who you set to receive alerts. Consider sending them to whoever is on call or a specific Slack channel.
- Automate as far as possible using the Alerting API or alerts as code (Terraform).

**How can you reduce alert fatigue?**

- Avoid noisy, unnecessary alerts by using silences, mute timings, or pausing alert rule evaluation.
- Continually tune your alert rules to review effectiveness. Remove alert rules to avoid duplication or ineffective alerts.
- Think carefully about priority and severity levels.
- Continually review your thresholds and evaluation rules.

{{% docs/reference %}}

[alert-rules]: "/docs/grafana/ -> /docs/grafana/<GRAFANA_VERSION>/alerting/fundamentals/alert-rules"
[alert-rules]: "/docs/grafana-cloud/ -> /docs/grafana-cloud/alerting-and-irm/alerting/fundamentals/alert-rules"

[contact-points]: "/docs/grafana/ -> /docs/grafana/<GRAFANA_VERSION>/alerting/fundamentals/notifications/contact-points"
[contact-points]: "/docs/grafana-cloud/ -> /docs/grafana-cloud/alerting-and-irm/alerting/fundamentals/notifications/contact-points"

[silences]: "/docs/grafana/ -> /docs/grafana/<GRAFANA_VERSION>/alerting/configure-notifications/create-silence"
[silences]: "/docs/grafana-cloud/ -> /docs/grafana-cloud/alerting-and-irm/alerting/configure-notifications/create-silence"

[mute-timings]: "/docs/grafana/ -> /docs/grafana/<GRAFANA_VERSION>/alerting/configure-notifications/mute-timings"
[mute-timings]: "/docs/grafana-cloud/ -> /docs/grafana-cloud/alerting-and-irm/alerting/configure-notifications/mute-timings"

[alertmanager]: "/docs/grafana/ -> /docs/grafana/<GRAFANA_VERSION>/alerting/fundamentals/notifications/alertmanager"
[alertmanager]: "/docs/grafana-cloud/ -> /docs/grafana-cloud/alerting-and-irm/alerting/fundamentals/notifications/alertmanager"

[alert-rule-evaluation]: "/docs/grafana/ -> /docs/grafana/<GRAFANA_VERSION>/alerting/fundamentals/alert-rules/rule-evaluation"
[alert-rule-evaluation]: "/docs/grafana-cloud/ -> /docs/grafana-cloud/alerting-and-irm/alerting/fundamentals/alert-rules/rule-evaluation"

[external-alertmanagers]: "/docs/grafana/ -> /docs/grafana/<GRAFANA_VERSION>/alerting/set-up/configure-alertmanager"
[external-alertmanagers]: "/docs/grafana-cloud/ -> /docs/grafana-cloud/alerting-and-irm/alerting/set-up/configure-alertmanager"
[notification-policies]: "/docs/grafana/ -> /docs/grafana/<GRAFANA_VERSION>/alerting/fundamentals/notifications/notification-policies"
[notification-policies]: "/docs/grafana-cloud/ -> /docs/grafana-cloud/alerting-and-irm/alerting/fundamentals/notifications/notification-policies"
{{% /docs/reference %}}
