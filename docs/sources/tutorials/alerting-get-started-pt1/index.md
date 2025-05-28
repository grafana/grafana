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
  - intermediate
title: Get started with Grafana Alerting - Link alerts to visualizations
weight: 61
killercoda:
  title: Get started with Grafana Alerting - Link alerts to visualizations
  description: Create alerts using Prometheus data and link them to your visualizations.
  backend:
    imageid: ubuntu
---

<!-- INTERACTIVE page intro.md START -->

The Get started with Grafana Alerting - Dynamic routing tutorial is a continuation of the [Get started with Grafana Alerting - Create and receive your first alert](http://www.grafana.com/tutorials/alerting-get-started/) tutorial.

<!-- USE CASE -->

In this tutorial you will learn how to:

- link alerts to time-series panel
- monitor alert activity from alert list viz

<!-- INTERACTIVE page intro.md END -->
<!-- INTERACTIVE page step1.md START -->

<!-- INTERACTIVE ignore START -->

## Before you begin

- **Interactive learning environment**

  - Alternatively, you can [try out this example in our interactive learning environment](https://killercoda.com/grafana-labs/course/grafana/alerting-get-started-pt1/). It’s a fully configured environment with all the dependencies already installed.

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

In this use case, we focus on monitoring the system's CPU, memory, and disk usage as part of a monitoring setup. This example is based on the [Grafana Prometheus Alerting Demo](https://github.com/tonypowa/grafana-prometheus-alerting-demo), which collects and visualizes system metrics via Prometheus and Grafana.

Your team is responsible for ensuring the health of your servers, and you want to leverage advanced alerting features in Grafana to:

- Set who should receive an alert notification based on query value.
- Suppress alerts based on query value.

### Scenario

In the provided demo setup, you're monitoring:

- CPU Usage.
- Memory Consumption.

You have a mixture of critical alerts (e.g., CPU usage over `75%`) and warning alerts (e.g., memory usage over `60%`).

This Flask-based Python script simulates a service that:

- Generates random CPU and memory usage values (10% to 100%) every **10 seconds**
- Exposes them as Prometheus metrics
- Each metric includes a default instance label based on the scrape target:
  - `instance="flask-prod:5000"`
  - `instance="flask-staging:5000"`
- A custom deployment label added explicitly in the app logic (this serves as an additional example for dynamically routing production instances):
  - `deployment="prod-us-cs30"`
  - `deployment="staging-us-cs20"`

### Objective

<!-- INTERACTIVE page step2.md END -->
<!-- INTERACTIVE page step3.md START -->

## Step 1: Create a visualization to monitor metrics

To keep track of these metrics and understand system behavior across different environments, you can set up a visualization for CPU usage and memory consumption. This will make it easier to see how the system is performing and how alerts are distributed based on the environment label, including during scheduled maintenance windows.

The time-series visualization supports alert rules to provide more context in the form of annotations and alert rule state. Follow these steps to create a visualization to monitor the application’s metrics.

1. Log in to Grafana:

   - Navigate to [http://localhost:3000](http://localhost:3000), where Grafana should be running.
   - Username and password: `admin`

1. Create a time series panel:

   - Navigate to **Dashboards**.
   - Click **New**.
   - Select **New Dashboard**.
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

   This query should display the simulated CPU usage data in the **prod** environment.

1. Add memory usage query:

   - Click **+ Add query**.
   - In the query area, paste the following PromQL query:

     ```promql
     flask_app_memory_usage{flask-prod:5000}
     ```

   {{< figure src="/media/docs/alerting/time-series_cpu_mem_usage_metrics.png" max-width="1200px" caption="Time-series panel displaying CPU and memory usage metrics in production." >}}

   1. Click **Save dashboard**. Name it: `cpu-and-memory-metrics`.

   We have our time-series panel ready. Feel free to combine metrics with labels such as `instance = “flask-staging:5000”`, or other labels like `deployment="prod-us-cs30"`.

<!-- INTERACTIVE page step3.md END -->
<!-- INTERACTIVE page step4.md START -->

## Step 2: Create alert rules to monitor CPU and memory usage

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
1. Set the **pending period** to `0s` (zero seconds), so the alert rule fires the moment the condition is met (this minimizes the waiting time for the demonstration.).
1. Set **Keep firing for** to, `0s`, so the alert stops firing immediately after the condition is no longer true.

### Configure notifications

- Select a **Contact point**. If you don’t have any contact points, add a [Contact point](https://grafana.com/docs/grafana/latest/alerting/configure-notifications/manage-contact-points/#add-a-contact-point).

   For a quick test, you can use a public webhook from [webhook.site](https://webhook.site/) to capture and inspect alert notifications. If you choose this method, select **Webhook** from the drop-down menu in contact points.

### Configure notification message

To link this alert rule to our visualization click **Link dashboard and panel**

- Click **system-metrics**
- Select the **cpu-and-memory-metrics** panel
- Click **confirm**

You have successfully linked this alert rule to your visualization! 

When the CPU usage exceeds the defined threshold, an annotation will appear on the graph to mark the event. Similarly, when the alert is resolved, another annotation will be added to indicate the moment it returned to normal.

<!-- INTERACTIVE page step5.md END -->
<!-- INTERACTIVE page step6.md START -->

## Step 3: Create a second alert rule for memory usage

1. Duplicate the existing alert rule (**More > Duplicate**), or create a new alert rule for memory usage, defining a threshold condition (e.g., memory usage exceeding `60%`).
1. Give it a name. For example: `memory-usage`
1. Query: `flask_app_memory_usage{instance="flask-prod:5000"}`
1. Link to the same visualization to obtain memory usage annotations whenever the alert rule triggers or resolves.

Check how your dashboard looks now that both alerts have been linked to your dashboard panel.

<!-- INTERACTIVE page step6.md END -->
<!-- INTERACTIVE page step7.md START -->

## Visualizing metrics and alert annotations

{{< figure src="/media/docs/alerting/panel-2-queries-and-alerts.png" max-width="1200px" caption="Time series panel displaying health indicators and annotations." >}}

After the alert rules are created, they should appear as **health indicators** (colored heart icons: red heart when the alert is in **Alerting** state, and green heart when in **Normal** state.) on the linked panel. In addition, the annotations include helpful context, such as the time the alert was triggered.

Finally, you should also receive notifications at the contact point associated.

<!-- INTERACTIVE page step7.md END -->
<!-- INTERACTIVE page finish.md START -->

## Learn more in [Grafana Alerting: Multi-dimensional alerts and how to route them](http://www.grafana.com/tutorials/alerting-get-started-pt2/)

<!-- INTERACTIVE ignore START -->

{{< admonition type="tip" >}}

In [Get started with Grafana Alerting: Multi-dimensional alerts and how to route them](http://www.grafana.com/tutorials/alerting-get-started-pt2/) you can advance your skills by exploring alert instances and notification routing.

{{< /admonition >}}

<!-- INTERACTIVE ignore END -->

{{< docs/ignore >}}

In [Get started with Grafana Alerting: Multi-dimensional alerts and how to route them](http://www.grafana.com/tutorials/alerting-get-started-pt2/) you can advance your skills by exploring alert instances and notification routing.

{{< /docs/ignore >}}

<!-- INTERACTIVE page finish.md END -->