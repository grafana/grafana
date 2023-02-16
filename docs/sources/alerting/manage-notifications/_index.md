---
description: Manage alert notifications
keywords:
  - grafana
  - alert
  - notifications
title: Manage your alert notifications
weight: 160
---

# Manage your alert notifications

Choosing how, when, and where to send your alert notifications is an important part of setting up your alerting system. These decisions will have a direct impact on your ability to resolve issues quickly and not miss anything important.

As a first step, define your contact points; where to send your alert notifications to. A contact point can be a set of destinations for matching notifications. Add notification templates to contact points for reuse and consistent messaging in your notifications.

Next, create a notification policy which is a set of rules for where, when and how your alerts are routed to contact points. In a notification policy, you define where to send your alert notifications by choosing one of the contact points you created.Add mute timings to your notification policy. A mute timing is a recurring interval of time during which you don’t want any notifications to be sent out.

You can also add silences to stop notifications from one or more alert rules. The difference between a silence and a mute timing is that a silence only lasts for only a specified window of time.

When an alert rule fires, the alert ruler sends alert instances to the Alertmanager; one alert rule can trigger multiple individual alert instances.

The Alertmanager receives these alert instances and then handles silences, groups alerts, and sends notifications to your contact points as defined in the notification policy.
