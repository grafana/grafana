---
aliases:
  - ./notification-policies/ # /docs/grafana/<GRAFANA_VERSION>/alerting/fundamentals/notification-policies/
canonical: https://grafana.com/docs/grafana/latest/alerting/fundamentals/notifications/
description: Learn about how notifications work
keywords:
  - grafana
  - alerting
  - notification policies
labels:
  products:
    - cloud
    - enterprise
    - oss
title: Notifications
weight: 110
refs:
  alert-rule-evaluation:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/alerting/fundamentals/alert-rule-evaluation/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/alerting-and-irm/alerting/fundamentals/alert-rule-evaluation/
  templates:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/alerting/fundamentals/notifications/templates/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/alerting-and-irm/alerting/fundamentals/notifications/templates/
  configure-alertmanager:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/alerting/set-up/configure-alertmanager/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/alerting-and-irm/alerting/set-up/configure-alertmanager/
  notification-policies:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/alerting/fundamentals/notifications/notification-policies/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/alerting-and-irm/alerting/fundamentals/notifications/notification-policies/
  notification-timings:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/alerting/fundamentals/notifications/notification-policies/#timing-options
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/alerting-and-irm/alerting/fundamentals/notifications/notification-policies/#timing-options
  silences:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/alerting/configure-notifications/create-silence/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/alerting-and-irm/alerting/configure-notifications/create-silence/
  mute-timings:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/alerting/configure-notifications/mute-timings/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/alerting-and-irm/alerting/configure-notifications/mute-timings/
  contact-points:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/alerting/fundamentals/notifications/contact-points/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/alerting-and-irm/alerting/fundamentals/notifications/contact-points/
---

# Notifications

Choosing how, when, and where to send your alert notifications is an important part of setting up your alerting system. These decisions have a direct impact on your team’s ability to receive the necessary information to resolve issues quickly and minimize alert noise.

Start defining your [contact points](ref:contact-points) to specify how to receive your alert notifications. Then, configure your alert rules to send their alerts to either a contact point or use the [Notification Policy Tree](#notification-policies) to flexibly route alerts to contact points.

{{< figure src="/media/docs/alerting/alerting-configure-notifications.svg" max-width="750px" alt="Configure alerts to send notifications to a contact point or via notification policies" caption="Configure alerts to send notifications to a contact point or via notification policies" >}}

## How it works at a glance

- Grafana alerting periodically [evaluates your alert rules](ref:alert-rule-evaluation) and triggers notifications for firing and resolved alert instances.
- You can configure the alert rule to send notifications to a contact point or route them via Notification Policies for greater flexibility.
- To minimize alert noise, group similar alerts into a single notification by grouping alert labels and notification timings.

## Fundamentals

### Contact points

[Contact points](ref:contact-points) contain the configuration for sending alert notifications, specifying destinations like email, Slack, OnCall, webhooks, and their notification messages.

A contact point is a list of integrations, each sending a message to a specific destination. They allow the customization of notification messages and the use of notification templates.

First, create the contact point and test the notifications. Then, configure the alert rule to send its notifications to either a contact point or through Notification Policies.

### Notification policies

[Notification policies](ref:notification-policies) are the backbone of a comprehensive alerting system. They provide a flexible and effective method to route alerts to distinct contact points, helping reduce alert noise while ensuring no alerts are missed.

The notification policy tree is responsible for:

- Defining nested policies that can inherit or overwrite parent notification settings.
- Routing alerts by matching alert labels to the appropriate notification policy.

{{< figure src="/media/docs/alerting/notification-routing.png" max-width="750px" alt="A diagram displaying how the notification policy tree routes alerts" >}}

Each notification policy handles specific tasks:

- Deciding which contact point receives the alert notification.
- Controlling when to send notifications based on its [notification timings](ref:notification-timings).
- [Grouping multiple alerts](#group-alert-notifications) into a single notification to reduce alert noise.

{{< figure src="/media/docs/alerting/alerting-notification-policy-diagram-v2.png" max-width="750px" alt="A diagram of the notification policy component" >}}

### Group alert notifications

When something fails in our system, our alerting setup can easily trigger hundreds or even thousands of alert instances (notifications). Several alert rules often fail simultaneously. Additionally, each alert rule may generate multiple alert instances.

Grouping alert notifications is commonly necessary to avoid bombarding our alert inbox. Grouping combines similar alert instances in a given period into one single notification.

Notification grouping uses:

- **Matching labels**: Group alert instances of the same type by matching their labels.
- **[Notification timings](ref:notification-timings)**: Wait for a specified period before sending the notification, allowing for the grouping of incoming alert instances.

### Templates, silences and mute timings

Grafana Alerting provides advanced notification capabilities that you’ll find useful as you and your team refine your initial alerting system.

For instance, you can customize notifications with shared [templates](ref:templates) that provide actionable alert information and can be reused for multiple notifications.

Additionally, you can use [silences](ref:silences) and [mute timings](ref:mute-timings) to pause notifications for a given time window or at regular intervals, respectively.

## Architecture

Grafana Alerting is based on the Prometheus model for designing alerting systems. Its architecture decouples the alert generator from the alert notification manager (known as the Alertmanager) to enhance scalability and performance.

{{< figure src="/media/docs/alerting/alerting-alertmanager-architecture.png" max-width="750px" alt="A diagram with the alert generator and alert manager architecture" >}}

Grafana uses a custom Alertmanager to manage and deliver alert notifications, as detailed in this guide. This custom Alertmanager extends the capabilities of the [Prometheus Alertmanager](https://prometheus.io/docs/alerting/latest/alertmanager/).

If you already run a Prometheus Alertmanager instance, you can configure Grafana Alerting to forward alerts to your [external Alertmanager for handling notifications](ref:configure-alertmanager).
