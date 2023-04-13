---
aliases:
  - about-alerting/
  - unified-alerting/alerting/
cascade:
  labels:
    products:
      - cloud
      - oss
title: Alerting
weight: 114
---

# Alerting

Grafana Alerting allows you to learn about problems in your systems moments after they occur. Create, manage, and take action on your alerts in a single, consolidated view, and improve your team’s ability to identify and resolve issues quickly.

Grafana Alerting is available for Grafana OSS, Grafana Enterprise, or Grafana Cloud. With Mimir and Loki alert rules you can run alert expressions closer to your data and at massive scale, all managed by the Grafana UI you are already familiar with.

Watch this video to learn more about Grafana Alerting: {{< vimeo 720001629 >}}

_Video shows Alerting in Grafana v9.0. Refer to [Manage your alert rules]({{< relref "../alerting/alerting-rules/" >}}) for current directions._

## Overview

The following diagram gives you an overview of how Grafana Alerting works and introduces you to some of the key concepts that work together and form the core of our flexible and powerful alerting engine.

{{< figure src="/static/img/docs/alerting/unified/about-alerting-flow-diagram-latest.png" caption="Grafana Alerting overview" >}}

1. Alert rules

   Set evaluation criteria that determines whether an alert instance will fire. An alert rule consists of one or more queries and expressions, a condition, the frequency of evaluation, and optionally, the duration over which the condition is met.

   Grafana managed alerts support multi-dimensional alerting, which means that each alert rule can create multiple alert instances. This is exceptionally powerful if you are observing multiple series in a single expression.

   Once an alert rule has been created, they go through various states and transitions. The state and health of alert rules help you understand several key status indicators about your alerts.

1. Labels

   Match an alert rule and its instances to notification policies and silences. They can also be used to group your alerts by severity.

1. Notification policies

   Set where, when, and how the alerts get routed. Each notification policy specifies a set of label matchers to indicate which alerts they are responsible for. A notification policy has a contact point assigned to it that consists of one or more notifiers.

1. Contact points

   Define how your contacts are notified when an alert fires. We support a multitude of ChatOps tools to ensure the alerts come to your team.

## Features

**One page for all alerts**

A single Grafana Alerting page consolidates both Grafana-managed alerts and alerts that reside in your Prometheus-compatible data source in one single place.

**Multi-dimensional alerts**

Alert rules can create multiple individual alert instances per alert rule, known as multi-dimensional alerts, giving you the power and flexibility to gain visibility into your entire system with just a single alert.

**Routing alerts**

Route each alert instance to a specific contact point based on labels you define. Notification policies are the set of rules for where, when, and how the alerts are routed to contact points.

**Silencing alerts**

Silences allow you to stop receiving persistent notifications from one or more alerting rules. You can also partially pause an alert based on certain criteria. Silences have their own dedicated section for better organization and visibility, so that you can scan your paused alert rules without cluttering the main alerting view.

**Mute timings**

With mute timings, you can specify a time interval when you don’t want new notifications to be generated or sent. You can also freeze alert notifications for recurring periods of time, such as during a maintenance period.

## Useful links

- [Fundamental concepts]({{< relref "/docs/grafana/latest/alerting/fundamentals" >}}) of Grafana Alerting.

- [Role-based access control]({{< relref "/docs/grafana/latest/administration/roles-and-permissions/access-control" >}}) in Grafana Enterprise.

- [High availability]({{< relref "/docs/grafana/latest/alerting/fundamentals/high-availability" >}})
