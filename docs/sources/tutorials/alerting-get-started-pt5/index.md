---
Feedback Link: https://github.com/grafana/tutorials/issues/new
categories:
  - alerting
description: Learn how to dynamically route alert notifications.
labels:
  products:
    - enterprise
    - oss
    - cloud
tags:
  - intermediate
title: Get started with Grafana Alerting - Dynamic routing
weight: 60
killercoda:
  title: Get started with Grafana Alerting - Dynamic routing
  description: Learn how to dynamically route alert notifications.
  backend:
    imageid: ubuntu
---

# Get started with Grafana Alerting - Dynamic routing

<!-- INTERACTIVE page intro.md START -->

The Get started with Grafana Alerting - Dynamic routing tutorial is a continuation of the [Get started with Grafana Alerting - Templating](http://www.grafana.com/tutorials/alerting-get-started-pt4/) tutorial.

Imagine you are managing a web application or a fleet of servers, tracking critical metrics such as CPU, memory, and disk usage. While monitoring is essential, managing alerts allows your team to act on issues without necessarily feeling overwhelmed by the noise.

In this tutorial you will learn how to:

- Leverage notification policies for **dynamic routing based on query values**: Use notification policies to route alerts based on dynamically generated labels, in a way that critical alerts reach the on-call team and less urgent ones go to a general monitoring channel.

<!-- INTERACTIVE page intro.md END -->
<!-- INTERACTIVE page step1.md START -->

<!-- INTERACTIVE ignore START -->

## Before you begin

- **Interactive learning environment**

  - Alternatively, you can [try out this example in our interactive learning environment](https://killercoda.com/grafana-labs/course/grafana/alerting-get-started-pt5/). It’s a fully configured environment with all the dependencies already installed.

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
- Generates random CPU and memory usage values every **10 seconds**
- Exposes them as Prometheus metrics
- Each metric includes a default instance label (e.g., flask-prod:5000, based on the scrape target)

<!-- INTERACTIVE page step2.md END -->

<!-- INTERACTIVE page step3.md START -->

## Create Notification Policies

Notification policies route alert instances to contact points via label matchers. Since we know what labels our application returns (i.e., `environment`, `job`, `instance`), we can use these labels to match alert rules.

1. Navigate to **Alerts & IRM > Alerting > Notification Policies**.

1. Add a child policy:

   - In the **Default policy**, click **+ New child policy**.
   - **Label**: `environment`.
   - **Operator**: `=`.
   - **Value**: `production`.
   - This label matches alert rules where the environment label is `prod`.

1. Choose a **contact point**:

   - If you don’t have any contact points, add a [Contact point](https://grafana.com/docs/grafana/latest/alerting/configure-notifications/manage-contact-points/#add-a-contact-point).

   For a quick test, you can use a public webhook from [webhook.site](https://webhook.site/) to capture and inspect alert notifications. If you choose this method, select **Webhook** from the drop-down menu in contact points.

1. Enable continue matching:

   - Turn on **Continue matching subsequent sibling nodes** so the evaluation continues even after one or more labels (i.e., _environment_ labels) match.

1. Save and repeat

   - Create another child policy by following the same steps.
   - Use `environment = staging` as the label/value pair.
   - Feel free to use a different contact point.

Now that the labels are defined, we can create alert rules for CPU and memory metrics. These alert rules will use the labels from the collected and stored metrics in Prometheus.

<!-- INTERACTIVE page step3.md END -->
<!-- INTERACTIVE page step4.md START -->

## Create alert rules to monitor CPU and memory usage

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
   flask_app_cpu_usage{}
   ```

1. **Alert condition** section:

   - Enter 75 as the value for **WHEN QUERY IS ABOVE** to set the threshold for the alert.
   - Click **Preview alert rule condition** to run the queries.

   {{< figure src="/media/docs/alerting/promql-returning-metrics.png" max-width="1200px" caption="Preview of a query returning alert instances in Grafana." >}}

   Among the labels returned for `flask_app_cpu_usage`, the environment label is particularly important, as it enables dynamic alert routing based on the environment value, ensuring the right team receives the relevant notifications.

### Add folders and labels

In this section we add a [templated label based on query value](https://grafana.com/docs/grafana/latest/alerting/alerting-rules/templates/examples/#based-on-query-value) to map to the notification policies.

1. In **Folder**, click _+ New folder_ and enter a name. For example: `app-metrics` . This folder contains our alerts.
1. Click **+ Add labels**.
1. **Key** field: `environment` .
1. In the **value** field copy in the following template:

   ```go
   {{- $env := reReplaceAll ".*([pP]rod|[sS]taging|[dD]ev).*" "${1}" $labels.instance -}}
   {{- if eq $env "prod" -}}
   production
   {{- else if eq $env "staging" -}}
   staging
   {{- else -}}
   development
   {{- end -}}
   ```
   This template uses regex to extract `prod`, `staging`, or `dev` from the instance label and maps it to a more readable label (like "production" for "prod").

  The template routes alert notifications based on the `instance` label. When a metric like CPU usage exceeds a threshold, the template checks the environment (e.g., `flask-prod:5000`, `flask-staging:5000`, or any other value). It then generates a label based on query value (e.g., _production_, _staging_, or _development_). This label is used in the alert notification policy to route alerts to the appropriate team, so that notifications are directed to the right group, making the process more efficient and avoiding unnecessary overlap.

### Set evaluation behaviour

1. Click + **New evaluation group**. Name it `system-usage`.
1. Choose an **Evaluation interval** (how often the alert will be evaluated). Choose `1m`. Click Create.
1. Set the **pending period** to `0s` (zero seconds), so the alert rule fires the moment the condition is met (this minimizes the waiting time for the demonstration.).

### Configure notifications

Select who should receive a notification when an alert rule fires.

1. Toggle the **Advance options** button.
1. Click **Preview routing**.
   The preview should display which firing alerts are routed to contact points based on notification policies that match the `environment` label.

   {{< figure src="/media/docs/alerting/routing-preview-cpu-metrics.png" max-width="1200px" caption="Notification policies matched by the environment label matcher." >}}

   The environment label matcher should map to the notification policies created earlier. This makes sure that firing alert instances are routed to the appropriate contact points associated with each policy.

### Configure notification message

Link your dashboard panel to this alert rule to display alert annotations in your visualization whenever the alert rule triggers or resolves.

1. Click **Link dashboard and panel**.
1. Find the panel that you created earlier.
1. Click **Confirm**.

## Create a second alert rule for memory usage

1. Duplicate the existing alert rule (**More > Duplicate**), or create a new alert rule for memory usage, defining a threshold condition (e.g., memory usage exceeding `60%`).
1. Give it a name. For example: `memory-usage`
1. Query: `flask_app_memory_usage{}`
1. Link to the same visualization to obtain memory usage annotations whenever the alert rule triggers or resolves.

Now that the CPU and memory alert rules are set up, they are linked to the notification policies through the custom label matcher we added. The value of the label dynamically changes based on the environment template, using `$labels.environment`. This ensures that the label value will be set to production, staging, or development, depending on the environment.

<!-- INTERACTIVE page step4.md END -->

<!-- INTERACTIVE page step5.md START -->

## Your alerts are now dynamically routed

Based on your query's instance label values (which contain keywords like _prod_ or _staging_ ), Grafana dynamically assigns simplified values like `prod` or `staging` to our custom environment label using the template.

To see this in action go to **Alerts & IRM > Alerting > Active notifications**

{{< figure src="/media/docs/alerting/routing-active-notifications.png" max-width="1200px" caption="Alerts with active notifications" >}}

This page shows grouped alerts that are currently triggering notifications.

Click on any alert group to view its label set, contact point, and number of alert instances.
You’ll notice that the environment label has been dynamically populated with values like `production`.

{{< figure src="/media/docs/alerting/routing-active-notification-detail.png" max-width="1200px" caption="Expanded alert in Active notifications section" >}}



<!-- INTERACTIVE page step5.md END -->


<!-- INTERACTIVE page finish.md START -->

## Conclusion

By using notification policies, you can route alerts based on query values, directing them to the appropriate teams. Integrating alerts into dashboards provides more context, and mute timings allow you to suppress alerts during maintenance or low-priority periods.

## Learn more

Explore related topics covered in this tutorial:

- Understand how alert routing works in [Get started with Grafana Alerting - Alert routing](http://www.grafana.com/tutorials/alerting-get-started-pt2/).
- Learn how templating works in [Get started with Grafana Alerting - Templating](http://www.grafana.com/tutorials/alerting-get-started-pt4/).
  - More [examples on templating labels](https://grafana.com/docs/grafana/latest/alerting/alerting-rules/templates/examples/).

<!-- INTERACTIVE page finish.md END -->
