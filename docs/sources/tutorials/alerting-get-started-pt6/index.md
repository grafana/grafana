---
Feedback Link: https://github.com/grafana/tutorials/issues/new
categories:
  - alerting
description: Create alerts using Prometheus data and link them to your visualizations.
labels:
  products:
    - enterprise
    - oss
    - cloud
tags:
  - beginner
title: Get started with Grafana Alerting - Link alerts to visualizations
weight: 67
killercoda:
  title: Get started with Grafana Alerting - Link alerts to visualizations
  description: Create alerts using Prometheus data and link them to your visualizations.
  backend:
    imageid: ubuntu
---

<!-- INTERACTIVE page intro.md START -->

This tutorial is a continuation of the [Get started with Grafana Alerting - Route alerts using dynamic labels](http://www.grafana.com/tutorials/alerting-get-started-pt5/) tutorial.

<!-- USE CASE -->

In this tutorial you will learn how to:

- Link alert rules to time series panels for better visualization
- View alert annotations directly on dashboards for better context
- Write Prometheus queries

<!-- INTERACTIVE page intro.md END -->
<!-- INTERACTIVE page step1.md START -->

<!-- INTERACTIVE ignore START -->

## Before you begin

- **Interactive learning environment**

  - Alternatively, you can [try out this example in our interactive learning environment](https://killercoda.com/grafana-labs/course/grafana/alerting-get-started-pt6/). It’s a fully configured environment with all the dependencies already installed.

- **Grafana OSS**
  - If you opt to run a Grafana stack locally, ensure you have the following applications installed:
    - Docker Compose (included in Docker for Desktop for macOS and Windows)
    - Git

<!-- INTERACTIVE ignore END -->

### Set up the Grafana stack

To observe data using the Grafana stack, download and run the following files.

1. Clone the [tutorial environment repository](https://github.com/tonypowa/grafana-prometheus-alerting-demo.git).

   ```bash
   git clone https://github.com/tonypowa/grafana-prometheus-alerting-demo.git
   ```

1. Change to the directory where you cloned the repository:

   ```bash
   cd grafana-prometheus-alerting-demo
   ```

1. Build the Grafana stack:

   <!-- INTERACTIVE ignore START -->

   ```
   docker compose build
   ```

   <!-- INTERACTIVE ignore END -->

   {{< docs/ignore >}}

   <!-- INTERACTIVE exec START -->

   ```bash
   docker-compose build
   ```

   <!-- INTERACTIVE exec END -->

   {{< /docs/ignore >}}

1. Bring up the containers:

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

## Use case: monitoring and alerting for system health with Prometheus and Grafana

In this use case, we focus on monitoring the system's CPU, memory, and disk usage as part of a monitoring setup. The [demo app](https://github.com/tonypowa/grafana-prometheus-alerting-demo), launches a stack that includes a Python script to simulate metrics, which Grafana collects and visualizes as a time-series visualization.

The script simulates random CPU and memory usage values (10% to 100%) every **10 seconds** and exposes them as Prometheus metrics.

### Objective

You'll build a time series visualization to monitor CPU and memory usage, define alert rules with threshold-based conditions, and link those alerts to your dashboards to display real-time annotations when thresholds are breached.

<!-- INTERACTIVE page step2.md END -->
<!-- INTERACTIVE page step3.md START -->

## Step 1: Create a visualization to monitor metrics

To keep track of these metrics you can set up a visualization for CPU usage and memory consumption. This will make it easier to see how the system is performing.

The time-series visualization supports alert rules to provide more context in the form of annotations and alert rule state. Follow these steps to create a visualization to monitor the application’s metrics.

1. Log in to Grafana:

   - Navigate to [http://localhost:3000](http://localhost:3000), where Grafana should be running.
   - Username and password: `admin`

1. Create a time series panel:

   - Navigate to **Dashboards**.
   - Click **+ Create dashboard**.
   - Click **+ Add visualization**.
   - Select **Prometheus** as the data source (provided with the demo).
   - Enter a title for your panel, e.g., **CPU and Memory Usage**.

1. Add queries for metrics:

   - In the query area, copy and paste the following PromQL query:

     ** switch to **Code** mode if not already selected **

     ```promql
     flask_app_cpu_usage{instance="flask-prod:5000"}
     ```

   - Click **Run queries**.

   This query should display the simulated CPU usage data for the **prod** environment.

1. Add memory usage query:

   - Click **+ Add query**.
   - In the query area, paste the following PromQL query:

     ```promql
     flask_app_memory_usage{instance="flask-prod:5000"}
     ```

   {{< figure src="/media/docs/alerting/cpu-mem-dash.png" max-width="1200px" caption="Time-series panel displaying CPU and memory usage metrics in production." >}}

1. Click **Save dashboard**. Name it: `cpu-and-memory-metrics`.

We have our time-series panel ready. Feel free to combine metrics with labels such as `flask_app_cpu_usage{instance=“flask-staging:5000”}`, or other labels like `deployment`.

<!-- INTERACTIVE page step3.md END -->
<!-- INTERACTIVE page step4.md START -->

## Step 2: Create alert rules

Follow these steps to manually create alert rules and link them to a visualization.

## Create an alert rule for CPU usage

1. Navigate to **Alerts & IRM > Alerting > Alert rules** from the Grafana sidebar.
1. Click **+ New alert rule** rule to create a new alert.

### Enter alert rule name

Make it short and descriptive, as this will appear in your alert notification. For instance, `cpu-usage` .

### Define query and alert condition

1. Select **Prometheus** data source from the drop-down menu.
1. In the query section, enter the following query:

   ** switch to **Code** mode if not already selected **

   ```
   flask_app_cpu_usage{instance="flask-prod:5000"}
   ```

1. **Alert condition**

   - Enter 75 as the value for **WHEN QUERY IS ABOVE** to set the threshold for the alert.
   - Click **Preview alert rule condition** to run the queries.

     {{< figure src="/media/docs/alerting/alert-condition-details-prod.png" max-width="1200px" caption="Preview of a query returning alert instances in Grafana." >}}

   The query returns the CPU usage of the Flask application in the production environment. In this case, the usage is `86.01%`, which exceeds the configured threshold of `75%`, causing the alert to fire.

<!-- INTERACTIVE page step4.md END -->
<!-- INTERACTIVE page step5.md START -->

### Add folders and labels

1. In **Folder**, click **+ New folder** and enter a name. For example: `system-metrics` . This folder contains our alert rules.

### Set evaluation behaviour

1. Click + **New evaluation group**. Name it `system-usage`.
1. Choose an **Evaluation interval** (how often the alert will be evaluated). Choose `1m`.
1. Set the **pending period** to `0s` (None), so the alert rule fires the moment the condition is met (this minimizes the waiting time for the demonstration.).
1. Set **Keep firing for** to, `0s`, so the alert stops firing immediately after the condition is no longer true.

### Configure notifications

- Select a **Contact point**. If you don’t have any contact points, add a [Contact point](https://grafana.com/docs/grafana/latest/alerting/configure-notifications/manage-contact-points/#add-a-contact-point).

  For a quick test, you can use a public webhook from [webhook.site](https://webhook.site/) to capture and inspect alert notifications. If you choose this method, select **Webhook** from the drop-down menu in contact points.

### Configure notification message

To link this alert rule to our visualization click [**Link dashboard and panel**](https://grafana.com/docs/grafana/latest/alerting/alerting-rules/link-alert-rules-to-panels/#link-alert-rules-to-panels)

- Select the folder that contains the dashboard. In this case: **system-metrics**
- Select the **cpu-and-memory-metrics** visualization
- Click **confirm**

You have successfully linked this alert rule to your visualization!

When the CPU usage exceeds the defined threshold, an annotation should appear on the graph to mark the event. Similarly, when the alert is resolved, another annotation is added to indicate the moment it returned to normal.

Try adding a second alert rule using the memory usage metric (`flask_app_memory_usage{instance="flask-prod:5000"`}) to see how combining multiple alerts can enhance your dashboard.

Check how your dashboard looks now that your alert has been linked to your dashboard panel.

<!-- INTERACTIVE page step5.md END -->
<!-- INTERACTIVE page step6.md START -->

## Step 3: Visualizing metrics and alert annotations

After the alert rules are linked to visualization, they should appear as **health indicators** (colored heart icons: a red heart when the alert is in **Alerting** state, and a green heart when in **Normal** state) on the linked panel. In addition, annotations provide helpful context, such as the time the alert was triggered.

{{< figure src="/media/docs/alerting/alert-in-panel.png" max-width="1200px" caption="Time series panel displaying health indicators and annotations." >}}

<!-- INTERACTIVE page step6.md END -->
<!-- INTERACTIVE page step7.md START -->

## Step 4: Receiving notifications

Finally, as part of the alerting process, you should receive notifications at the associated contact point. If you're receiving alerts via email, the default email template will include two buttons:

- **View dashboard**: links to the dashboard that contains the alerting panel

- **View panel**: links directly to the individual panel where the alert was triggered

{{< figure src="/media/docs/alerting/email-notification-w-url.png" max-width="1200px" caption="Alert notification with links to panel and dashboard." >}}

Clicking either button opens Grafana with a pre-applied time range relevant to the alert.

By default, this URL includes `from` and `to` query [parameters](https://grafana.com/docs/grafana/latest/alerting/configure-notifications/template-notifications/reference/#alert) that reflect the time window around the alert event (one hour before and after the alert). This helps you land directly in the time window where the alert occurred, making it easier to analyze what happened.

If you want to define a more intentional time range, you can customize your notifications using a [notification template](https://grafana.com/docs/grafana/latest/alerting/configure-notifications/template-notifications/examples/#print-a-link-to-a-dashboard-with-time-range). With a template, you can explicitly set `from` and `to` values for more precise control over what users see when they follow the dashboard link. The final URL is constructed using a custom annotation (e.g., `MyDashboardURL`) along with the `from` and `to` parameters, which are calculated in the notification template.

<!-- INTERACTIVE page step7.md END -->
<!-- INTERACTIVE page finish.md START -->

## Conclusion

You’ve now linked Prometheus-based alert rules to your Grafana visualizations, giving your dashboards real-time context with alert annotations and health indicators. By visualizing alerts alongside metrics, responders can quickly understand what’s happening and when. You also saw how alert notifications can include direct links to the affected dashboard or panel, helping teams jump straight into the right time window for faster troubleshooting.

Have feedback or ideas to improve this tutorial? [Let us know](https://github.com/grafana/tutorials/issues/new).

<!-- INTERACTIVE page finish.md END -->
