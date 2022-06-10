---
aliases:
  - /docs/grafana/latest/alerting/about-alerting/
description: A quick overview of Grafana Alerting
keywords:
  - grafana
  - alerting
  - overview
  - concepts
  - basics
title: About Grafana Alerting
weight: 100
---

# About Grafana Alerting

Grafana Alerting consists of several individual concepts that are at the core of a flexible and powerful alerting engine.

This topic explains how to create [alert rules]({{< relref "fundamentals/alert-rules/" >}}), their relationship with [alert instances]({{< relref "fundamentals/alert-rules/alert-instances/" >}}) and the various alert rule [states and transitions]({{< relref "fundamentals/state-and-health/" >}}), [notification policies]({{< relref "notifications/" >}}) and [contact points]({{< relref "contact-points/" >}}).

These three individual concepts are the minimum necessities to successfully create alerts and receive notifications.

We will also touch on various other concepts such as [silences]({{< relref "silences/" >}}) and [mute timings]({{< relref "notifications/mute-timings/" >}}) to more granularly manage alert notifications, [role-based access control]({{< relref "../enterprise/access-control/" >}}) to limit access and manage permissions and additional advanced topics such as [external alertmanagers]({{< relref "fundamentals/alertmanager/#add-a-new-external-alertmanager" >}}) and [high availability]({{< relref "high-availability/" >}}).

## Overview

{{< figure src="/static/img/docs/alerting/unified/about-alerting-flow-diagram.jpg" caption="Grafana Alerting overview" >}}

As shown in the diagram above, Grafana Alerting uses [labels]({{< relref "fundamentals/annotation-label/how-to-use-labels/" >}}) to match an alert rule and its instances to a specific notification policy. This concept of labels and label matching is important and is also used in [silences]({{< relref "silences/" >}}).

Each notification policy specifies a set of [label matchers]({{< relref "fundamentals/annotation-label/labels-and-label-matchers/" >}}) to indicate what alerts they are responsible for.

A notification policy has a [contact point]({{< relref "contact-points/" >}}) assigned to it that consists of one or more [notifiers]({{< relref "contact-points/#list-of-notifiers-supported-by-grafana" >}}).
