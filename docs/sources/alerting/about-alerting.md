+++
title = "About Grafana alerting"
description = "A quick overview of Grafana alerting"
keywords = ["grafana", "alerting", "overview", "concepts", "basics"]
weight = 100
+++

# About Grafana alerting

Grafana Alerting consists of several individual concepts that are at the core of a flexible and powerful alerting engine.

This topic explains how to create [alert rules]({{< relref "./about-alert-rules/_index.md" >}}), their relationship with [alert instances]({{< relref "./about-alert-rules/alert-instances.md" >}}) and the various alert rule [states and transitions]({{< relref "./fundamentals/state-and-health.md" >}}), [notification policies]({{< relref "./notifications/_index.md" >}}) and [contact points]({{< relref "./contact-points/_index.md" >}}).

These three individual concepts are the minimum necessities to successfully create alerts and receive notifications.

We will also touch on various other concepts such as [silences]({{< relref "./silences/_index.md" >}}) and [mute timings]({{< relref "./notifications/mute-timings.md" >}}) to more granularly manage alert notifications, [role-based access control]({{< relref "../enterprise/access-control/_index.md" >}}) to limit access and manage permissions and additional advanced topics such as [external alertmanagers]({{< relref "./fundamentals/alertmanager.md#add-a-new-external-alertmanager" >}}) and [high availability]({{< relref "./high-availability/_index.md" >}}).

## Overview

{{< figure src="/static/img/docs/alerting/unified/about-alerting-flow-diagram.jpg" caption="Grafana alerting overview" >}}

As shown in the diagram above, Grafana alerting uses [labels]({{< relref "./fundamentals/annotation-label/how-to-use-labels.md" >}}) to match an alert rule and its instances to a specific notification policy. This concept of labels and label matching is important and is also used in [silences]({{< relref "./silences/_index.md" >}}).

Each notification policy specifies a set of [label matchers]({{< relref "./fundamentals/annotation-label/labels-and-label-matchers.md" >}}) to indicate what alerts they are responsible for.

A notification policy has a [contact point]({{< relref "./contact-points/_index.md" >}}) assigned to it that consists of one or more [notifiers]({{< relref "./contact-points/_index.md#list-of-notifiers-supported-by-grafana" >}}).
