---
aliases:
  - about-alerting/
  - unified-alerting/alerting/
description: Intro to key benefits and features of Grafana Alerting
title: Alerting
weight: 114
---

# Alerting

Grafana Alerting allows you to learn about problems in your systems moments after they occur.

Monitor your incoming metrics data or log entries and set up your Alerting system to watch for specific events or circumstances and then send notifications when those things are found.

In this way, you eliminate the need for manual monitoring and provide a first line of defense against system outages or changes that could turn into major incidents.

Using Grafana Alerting, you create queries and expressions from multiple data sources — no matter where your data is stored — giving you the flexibility to combine your data and alert on your metrics and logs in new and unique ways. You can then create, manage, and take action on your alerts from a single, consolidated view, and improve your team’s ability to identify and resolve issues quickly.

Grafana Alerting is available for Grafana OSS, Grafana Enterprise, or Grafana Cloud. With Mimir and Loki alert rules you can run alert expressions closer to your data and at massive scale, all managed by the Grafana UI you are already familiar with.

Watch this video to learn more about Grafana Alerting: {{< vimeo 720001629 >}}

_Refer to [Manage your alert rules]({{< relref "../alerting/alerting-rules" >}}) for current instructions._

## Key features and benefits

**One page for all alerts**

A single Grafana Alerting page consolidates both Grafana-managed alerts and alerts that reside in your Prometheus-compatible data source in one single place.

**Multi-dimensional alerts**

Alert rules can create multiple individual alert instances per alert rule, known as multi-dimensional alerts, giving you the power and flexibility to gain visibility into your entire system with just a single alert rule. You do this by adding labels to your query to specify which component is being monitored and generate multiple alert instances for a single alert rule. For example, if you want to monitor each server in a cluster, a multi-dimensional alert will alert on each CPU, whereas a standard alert will alert on the overall server.

**Route alerts**

Route each alert instance to a specific contact point based on labels you define. Notification policies are the set of rules for where, when, and how the alerts are routed to contact points.

**Silence alerts**

Silences stop notifications from getting created and last for only a specified window of time.
Silences allow you to stop receiving persistent notifications from one or more alert rules. You can also partially pause an alert based on certain criteria. Silences have their own dedicated section for better organization and visibility, so that you can scan your paused alert rules without cluttering the main alerting view.

**Mute timings**

A mute timing is a recurring interval of time when no new notifications for a policy are generated or sent. Use them to prevent alerts from firing a specific and reoccurring period, for example, a regular maintenance period.

Similar to silences, mute timings do not prevent alert rules from being evaluated, nor do they stop alert instances from being shown in the user interface. They only prevent notifications from being created.

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

## Useful links

- [Introduction to Alerting]({{< relref "./fundamentals" >}})
