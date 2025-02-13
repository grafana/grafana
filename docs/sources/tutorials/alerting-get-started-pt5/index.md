---
Feedback Link: https://github.com/grafana/tutorials/issues/new
categories:
  - alerting
description: Learn how to dynamically route alerts and link them to dashboards  — Part 5.
labels:
  products:
    - enterprise
    - oss
    - cloud
tags:
  - intermediate
title: Get started with Grafana Alerting - Part 5
weight: 60
killercoda:
  title: Get started with Grafana Alerting - Part 5
  description: Learn how to dynamically route alerts and link them to dashboards  — Part 5.
  backend:
    imageid: ubuntu
---

# Get started with Grafana Alerting - Part 5

<!-- INTERACTIVE page intro.md START -->

The Get started with Grafana Alerting tutorial Part 5 is a continuation of [Get started with Grafana Alerting tutorial Part 4](http://www.grafana.com/tutorials/alerting-get-started-pt4/).

In this tutorial, we focus on optimizing your alerting strategy using Grafana for monitoring system health, particularly when working with [Prometheus](https://grafana.com/docs/grafana/latest/datasources/prometheus/). Imagine you are managing a web application or a fleet of servers, tracking critical metrics such as CPU, memory, and disk usage. While monitoring is essential, managing alerts allows your team to act on issues without necessarily feeling overwhelmed by the noise.

In this tutorial you will learn how to:

- Leverage notification policies for **dynamic routing based on query values**: Use notification policies to route alerts based on dynamically generated labels, in a way that critical alerts reach the on-call team and less urgent ones go to a general monitoring channel.
- Set **mute timings** to suppress certain alerts during maintenance or weekends.
- **Link alerts to dashboards** to provide more context to resolve issues.

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

## Use case: Monitoring and alerting for system health with Prometheus and Grafana

In this use case, we focus on monitoring the system's CPU, memory, and disk usage as part of a monitoring setup. This example is based on the [Grafana Prometheus Alerting Demo](https://github.com/tonypowa/grafana-prometheus-alerting-demo), which collects and visualizes system metrics via Prometheus and Grafana.

Your team is responsible for ensuring the health of your servers, and you want to leverage advanced alerting features in Grafana to:

- Set who should receive an alert notification based on query value.
- Suppress alerts based on query value.
- Integrate alert rules into visualizations for better context.

### Scenario

In the provided demo setup, you're monitoring:

- CPU Usage.
- Memory Consumption.

You have a mixture of critical alerts (e.g., CPU usage over `75%`) and warning alerts (e.g., memory usage over `60%`).

At times, you also have scheduled maintenance windows, where you might temporarily suppress certain alerts during planned downtime.

<!-- INTERACTIVE page step2.md END -->
<!-- INTERACTIVE page step3.md START -->

## Create a visualization to monitor metrics

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
     flask_app_cpu_usage{environment="prod"}
     ```

   - Click **Run queries**.

   This query should display the simulated CPU usage data in the **prod** environment.

1. Add memory usage query:

   - Click **+ Add query**.
   - In the query area, paste the following PromQL query:

     ```promql
     flask_app_memory_usage{environment="prod"}
     ```

   {{< figure src="/media/docs/alerting/time-series_cpu_mem_usage_metrics.png" max-width="1200px" caption="Time-series panel displaying CPU and memory usage metrics in production." >}}

   Both metrics return labels that we’ll use later to link alert instances with the appropriate routing. These labels help define how alerts are routed based on their environment or other criteria.

1. Click **Save dashboard**.

   We have our time-series panel ready. Feel free to combine metrics with labels such as `environment = “staging”`.

<!-- INTERACTIVE page step3.md END -->
<!-- INTERACTIVE page step4.md START -->

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

<!-- INTERACTIVE page step4.md END -->
<!-- INTERACTIVE page step5.md START -->

## Create alert rules to monitor CPU and memory usage

Follow these steps to manually create alert rules and link them to a visualization.

## Create an alert rule for CPU usage

1. Navigate to **Alerts & IRM > Alerting > Alert rules** from the Grafana sidebar.
1. Click **+ New alert rule** rule to create a new alert.

### Enter alert rule name

Make it short and descriptive, as this will appear in your alert notification. For instance, `CPU usage` .

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

1. In **Folder**, click _+ New folder_ and enter a name. For example: `App metrics` . This folder contains our alerts.
1. Click **+ Add labels**.
1. **Key** field: `environment` .
1. In the **value** field copy in the following template:

   ```go
   {{- if eq $labels.environment "prod" -}}
   production
   {{- else if eq $labels.environment "staging" -}}
   staging
   {{- else -}}
   development
   {{- end -}}
   ```

   In this context, the template is used to route alert notifications based on the `environment` label. When a metric like CPU usage exceeds a threshold, the template checks the environment (e.g., `prod`, `staging`, or any other value). It then generates a label based on query value (e.g., _production_, _staging_, or _development_). This label is used in the alert notification policy to route alerts to the appropriate team, so that notifications are directed to the right group, making the process more efficient and avoiding unnecessary overlap.

### Set evaluation behaviour

1. Click + **New evaluation group**. Name it `System usage`.
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
1. Query: `flask_app_memory_usage{}`
1. Link to the same visualization to obtain memory usage annotations whenever the alert rule triggers or resolves.

Now that the CPU and memory alert rules are set up, they are linked to the notification policies through the custom label matcher we added. The value of the label dynamically changes based on the environment template, using `$labels.environment`. This ensures that the label value will be set to production, staging, or development, depending on the environment.

<!-- INTERACTIVE page step5.md END -->
<!-- INTERACTIVE page step6.md START -->

## Visualizing metrics and alert annotations

Check how your dashboard looks now that both alerts have been linked to your dashboard panel.

{{< figure src="/media/docs/alerting/time-series_cpu_with_alert.png" max-width="1200px" caption="Time series panel displaying health indicators and annotations." >}}

After the alert rules are created, they should appear as **health indicators** (colored heart icons: red heart when the alert is in **Alerting** state, and green heart when in **Normal** state.) on the linked panel. In addition, the annotations include helpful context, such as the time the alert was triggered.

<!-- INTERACTIVE page step6.md END -->
<!-- INTERACTIVE page step7.md START -->

## Create mute timings

Now that we've set up notification policies, we can demonstrate how to mute alerts for recurring periods of time. You can mute notifications for either the production or staging policies, depending on your needs.

Mute timings are useful for suppressing alerts with certain labels during maintenance windows or weekends.

1. Navigate to **Alerts & IRM > Alerting > Notification Policies**.
   - Enter a name, e.g. `Planned downtime` or `Non-business hours`.
   - Select **Sat** and **Sun**, to apply the mute timing to all Saturdays and Sundays.
   - Click **Save mute timing**.
1. Add mute timing to the desired policy:
   - Go to the notification policy that routes instances with the `staging` label.
   - Select **More > Edit**.
   - Choose the mute timing from the drop-down menu
   - Click **Update policy**.

This mute timing will apply to any alerts from the staging environment that trigger on Saturdays and Sundays.

<!-- INTERACTIVE page step7.md END -->
<!-- INTERACTIVE page finish.md START -->

## Conclusion

By using notification policies, you can route alerts based on query values, directing them to the appropriate teams. Integrating alerts into dashboards provides more context, and mute timings allow you to suppress alerts during maintenance or low-priority periods.

## Learn more

Explore related topics covered in this tutorial:

- Understand how alert routing works in [Get started with Grafana Alerting - Part 2](http://www.grafana.com/tutorials/alerting-get-started-pt2/).
- Learn how templating works in [Get started with Grafana Alerting - Part 4](http://www.grafana.com/tutorials/alerting-get-started-pt4/).
  - More [examples on templating labels](https://grafana.com/docs/grafana/latest/alerting/alerting-rules/templates/examples/).

<!-- INTERACTIVE page finish.md END -->
