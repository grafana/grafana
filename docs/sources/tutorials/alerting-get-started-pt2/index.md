---
Feedback Link: https://github.com/grafana/tutorials/issues/new
categories:
  - alerting
description: Learn to use alert instances and route notifications by labels to contacts.
labels:
  products:
    - enterprise
    - oss
    - cloud
tags:
  - beginner
title: Get started with Grafana Alerting - Multi-dimensional alerts and how to route them
weight: 63
killercoda:
  title: Get started with Grafana Alerting - Multi-dimensional alerts and how to route them
  description: Learn to use alert instances and route notifications by labels to contacts.
  backend:
    imageid: ubuntu
---

<!-- INTERACTIVE page intro.md START -->

This tutorial is a continuation of the [Grafana Alerting - Create and receive your first alert](http://www.grafana.com/tutorials/alerting-get-started/) tutorial.

In this guide, we dig into more complex yet equally fundamental elements of Grafana Alerting: **alert instances** and **notification policies**.

{{< youtube id="nI-_MEnFBQs" >}}

After introducing each component, you will learn how to:

- Configure an alert rule that returns more than one alert instance
- Create notification policies that route firing alert instances to different contact points
- Use labels to match alert instances and notification policies

Learning about alert instances and notification policies is useful if you have more than one contact point in your organization, or if your alert rule returns a number of metrics that you want to handle separately by routing each alert instance to a specific contact point. The tutorial will introduce each concept, followed by how to apply both concepts in a real-world scenario.

<!-- INTERACTIVE page intro.md END -->
<!-- INTERACTIVE page step1.md START -->

<!-- INTERACTIVE ignore START -->

{{< docs/ignore >}}

## Set up the Grafana stack

{{< /docs/ignore >}}

## Before you begin

There are different ways you can follow along with this tutorial.

- **Grafana Cloud**

  - As a Grafana Cloud user, you don't have to install anything. [Create your free account](http://www.grafana.com/auth/sign-up/create-user).

  Continue to [Alert instances](#alert-instances).

- **Interactive learning environment**

  - Alternatively, you can try out this example in our interactive learning environment: [Get started with Grafana Alerting - Alert routing](https://killercoda.com/grafana-labs/course/grafana/alerting-get-started-pt2/). It's a fully configured environment with all the dependencies already installed.

- **Grafana OSS**

  - If you opt to run a Grafana stack locally, ensure you have the following applications installed:

  - [Docker Compose](https://docs.docker.com/get-docker/) (included in Docker for Desktop for macOS and Windows)
  - [Git](https://git-scm.com/)

### Set up the Grafana stack (OSS users)

<!-- INTERACTIVE ignore END -->

To demonstrate the observation of data using the Grafana stack, download and run the following files.

1. Clone the [tutorial environment repository](https://www.github.com/grafana/tutorial-environment).

   <!-- INTERACTIVE exec START -->

   ```
   git clone https://github.com/grafana/tutorial-environment.git
   ```

   <!-- INTERACTIVE exec END -->

1. Change to the directory where you cloned the repository:

   <!-- INTERACTIVE exec START -->

   ```
   cd tutorial-environment
   ```

   <!-- INTERACTIVE exec END -->

1. Run the Grafana stack:

   <!-- INTERACTIVE ignore START -->

   ```
   docker compose up -d
   ```

   <!-- INTERACTIVE ignore END -->

   {{< docs/ignore >}}

   <!-- INTERACTIVE exec START -->

   ```bash
   docker-compose up -d
   ```

   <!-- INTERACTIVE exec END -->

   {{< /docs/ignore >}}

   The first time you run `docker compose up -d`, Docker downloads all the necessary resources for the tutorial. This might take a few minutes, depending on your internet connection.

   <!-- INTERACTIVE ignore START -->

   {{< admonition type="note" >}}
   If you already have Grafana, Loki, or Prometheus running on your system, you might see errors, because the Docker image is trying to use ports that your local installations are already using. If this is the case, stop the services, then run the command again.
   {{< /admonition >}}

   <!-- INTERACTIVE ignore END -->

   {{< docs/ignore >}}

   NOTE:

   If you already have Grafana, Loki, or Prometheus running on your system, you might see errors, because the Docker image is trying to use ports that your local installations are already using. If this is the case, stop the services, then run the command again.

   {{< /docs/ignore >}}

<!-- INTERACTIVE page step1.md END -->
<!-- INTERACTIVE page step2.md START -->

## Alert instances

An [alert instance](https://grafana.com/docs/grafana/latest/alerting/fundamentals/#alert-instances) is an event that matches a metric returned by an alert rule query.

Let's consider a scenario where you're monitoring website traffic using Grafana. You've set up an alert rule to trigger an alert instance if the number of page views exceeds a certain threshold (more than `1000` page views) within a specific time period, say, over the past `5` minutes.

If the query returns more than one time-series, each time-series represents a different metric or aspect being monitored. In this case, the alert rule is applied individually to each time-series.

{{< figure alt="Screenshot displaying alert instances in the context of an alert rule, highlighting the specific alerts triggered by the rule and their respective statuses" src="/media/docs/alerting/alert-instance-flow.jpg" max-width="1200px" caption="Alert Instances in the Context of an Alert Rule" >}}

In this scenario, each time-series is evaluated independently against the alert rule. It results in the creation of an alert instance for each time-series. The time-series corresponding to the desktop page views meets the threshold and, therefore, results in an alert instance in **Firing** state for which an alert notification is sent. The mobile alert instance state remains **Normal**.

<!-- INTERACTIVE page step2.md END -->
<!-- INTERACTIVE page step3.md START -->

## Notification policies

[Notification policies](https://grafana.com/docs/grafana/latest/alerting/fundamentals/notifications/notification-policies/) route alerts to different communication channels, reducing alert noise and providing control over when and how alerts are sent. For example, you might use notification policies to ensure that critical alerts about server downtime are sent immediately to the on-call engineer. Another use case could be routing performance alerts to the development team for review and action.

Key Characteristics:

- Route alert notifications by matching alerts and policies with labels
- Manage when to send notifications

{{< figure alt="Screenshot illustrating the routing of alerts with notification policies, including the configuration and flow of alerts through different notification channels" src="/media/docs/alerting/get-started-notification-policy-tree-combo.png" max-width="1200px" caption="Routing of alerts with notification policies" >}}

In the above diagram, alert instances and notification policies are matched by labels. For instance, the label `team=operations` matches the alert instance “**Pod stuck in CrashLoop**” and “**Disk Usage -80%**” to child policies that send alert notifications to a particular contact point (operations@grafana.com).

<!-- INTERACTIVE page step3.md END -->
<!-- INTERACTIVE page step4.md START -->

## Create notification policies

Create a notification policy if you want to handle metrics returned by alert rules separately by routing each alert instance to a specific contact point.

<!-- INTERACTIVE ignore START -->

1. In your browser, **sign in** to your Grafana Cloud account.

   OSS and interactive learning environment users: To log in, navigate to [http://localhost:3000](http://localhost:3000), where Grafana should be running.

1. Navigate to **Alerts & IRM > Alerting > Notification policies**.
1. In the Default policy, click **+ New child policy**.
1. In the field **Label** enter `device`, and in the field **Value** enter `desktop`.
1. From the **Contact point** drop-down, choose **Webhook**.
   {{< admonition type="note" >}}
   If you don’t have any contact points, add a [Contact point](https://grafana.com/tutorials/alerting-get-started/#create-a-contact-point).
   {{</ admonition >}}
1. Enable Continue matching:

   Turn on **Continue matching subsequent sibling nodes** so the evaluation continues even after one or more labels (i.e. `device` label) match.

1. Click **Save Policy**.

   This new child policy routes alerts that match the label `device=desktop` to the Webhook contact point.

1. **Repeat the steps above to create a second child policy** to match another alert instance. For labels use: `device=mobile`. Use the Webhook integration for the contact point. Alternatively, experiment by using a different Webhook endpoint or a [different integration](https://grafana.com/docs/grafana/latest/alerting/configure-notifications/manage-contact-points/#supported-contact-point-integrations).

<!-- INTERACTIVE ignore END -->

{{< docs/ignore >}}

1. Visit [http://localhost:3000](http://localhost:3000), where Grafana should be running
1. Navigate to **Alerts & IRM > Alerting > Notification policies**.
1. In the Default policy, click **+ New child policy**.
1. In the field **Label** enter `device`, and in the field **Value** enter `desktop`.
1. From the **Contact point** drop-down, choose **Webhook**.

   If you don’t have any contact points, add a [Contact point](https://grafana.com/tutorials/alerting-get-started/#create-a-contact-point).

1. Click **Save Policy**.

   This new child policy routes alerts that match the label `device=desktop` to the Webhook contact point.

1. **Repeat the steps above to create a second child policy** to match another alert instance. For labels use: `device=mobile`. Use the Webhook integration for the contact point. Alternatively, experiment by using a different Webhook endpoint or a [different integration](https://grafana.com/docs/grafana/latest/alerting/configure-notifications/manage-contact-points/#supported-contact-point-integrations).

{{< /docs/ignore >}}

<!-- INTERACTIVE page step4.md END -->
<!-- INTERACTIVE page step5.md START -->

## Create an alert rule that returns alert instances

The alert rule that you are about to create is meant to monitor web traffic page views. The objective is to explore what an alert instance is and how to leverage routing individual alert instances by using label matchers and notification policies.

   <!-- INTERACTIVE page step5.md END -->
   <!-- INTERACTIVE page step6.md START -->

### Create an alert rule

1. Navigate to **Alerts & IRM > Alerting > Alert rules**.
1. Click **+ New alert rule**.

### Enter an alert rule name

Make it short and descriptive as this will appear in your alert notification. For instance, `web-traffic`.

### Define query and alert condition

In this section, we use the default options for Grafana-managed alert rule creation. The default options let us define the query, a expression (used to manipulate the data -- the `WHEN` field in the UI), and the condition that must be met for the alert to be triggered (in default mode is the threshold).

Grafana includes a [test data source](https://grafana.com/docs/grafana/latest/datasources/testdata/) that creates simulated time series data. This data source is included in the demo environment for this tutorial. If you're working in Grafana Cloud or your own local Grafana instance, you can add the data source through the **Connections** menu.

1. Select **TestData** data source from the drop-down menu.
1. From **Scenario** select **CSV Content**.
1. Copy in the following CSV data:

   ```
   device,views
   desktop,1200
   mobile,900
   ```

   The above CSV data simulates a data source returning multiple time series, each leading to the creation of an alert instance for that specific time series. Note that the data returned matches the example in the [Alert instance](#alert-instances) section.

1. In the **Alert condition** section:

   - Keep `Last` as the value for the reducer function (`WHEN`), and `IS ABOVE 1000` as the threshold value. This is the value above which the alert rule should trigger.

1. Click **Preview alert rule condition** to run the queries.

It should return two series.`desktop` in Firing state, and `mobile` in Normal state. The values `1`, and `0` mean that the condition is either `true` or `false`.

{{< figure alt="Screenshot showing a preview of a query in Grafana that returns two alert instances, including the query results and relevant alert details" src="/media/docs/alerting/firing-instances.png" max-width="1200px" caption="Preview of a query returning two alert instances in Grafana." >}}

<!-- INTERACTIVE page step6.md END -->
<!-- INTERACTIVE page step7.md START -->

### Add folders and labels

1. In **Folder**, click **+ New folder** and enter a name. For example: `web-traffic-alerts` . This folder contains our alert rules.

### Set evaluation behavior

In the [life cycle](http://grafana.com/docs/grafana/next/alerting/fundamentals/alert-rule-evaluation/) of alert instances, when an alert condition (threshold) is not met, the alert instance state is **Normal**. Similarly, when the condition is breached (for longer than the pending period, which in this tutorial will be 0), the alert instance state switches back to **Alerting**, which means that the alert rule state is **Firing**, and a notification is sent.

To set up evaluation behavior:

1. In the **Evaluation group and interval**, enter a name. For example:  `1m-evaluation`.
1. Choose an **Evaluation interval** (how often the alert will be evaluated). Choose `1m`.
1. Set the **pending period** to `0s` (zero seconds), so the alert rule fires the moment the condition is met.
1. Set **Keep firing for** to, `0s`, so the alert stops firing immediately after the condition is no longer true.

### Configure notifications

In this section, you can select how you want to route your alert instances. Since we want to route by notification policy, we need to ensure that the labels match the alert instance.

1. Toggle the **Advanced options** button to display matching Notification policies.
1. Click **Preview routing**. Based on the existing labels, you should see a preview of what policies are matching with the alerts. There should be two alert instances matching the labels that were previously setup in each notification policy: `device=desktop`, `device=mobile`.

   These [types of labels](https://grafana.com/docs/grafana/latest/alerting/fundamentals/alert-rules/annotation-label/#label-types) are generated by the data source query and they can be leveraged to match our notification policies without needing to manually add them to the alert rule.

   {{< figure alt="Screenshot showing a routing preview of matched notification policies, detailing how alerts are matched and routed to specific notification channels" src="/media/docs/alerting/get-started-alert-instace-routing-prev.png" max-width="1200px" caption="Routing preview of matched notification policies" >}}

   <!-- INTERACTIVE ignore START -->

   {{< admonition type="note" >}}
   Even if both labels match the policies, only the alert instance in Firing state produces an alert notification.
   {{</ admonition >}}
   <!-- INTERACTIVE ignore END -->

   {{< docs/ignore >}}
   Even if both labels match the policies, only the alert instance in Firing state produces an alert notification.
   {{< /docs/ignore >}}

1. Click **Save rule and exit**.

Now that we have set up the alert rule, it’s time to check the alert notification.

<!-- INTERACTIVE page step7.md END -->
<!-- INTERACTIVE page step8.md START -->

## Receive alert notifications

Now that the alert rule has been configured, you should receive alert [notifications](http://grafana.com/docs/grafana/next/alerting/fundamentals/alert-rule-evaluation/state-and-health/#notifications) in the contact point whenever the alert triggers and gets resolved. In our example, each alert instance should be routed separately as we configured labels to match notification policies. Once the evaluation interval has concluded (1m), you should receive an alert notification in the Webhook endpoint.

{{< figure alt="Screenshot showing the exploration of alert notification details in a webhook endpoint, displaying the content and structure of the alert payload received by the endpoint" src="/media/docs/alerting/get-started-webhook-alert-isntance.png" max-width="1200px" caption="Exploring alert notification details in webhook endpoint" >}}

The alert notification details show that the alert instance corresponding to the website views from desktop devices was correctly routed through the notification policy to the Webhook contact point. The notification also shows that the instance is in **Firing** state, as well as it includes the label `device=desktop`, which makes the routing of the alert instance possible.

Feel free to change the CSV data in the alert rule to trigger the routing of the alert instance that matches the label `device=mobile`.

<!-- INTERACTIVE page step8.md END -->
<!-- INTERACTIVE page finish.md START -->

## Summary

In this tutorial, you have learned how Grafana Alerting can route individual alert instances using the labels generated by the data-source query and match these labels with notification policies, which in turn routes alert notifications to specific contact points.

If you run into any problems, you are welcome to post questions in our [Grafana Community forum](https://community.grafana.com/).

## Learn more in [Grafana Alerting: Group alert notifications](http://www.grafana.com/tutorials/alerting-get-started-pt3/)

<!-- INTERACTIVE ignore START -->

{{< admonition type="tip" >}}

In [Get started with Grafana Alerting: Group alert notifications](http://www.grafana.com/tutorials/alerting-get-started-pt3/) you learn how to group alert notifications effectively.

{{< /admonition >}}

<!-- INTERACTIVE ignore END -->

{{< docs/ignore >}}

In [Get started with Grafana Alerting: Group alert notifications](http://www.grafana.com/tutorials/alerting-get-started-pt3/) you learn how to group alert notifications effectively.

{{< /docs/ignore >}}

<!-- INTERACTIVE page finish.md END -->
