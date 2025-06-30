---
Feedback Link: https://github.com/grafana/tutorials/issues/new
categories:
  - alerting
description: Create alerts with Logs
id: grafana-alerts-with-loki
labels:
  products:
    - enterprise
    - oss
    - cloud
    - loki
    - alerting
tags:
  - advanced
title: How to create alert rules with log data
weight: 70
killercoda:
  title: How to create alert rules with log data
  description: Learn how to use Loki with Grafana Alerting to keep track of what’s happening in your environment with real log data.
  preprocessing:
    substitutions:
      - regexp: docker compose
        replacement: docker-compose
  backend:
    imageid: ubuntu
---

<!-- INTERACTIVE page intro.md START -->

# How to create alert rules with log data

Loki stores your logs and only indexes labels for each log stream. Using Loki with Grafana Alerting is a powerful way to keep track of what’s happening in your environment. You can create metric alert rules based on content in your log lines to notify your team. What’s even better is that you can add label data from the log message directly into your alert notification.

In this tutorial, you'll:

- Generate sample logs and pull them with Promtail to Grafana.
- Create an alert rule based on a Loki query (LogQL).
- Create a Webhook contact point to send alert notifications to.

<!-- INTERACTIVE ignore START -->

{{< admonition type="tip" >}}
In [Get started with Grafana Alerting - Part 2](http://www.grafana.com/tutorials/alerting-get-started-pt2/) you can advance your skills by exploring alert instances and notification routing.
{{< /admonition >}}

<!-- INTERACTIVE ignore END -->

{{< docs/ignore >}}

> In [Get started with Grafana Alerting - Part 2](http://www.grafana.com/tutorials/alerting-get-started-pt2/) you can advance your skills by exploring alert instances and notification routing.

{{< /docs/ignore >}}

<!-- INTERACTIVE page intro.md END -->

<!-- INTERACTIVE page step1.md START -->

## Before you begin

<!-- INTERACTIVE ignore START -->

There are different ways you can follow along with this tutorial.

- **Grafana OSS**

  To run a Grafana stack locally, ensure you have the following applications installed:

  - [Docker Compose](https://docs.docker.com/get-docker/) (included in Docker for Desktop for macOS and Windows)
  - [Git](https://git-scm.com/)

- **Interactive learning environment**

  - Alternatively, you can [try out this example in our interactive learning environment](https://killercoda.com/grafana-labs/course/grafana/alerting-loki-logs). It's a fully configured environment with all the dependencies already installed.

## Set up the Grafana stack

<!-- INTERACTIVE ignore END -->

To demonstrate the observation of data using the Grafana stack, download and run the following files.

1. Download and save a Docker compose file to run Grafana, Loki and Promtail.

   ```bash
   wget https://raw.githubusercontent.com/grafana/loki/refs/heads/main/production/docker-compose.yaml -O docker-compose.yaml
   ```

2. Run the Grafana stack.

   ```bash
   docker compose up -d
   ```

The first time you run `docker compose up -d`, Docker downloads all the necessary resources for the tutorial. This might take a few minutes, depending on your internet connection.

<!-- INTERACTIVE ignore START -->

{{< admonition type="note" >}}

If you already have Grafana, Loki, or Prometheus running on your system, you might see errors, because the Docker image is trying to use ports that your local installations are already using. If this is the case, stop the services, then run the command again.

{{< /admonition >}}

<!-- INTERACTIVE ignore END -->

{{< docs/ignore >}}

> If you already have Grafana, Loki, or Prometheus running on your system, you might see errors, because the Docker image is trying to use ports that your local installations are already using. If this is the case, stop the services, then run the command again.

{{< /docs/ignore >}}

<!-- INTERACTIVE page step1.md END -->

<!-- INTERACTIVE page step2.md START -->

## Generate sample logs

To demonstrate how to create alert rules based on logs, you’ll use a script that generates realistic log entries to simulate typical monitoring data in Grafana. Running this script outputs logs continuously, each containing a timestamp, HTTP method (either GET or POST), status code (200 for success or 500 for failures), and request duration in milliseconds.

1. Download and save a Python file that generates logs.

   ```bash
   wget https://raw.githubusercontent.com/grafana/tutorial-environment/master/app/loki/web-server-logs-simulator.py
   ```

1. Execute the log-generating Python script.

   ```bash
   python3 ./web-server-logs-simulator.py | sudo tee -a /var/log/web_requests.log
   ```

### Troubleshooting the script

If you don't see the sample logs in Explore:

- Does the output file exist, check `/var/log/web_requests.log` to see if it contains logs.
- If the file is empty, check that you followed the steps above to create the file.
- If the file exists, verify that promtail container is running.
- In Grafana Explore, check that the time range is only for the last 5 minutes.

<!-- INTERACTIVE page step2.md END -->

<!-- INTERACTIVE page step3.md START -->

## Create a contact point

Besides being an open-source observability tool, Grafana has its own built-in alerting service. This means that you can receive notifications whenever there is an event of interest in your data, and even see these events graphed in your visualizations.

In this step, we set up a new contact point. This contact point uses the [webhook integration](https://grafana.com/docs/grafana/latest/alerting/configure-notifications/manage-contact-points/integrations/webhook-notifier/). This contact point uses the _webhooks_ integration. In order to make this work, we also need an endpoint for our webhook integration to receive the alert. We can use [Webhook.site](https://webhook.site/) to quickly set up that test endpoint. This way we can make sure that our alert is actually sending a notification somewhere.

<!-- INTERACTIVE ignore START -->

1. In your browser, **sign in** to your Grafana Cloud account.

   OSS users: To log in, navigate to [http://localhost:3000](http://localhost:3000), where Grafana should be running.

1. In another tab, go to [Webhook.site](https://webhook.site/).
1. Copy Your unique URL.
<!-- INTERACTIVE ignore END -->

{{< docs/ignore >}}

1. Navigate to [http://localhost:3000](http://localhost:3000), where Grafana should be running.
1. In another tab, go to [Webhook.site](https://webhook.site/).
1. Copy Your unique URL.
   {{< /docs/ignore >}}

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

<!-- INTERACTIVE page step3.md END -->

<!-- INTERACTIVE page step4.md START -->

## Create an alert rule

Next, we'll establish an [alert rule](http://grafana.com/docs/grafana/next/alerting/fundamentals/alert-rule-evaluation/) within Grafana Alerting to notify us whenever alert rules are triggered and resolved.

1. In Grafana, **navigate to Alerting** > **Alert rules**.
1. Click on **New alert rule**.
1. Enter alert rule name for your alert rule. Make it short and descriptive as this appears in your alert notification. For instance, **web-requests-logs**

### Define query and alert condition

In this section, we use the default options for Grafana-managed alert rule creation. The default options let us define the query, a expression (used to manipulate the data -- the `WHEN` field in the UI), and the condition that must be met for the alert to be triggered (in default mode is the threshold).

1. Select the **Loki** datasource from the drop-down.
1. In the Query editor, switch to **Code** mode by clicking the button on the right.
1. Paste the query below.

   ```
   sum by (message)(count_over_time({filename="/var/log/web_requests.log"} != "status=200" | pattern "<_> <message> duration<_>" [10m]))
   ```

   This query counts the number of log lines with a status code that is not 200 (OK), then sum the result set by message type using an **instant query** and the time interval indicated in brackets. It uses the LogQL pattern parser to add a new label called `message` that contains the level, method, url, and status from the log line.

   You can use the **explain query** toggle button for a full explanation of the query syntax. The optional log-generating script creates a sample log line similar to the one below:

   ```
   2023-04-22T02:49:32.562825+00:00 level=info method=GET url=test.com status=200 duration=171ms
   ```

   <!-- INTERACTIVE ignore START -->

   {{< admonition type="note" >}}
   If you're using your own logs, modify the LogQL query to match your own log message. Refer to the Loki docs to understand the [pattern parser](https://grafana.com/docs/loki/latest/logql/log_queries/#pattern).
   {{% / admonition %}}
   <!-- INTERACTIVE ignore END -->

   {{< docs/ignore >}}
   If you're using your own logs, modify the LogQL query to match your own log message. Refer to the Loki docs to understand the [pattern parser](https://grafana.com/docs/loki/latest/logql/log_queries/#pattern).
   {{< /docs/ignore >}}

1. In the **Alert condition** section:

   - Keep `Last` as the value for the reducer function (`WHEN`), and `0` as the threshold value. This is the value above which the alert rule should trigger.

1. Click **Preview alert rule condition** to run the query.

   It should return alert instances from log lines with a status code that is not 200 (OK), and that has met the alert condition. The condition for the alert rule to fire is any occurrence that goes over the threshold of `0`. Since the Loki query has returned more than zero alert instances, the alert rule is `Firing`.

   {{< figure src="/media/docs/alerting/firing-loki-alert-rule.png" max-width="1200px" caption="Preview of a firing alert instances" >}}

### Set evaluation behavior

An [evaluation group](https://grafana.com/docs/grafana/latest/alerting/fundamentals/alert-rules/rule-evaluation/) defines when an alert rule fires, and it’s based on two settings:

- **Evaluation group**: how frequently the alert rule is evaluated.
- **Evaluation interval**: how long the condition must be met to start firing. This allows your data time to stabilize before triggering an alert, helping to reduce the frequency of unnecessary notifications.

To set up the evaluation:

1. In **Folder**, click **+ New folder** and enter a name. For example: _web-server-alerts_. This folder contains our alerts.
1. In the **Evaluation group**, repeat the above step to create a new evaluation group. Name it _1m-evaluation_.
1. Choose an **Evaluation interval** (how often the alert are evaluated).
   For example, every `1m` (1 minute).
1. Set the pending period to, `0s` (zero seconds), so the alert rule fires the moment the condition is met.

### Configure labels and notifications

Choose the contact point where you want to receive your alert notifications.

1. Under **Contact point**, select **Webhook** from the drop-down menu.
1. Click **Save rule and exit** at the top right corner.

<!-- INTERACTIVE page step4.md END -->

<!-- INTERACTIVE page step5.md START -->

## Trigger the alert rule

Since the Python script continues to generate log data that matches the alert rule condition, once the evaluation interval has concluded, you should receive an alert notification in the Webhook endpoint.

{{< figure src="/media/docs/alerting/alerting-webhook-firing-alert.png" max-width="1200px" caption="Firing alert notification details" >}}

<!-- INTERACTIVE page step5.md END -->

<!-- INTERACTIVE page finish.md START -->

<!-- INTERACTIVE ignore START -->

{{< admonition type="tip" >}}
In [Get started with Grafana Alerting - Part 2](http://www.grafana.com/tutorials/alerting-get-started-pt2/) you can advance your skills by exploring alert instances and notification routing.
{{< /admonition >}}

<!-- INTERACTIVE ignore END -->

{{< docs/ignore >}}

> In [Get started with Grafana Alerting - Part 2](http://www.grafana.com/tutorials/alerting-get-started-pt2/) you can advance your skills by exploring alert instances and notification routing.

{{< /docs/ignore >}}

<!-- INTERACTIVE page finish.md END -->
