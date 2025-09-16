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
title: Get started with Grafana Alerting - Route alerts using dynamic labels
weight: 66
killercoda:
  title: Get started with Grafana Alerting - Route alerts using dynamic labels
  description: Learn how to dynamically route alert notifications.
  backend:
    imageid: ubuntu
---

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

- Generates random CPU and memory usage values (10% to 100%) every **10 seconds**
- Exposes them as Prometheus metrics
- Each metric includes a default instance label based on the scrape target:
  - `instance="flask-prod:5000"`
  - `instance="flask-staging:5000"`
- A custom deployment label added explicitly in the app logic (this serves as an additional example for dynamically routing production instances):
  - `deployment="prod-us-cs30"`
  - `deployment="staging-us-cs20"`

### Objective

Use templates to dynamically populate a custom label that matches a notification policy, and therefore routes alerts to the correct contact point.

We'll automatically determine the environment associated with each firing alert by inspecting system metrics (e.g., CPU, memory) and extracting keywords using regular expressions with the Go templating language.

<!-- INTERACTIVE page step2.md END -->

<!-- INTERACTIVE page step3.md START -->

## Step 1: Create Notification Policies

Notification policies route alert instances to contact points via label matchers. Since we know what labels our application returns (e.g., `job`, `instance`, `deployment`), we can use them to match alert rules and define appropriate notification routing.

Although our application doesn't explicitly include an `environment` label, we can rely on other labels like `instance` or `deployment`, which may contain keywords (like prod or staging) that indicate the environment.

1. Sign in to Grafana:
   - **Grafana Cloud** users: Log in via Grafana Cloud.
   - **OSS users**: Go to [http://localhost:3000](http://localhost:3000).

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
   flask_app_cpu_usage{}
   ```

1. **Alert condition** section:
   - Enter `75` as the value for **WHEN QUERY IS ABOVE** to set the threshold for the alert.
   - Click **Preview alert rule condition** to run the queries.

   {{< figure src="/media/docs/alerting/flask-app-metrics.png" max-width="1200px" caption="Preview of a query returning alert instances in Grafana." >}}

   Among the labels returned for `flask_app_cpu_usage`, the labels `instance` and `deployment` contain values that include the term _prod_ and _staging_. We will create a template later to detect these keywords, so that any firing alert instances are routed to the relevant contact points (e.g., alerts-prod, alerts-staging).

### Add folders and labels

In this section we add a [templated label based on query value](https://grafana.com/docs/grafana/latest/alerting/alerting-rules/templates/examples/#based-on-query-value) to map to the notification policies.

<!-- INTERACTIVE page step4.md END -->
<!-- INTERACTIVE page step5.md START -->

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

   This template uses a regular expression to extract `prod`, `staging`, or `dev` from the instance label (`$labels.instance`) and maps it to a more readable label (like "production" for "prod").

As result, when alerts exceed a threshold, the template checks the labels, such as `instance="flask-prod:5000"`, `instance="flask-staging:5000"`, or custom labels like `deployment="prod-us-cs30"`, and assigns a value of production, staging or development to the custom environment **environment** label.

This label is then used by the alert notification policy to route alerts to the appropriate team, so that notifications are delivered efficiently, and reducing unnecessary noise.

### Set evaluation behaviour

1. Click + **New evaluation group**. Name it `system-usage`.
1. Choose an **Evaluation interval** (how often the alert will be evaluated). Choose `1m`.
1. Set the **pending period** to `0s` (zero seconds), so the alert rule fires the moment the condition is met (this minimizes the waiting time for the demonstration.).
1. Set **Keep firing for** to, `0s`, so the alert stops firing immediately after the condition is no longer true.

### Configure notifications

Select who should receive a notification when an alert rule fires.

1. Toggle the **Advance options** button.
1. Click **Preview routing**.
   The preview should display which firing alerts are routed to contact points based on notification policies that match the `environment` label.

   {{< figure src="/media/docs/alerting/dynamic-routing-preview-prod-staging.png" max-width="1200px" caption="Notification policies matched by the environment label matcher." >}}

   The environment label matcher should map to the notification policies created earlier. This makes sure that firing alert instances are routed to the appropriate contact points associated with each policy.

## Step 3: Create a second alert rule for memory usage

1. Duplicate the existing alert rule (**More > Duplicate**), or create a new alert rule for memory usage, defining a threshold condition (e.g., memory usage exceeding `60%`).
1. Give it a name. For example: `memory-usage`
1. Query: `flask_app_memory_usage{}`
1. Link to the same visualization to obtain memory usage annotations whenever the alert rule triggers or resolves.

Now that the CPU and memory alert rules are set up, they are linked to the notification policies through the custom label matcher we added. The value of the label dynamically changes based on the environment template, using `$labels.instance`. This ensures that the label value will be set to production, staging, or development, depending on the environment.

<!-- INTERACTIVE page step5.md END -->
<!-- INTERACTIVE page step6.md START -->

## Done! Your alerts are now dynamically routed

Based on your query's `instance` label values (which contain keywords like _prod_ or _staging_ ), Grafana dynamically assigns the value `production`, `staging` or `development` to the custom **environment** label using the template. This dynamic label then matches the label matchers in your notification policies, which route alerts to the correct contact points.

To see this in action go to **Alerts & IRM > Alerting > Active notifications**

This page shows grouped alerts that are currently triggering notifications. If you click on any alert group to view its label set, contact point, and number of alert instances. Notice that the **environment** label has been dynamically populated with values like `production`.

{{< figure src="/media/docs/alerting/routing-active-notification-detail.png" max-width="1200px" caption="Expanded alert in Active notifications section" >}}

Finally, you should receive notifications at the contact point associated with either `prod` or `staging`.

Feel free to experiment by changing the template to match other labels that contain any of the watched keywords. For example, you could reference:

```go
$labels.deployment
```

The template should be flexible enough to capture the target keywords (e.g., prod, staging) by adjusting which label the[`$labels`](https://grafana.com/docs/grafana/latest/alerting/alerting-rules/templates/reference/#labels) is referencing.

<!-- INTERACTIVE page step6.md END -->

<!-- INTERACTIVE page finish.md START -->

## Conclusion

By using notification policies, you can route alerts based on query values, directing them to the appropriate teams.

## Learn more in [Grafana Alerting - Link alerts to visualizations](http://www.grafana.com/tutorials/alerting-get-started-pt6/)

<!-- INTERACTIVE ignore START -->

{{< admonition type="tip" >}}

In [Grafana Alerting - Link alerts to visualizations](http://www.grafana.com/tutorials/alerting-get-started-pt6/) you will create alerts using Prometheus data and link them to your graphs.

{{< /admonition >}}

<!-- INTERACTIVE ignore END -->

{{< docs/ignore >}}

In [Grafana Alerting - Link alerts to visualizations](http://www.grafana.com/tutorials/alerting-get-started-pt6/) you will create alerts using Prometheus data and link them to your graphs.

{{< /docs/ignore >}}

Explore related topics covered in this tutorial:

- Understand how alert routing works in [Get started with Grafana Alerting - Alert routing](http://www.grafana.com/tutorials/alerting-get-started-pt2/).
- Learn how templating works in [Get started with Grafana Alerting - Templating](http://www.grafana.com/tutorials/alerting-get-started-pt4/).
  - More [examples on templating labels](https://grafana.com/docs/grafana/latest/alerting/alerting-rules/templates/examples/).

<!-- INTERACTIVE page finish.md END -->
