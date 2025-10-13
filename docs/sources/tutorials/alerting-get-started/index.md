---
Feedback Link: https://github.com/grafana/tutorials/issues/new
categories:
  - alerting
description: Get started with Grafana Alerting by creating your first alert in just a few minutes. Learn how to set up an alert, send alert notifications to a public webhook, and generate sample data to observe your alert in action.
id: alerting-get-started-pt1
labels:
  products:
    - enterprise
    - oss
    - cloud
tags:
  - beginner
title: Get started with Grafana Alerting - Part 1
weight: 50
killercoda:
  title: Get started with Grafana Alerting - Part 1
  description: Get started with Grafana Alerting by creating your first alert rule, sending notifications to a webhook, and generating data to test it live — Part 1.
  backend:
    imageid: ubuntu
---

<!-- INTERACTIVE page intro.md START -->

# Get started with Grafana Alerting - Part 1

In this guide, we walk you through the process of setting up your first alert in just a few minutes. You'll witness your alert in action with real-time data, as well as sending alert notifications.

In this tutorial you will:

- Create a contact point.
- Set up an alert rule.
- Receive firing and resolved alert notifications in a public webhook.

<!-- INTERACTIVE ignore START -->

{{< admonition type="tip" >}}

Once you have completed Part 1, don’t forget to explore the advanced but essential alerting topics in [Part 2 Alert instances and notification routing](http://www.grafana.com/tutorials/alerting-get-started-pt2/).

{{< /admonition >}}

<!-- INTERACTIVE ignore END -->

{{< docs/ignore >}}

> Once you have completed Part 1, don’t forget to explore the advanced but essential alerting topics in [Part 2 Alert instances and notification routing](http://www.grafana.com/tutorials/alerting-get-started-pt2/).

{{< /docs/ignore >}}

<!-- INTERACTIVE page intro.md END -->
<!-- INTERACTIVE page step1.md START -->
<!-- INTERACTIVE ignore START -->

## Before you begin

There are different ways you can follow along with this tutorial.

- **Grafana Cloud**

  - As a Grafana Cloud user, you don't have to install anything. [Create your free account](http://www.grafana.com/auth/sign-up/create-user).

  Continue to [Create a contact point](#create-a-contact-point).

- **Interactive learning environment**

  - Alternatively, you can [try out this example in our interactive learning environment](https://killercoda.com/grafana-labs/course/grafana/alerting-get-started/). It's a fully configured environment with all the dependencies already installed.

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

## Create a contact point

Besides being an open-source observability tool, Grafana has its own built-in alerting service. This means that you can receive notifications whenever there is an event of interest in your data, and even see these events graphed in your visualizations.

In this step, we set up a new contact point. This contact point uses the [webhook integration](https://grafana.com/docs/grafana/latest/alerting/configure-notifications/manage-contact-points/integrations/webhook-notifier/). In order to make this work, we also need an endpoint for our webhook integration to receive the alert. We can use [Webhook.site](https://webhook.site/) to quickly set up that test endpoint. This way we can make sure that our alert is actually sending a notification somewhere.

1. In your browser, **sign in** to your Grafana Cloud account.

   OSS users: To log in, navigate to [http://localhost:3000](http://localhost:3000), where Grafana is running.

1. In another tab, go to [Webhook.site](https://webhook.site/).
1. Copy Your unique URL.

Your webhook endpoint is now waiting for the first request.

Next, let's configure a contact point in Grafana's Alerting UI to send notifications to our webhook endpoint.

1. Return to Grafana. In Grafana's sidebar, hover over the **Alerting** (bell) icon and then click **Contact points**.
1. Click **+ Create contact point**.
1. In **Name**, write **Webhook**.
1. In **Integration**, choose **Webhook**.
1. In **URL**, paste the endpoint to your webhook endpoint.
1. Click **Test**, and then click **Send test notification** to send a test alert to your webhook endpoint.
1. Navigate back to _Webhook.site_. On the left side, there's now a `POST /` entry. Click it to see what information Grafana sent.

   {{< figure src="/media/docs/alerting/alerting-webhook-detail.png" max-width="1200px" caption="A POST entry in Webhook.site" >}}

1. Return to Grafana and click **Save contact point**.

We have created a dummy Webhook endpoint and created a new Alerting contact point in Grafana. Now, we can create an alert rule and link it to this new integration.

<!-- INTERACTIVE page step2.md END -->

<!-- INTERACTIVE page step3.md START -->

## Create an alert

Next, we establish an [alert rule](https://grafana.com/docs/grafana/latest/alerting/alerting-rules/create-grafana-managed-rule/) within Grafana Alerting to notify us whenever alert rules are triggered and resolved.

1. In Grafana, navigate to **Alerts & IRM > Alerting > Alert rules**. Click on **New alert rule**.

1. Enter alert rule name for your alert rule. Make it short and descriptive as this appears in your alert notification. For instance, **database-metrics**

### Define query and alert condition

In this section, we use the default options for Grafana-managed alert rule creation. The default options let us define the query, a expression (used to manipulate the data -- the `WHEN` field in the UI), and the condition that must be met for the alert to be triggered (in default mode is the threshold).

Grafana includes a [test data source](https://grafana.com/docs/grafana/latest/datasources/testdata/) that creates simulated time series data. This data source is included in the demo environment for this tutorial. If you're working in Grafana Cloud or your own local Grafana instance, you can add the data source through the **Connections** menu.

1. Select the **TestData** data source from the drop-down menu.

1. In the **Alert condition** section:

   - Keep `Last` as the value for the reducer function (`WHEN`), and `0` as the threshold value. This is the value above which the alert rule should trigger.

1. Click **Preview alert rule condition** to run the query.

   It should return random time series data. The alert rule state should be `Firing`.

   {{< figure src="/media/docs/alerting/random-walk-firing-alert-rule.png" max-width="1200px" caption="A preview of a firing alert" >}}

### Add folders and labels

1. In **Folder**, click **+ New folder** and enter a name. For example: `metric-alerts` . This folder contains our alert rules.

### Set evaluation behavior

The [alert rule evaluation](https://grafana.com/docs/grafana/latest/alerting/fundamentals/alert-rules/rule-evaluation/) defines the conditions under which an alert rule triggers, based on the following settings:

- **Evaluation group**: every alert rule is assigned to an evaluation group. You can assign the alert rule to an existing evaluation group or create a new one.
- **Evaluation interval**: determines how frequently the alert rule is checked. For instance, the evaluation may occur every 10s, 30s, 1m, 10m, etc.
- **Pending period**: how long the condition must be met to trigger the alert rule.

To set up the evaluation:

1. In the **Evaluation group and interval**, repeat the above step to create a new evaluation group. Name it _1m-evaluation_.
1. Choose an **Evaluation interval** (how often the alert are evaluated).
   For example, every `1m` (1 minute).
1. Set the **pending period** to, `0s` (zero seconds), so the alert rule fires the moment the condition is met.

### Configure notifications

Choose the contact point where you want to receive your alert notifications.

1. Under **Contact point**, select **Webhook** from the drop-down menu.
1. Click **Save rule and exit** at the top right corner.

<!-- INTERACTIVE page step3.md END -->

<!-- INTERACTIVE page step4.md START -->

## Trigger and resolve an alert

Now that the alert rule has been configured, you should receive alert [notifications](http://grafana.com/docs/grafana/next/alerting/fundamentals/alert-rule-evaluation/state-and-health/#notifications) in the contact point whenever alerts trigger and get resolved.

### Trigger an alert

Since the alert rule that you have created has been configured to always fire, once the evaluation interval has concluded, you should receive an alert notification in the Webhook endpoint.

{{< figure src="/media/docs/alerting/alerting-webhook-firing-alert.png" max-width="1200px" caption="Firing alert notification details" >}}

The alert notification details show that the alert rule state is Firing , and it includes the value that made the rule trigger by exceeding the threshold of the alert rule condition. The notification also includes links to see the alert rule details, and another link to add a [Silence](http://grafana.com/docs/grafana/next/alerting/configure-notifications/create-silence/) to it.

### Resolve an alert

To see how a resolved alert notification looks like, you can modify the current alert rule threshold.

To edit the Alert rule:

1. **Navigate to Alerting** > **Alert rules**.
1. Click on the metric-alerts folder to display the alert that you created earlier
1. Click the **edit** button on the right hand side of the screen
1. Increment the Threshold expression to 1.
1. Click **Save rule and exit**.

By incrementing the threshold, the condition is no longer met, and after the evaluation interval has concluded (1 minute approx.), you should receive an alert notification with status **“Resolved”**.

<!-- INTERACTIVE page step4.md END -->

<!-- INTERACTIVE page finish.md START -->

## Learn more in [Grafana Alerting Part 2](http://www.grafana.com/tutorials/alerting-get-started-pt2/)

<!-- INTERACTIVE ignore START -->

{{< admonition type="tip" >}}

In [Get started with Grafana Alerting - Part 2](http://www.grafana.com/tutorials/alerting-get-started-pt2/) you can advance your skills by exploring alert instances and notification routing.

{{< /admonition >}}

<!-- INTERACTIVE ignore END -->

{{< docs/ignore >}}

In [Get started with Grafana Alerting - Part 2](http://www.grafana.com/tutorials/alerting-get-started-pt2/) you can advance your skills by exploring alert instances and notification routing.

{{< /docs/ignore >}}

<!-- INTERACTIVE page finish.md END -->
