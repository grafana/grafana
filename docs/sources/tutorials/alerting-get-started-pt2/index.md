---
Feedback Link: https://github.com/grafana/tutorials/issues/new
categories:
  - alerting
description: This is part 2 of the Get started with Grafana Alerting tutorials. Learn how to leverage alert instances, and set up a  notification policy that routes alert notifications based on labels to a specific contact point.
id: alerting-get-started-pt2
labels:
  products:
    - enterprise
    - oss
    - cloud
tags:
  - beginner
title: Get started with Grafana Alerting - Part 2
weight: 50
---

# Get started with Grafana Alerting - Part 2

## Introduction

This is part 2 of the [Get Started with Grafana Alerting tutorial](http://grafana.com/tutorials/alerting-get-started/).

In this guide, we dig into more complex yet equally fundamental elements of Grafana Alerting: **alert instances** and **notification policies**.

After introducing each component, you will learn how to:

- Configure an alert rule that returns more than one alert instance
- Create notification policies that route firing alert instances to different contact points
- Use labels to match alert instances and notification policies

Learning about alert instances and notification policies is useful if you have more than one contact point in your organization, or if your alert rule returns a number of metrics that you want to handle separately by routing each alert instance to a specific contact point. The tutorial will introduce each concept, followed by how to apply both concepts in a real-world scenario.

## Alert instances

An [alert instance](https://grafana.com/docs/grafana/latest/alerting/fundamentals/#alert-instances) is an event that matches a metric returned by an alert rule query.

Let's consider a scenario where you're monitoring website traffic using Grafana. You've set up an alert rule to trigger an alert instance if the number of page views exceeds a certain threshold (more than `1000` page views) within a specific time period, say, over the past `5` minutes.

If the query returns more than one time-series, each time-series represents a different metric or aspect being monitored. In this case, the alert rule is applied individually to each time-series.

{{< figure src="/media/docs/alerting/get-started-digram-instance-grey.png" max-width="1200px" caption="Alert Instances in the Context of an Alert Rule" >}}

In this scenario, each time-series is evaluated independently against the alert rule. It results in the creation of an alert instance for each time-series. The time-series corresponding to the desktop page views meets the threshold and, therefore, results in an alert instance in **Firing** state for which an alert notification is sent. The mobile alert instance state remains **Normal**.

## Notification policies

[Notification policies](https://grafana.com/docs/grafana/latest/alerting/fundamentals/notifications/notification-policies/) route alerts to different communication channels, reducing alert noise and providing control over when and how alerts are sent. For example, you might use notification policies to ensure that critical alerts about server downtime are sent immediately to the on-call engineer. Another use case could be routing performance alerts to the development team for review and action.

Key Characteristics:

- Route alert notifications by matching alerts and policies with labels
- Manage when to send notifications

{{< figure src="/media/docs/alerting/get-started-notification-policy-tree-combo.png" max-width="1200px" caption="Routing of alerts with notification policies" >}}

In the above diagram, alert instances and notification policies are matched by labels. For instance, the label `team=operations` matches the alert instance “**Pod stuck in CrashLoop**” and “**Disk Usage -80%**” to child policies that send alert notifications to a particular contact point (operations@grafana.com).

## Create notification policies

Create a notification policy if you want to handle metrics returned by alert rules separately by routing each alert instance to a specific contact point. In Grafana, click on the icon at the top left corner of the screen to access the navigation menu.

1. Navigate to **Alerts & IRM > Alerting > Notification policies**.
1. In the Default policy, click **+ New child policy**.
1. In the field **Label** enter `device`, and in the field **Value** enter `desktop`.
1. From the **Contact point** drop-down, choose **Webhook**.
    {{< admonition type="note" >}}
    If you don’t have any contact points, add a [Contact point](http://localhost:3002/docs/grafana/latest/tutorials/alerting-get-started/#create-a-contact-point).
    {{</ admonition >}}
1. Click **Save Policy**.

    This new child policy routes alerts that match the label `device=desktop` to the Webhook contact point.  

1. **Repeat the steps above to create a second child policy** to match another alert instance. For labels use: `device=mobile`. Use the Webhook integration for the contact point. Alternatively, experiment by using a different Webhook endpoint or a [different integration](https://grafana.com/docs/grafana/latest/alerting/configure-notifications/manage-contact-points/#list-of-supported-integrations).

## Create an alert rule that returns alert instances

The alert rule that you are about to create is meant to monitor web traffic page views. The objective is to explore what an alert instance is and how to leverage routing individual alert instances by using label matchers and notification policies.

### Add a data source

Grafana includes a [test data source](https://grafana.com/docs/grafana/latest/datasources/testdata/) that creates simulated time series data.

1. In Grafana navigate to **Connections > Add new connection**.
1. Search for **TestData**.
1. Click **Add new data source**.
1. Click **Save & test**.

    You should see a message confirming that the data source is working.

### Create an alert rule

1. Navigate to **Alerting > Alert rules**.
1. Click **New alert rule**.

### Enter an alert rule name

Make it short and descriptive as this will appear in your alert notification. For instance, `web-traffic`.

### Define query and alert condition

In this section, we define queries, expressions (used to manipulate the data), and the condition that must be met for the alert to be triggered.

1. Select **TestData** data source from the drop-down menu.
1. From **Scenario** select **CSV Content**.
1. Copy in the following CSV data:

```
device,views
desktop,1200
mobile,900
```

The above CSV data simulates a data source returning multiple time series, each leading to the creation of an alert instance for that specific time series. Note that the data returned matches the example in the [Alert instance](#alert-instances) section.

1. Remove the ‘B’ **Reduce expression** (click the bin icon). The Reduce expression is default, and in this case, is not required since the queried data is already reduced. Note that the Threshold expression is now your **Alert condition**.
1. In the ‘C’ **Threshold expression**:
    - Change the **Input** to ‘**A**’ to select the data source.
    - Enter `1000` as the threshold value. This is the value above which the alert rule should trigger.
1. Click **Preview** to run the queries.

It should return two series.`desktop` in Firing state, and `mobile` in Normal state. The values `1`, and `0` mean that the condition is either `true` or `false`.

{{< figure src="/media/docs/alerting/get-started-expression-instances.png" max-width="1200px" caption="Preview of a query returning two alert instances in Grafana." >}}

### Set evaluation behavior

In the [life cycle](http://grafana.com/docs/grafana/next/alerting/fundamentals/alert-rule-evaluation/) of alert instances, when an alert condition (threshold) is not met, the alert instance state is **Normal**. Similarly, when the condition is breached (for longer than the pending period, which in this tutorial will be 0), the alert instance state switches back to **Alerting**, which means that the alert rule state is **Firing**, and a notification is sent.

To set up evaluation behavior:

1. In **Folder**, click **+ New folder** and enter a name. For example: `web-traffic-alerts`. This folder will contain our alerts.
1. In the **Evaluation group**, repeat the above step to create a new evaluation group. We will name it `1m` (referring to “1 minute”).
1. Choose an Evaluation interval (how often the alert will be evaluated). Choose `1m`.
1. Set the pending period to `0s` (zero seconds), so the alert rule fires the moment the condition is met.

### Configure labels and notifications

In this section, you can select how you want to route your alert instances. Since we want to route by notification policy, we need to ensure that the labels match the alert instance.

1. Choose **Use notification policy**.
1. Click **Preview routing**. Based on the existing labels, you should see a preview of what policies are matching with the alerts. There should be two alert instances matching the labels that were previously setup in each notification policy: `device=desktop`, `device=mobile`.

    These [types of labels](https://grafana.com/docs/grafana/latest/alerting/fundamentals/alert-rules/annotation-label/#label-types) are generated by the data source query and they can be leveraged to match our notification policies without needing to manually add them to the alert rule.

    {{< figure src="/media/docs/alerting/get-started-alert-instace-routing-prev.png" max-width="1200px" caption="Routing preview of matched notification policies" >}}

    {{< admonition type="note" >}}
    Even if both labels match the policies, only the alert instance in Firing state produces an alert notification.
    {{</ admonition >}}

1. Click **Save rule and exit**.

Now that we have set up the alert rule, it’s time to check the alert notification.

## Receive alert notifications

Now that the alert rule has been configured, you should receive alert [notifications](http://grafana.com/docs/grafana/next/alerting/fundamentals/alert-rule-evaluation/state-and-health/#notifications) in the contact point whenever the alert triggers and gets resolved. In our example, each alert instance should be routed separately as we configured labels to match notification policies. Once the evaluation interval has concluded (1m), you should receive an alert notification in the Webhook endpoint.

{{< figure src="/media/docs/alerting/get-started-webhook-alert-isntance.png" max-width="1200px" caption="" >}}

The alert notification details show that the alert instance corresponding to the website views from desktop devices was correctly routed through the notification policy to the Webhook contact point. The notification also shows that the instance is in **Firing** state, as well as it includes the label `device=desktop`, which makes the routing of the alert instance possible.

Feel free to change the CSV data in the alert rule to trigger the routing of the alert instance that matches the label `device=mobile`.

## Summary

In this tutorial, you have learned how Grafana Alerting can route individual alert instances using the labels generated by the data-source query and match these labels with notification policies, which in turn routes alert notifications to specific contact points.

If you run into any problems, you are welcome to post questions in our [Grafana Community forum](https://community.grafana.com/).

Enjoy your monitoring!
