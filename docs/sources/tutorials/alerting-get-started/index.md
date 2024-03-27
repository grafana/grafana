---
Feedback Link: https://github.com/grafana/tutorials/issues/new
authors:
  - Antonio Calero
categories:
  - alerting
description: Get started with Grafana Alerting by creating your first alert in just a few minutes. Learn how to set up an alert, send alert notifications to a public webhook, and generate sample data to observe your alert in action.
id: alerting-get-started
labels:
  products:
    - enterprise
    - oss
    - cloud
tags:
  - beginner
title: Get started with Grafana Alerting
weight: 50
---

# Get Started with Grafana Alerting

In this guide, we'll walk you through the process of setting up your first alert in just a few minutes. You'll witness your alert in action with real-time data, as well as sending alert notifications.

In this tutorial you will:

- Set up an Alert
- Send an alert notification to a public webhook.

## Before you begin

Ensure you have the following applications installed.

- [Docker Compose](https://docs.docker.com/get-docker/) (included in Docker for Desktop for macOS and Windows)
- [Git](https://git-scm.com/)

## Set up a sample application

The sample application generates real data and exposes metrics, which are stored in Prometheus. In Grafana Alerting, you can then build an alert rule based on the data generated.

Download the files to your local machine.

1. Clone the [tutorial environment repository](https://github.com/grafana/tutorial-environment).

   ```promql
   git clone https://github.com/grafana/tutorial-environment.git
   ```

1. Change to the directory where you cloned the repository:

   ```promql
   cd tutorial-environment
   ```

1. Make sure Docker is running:

   ```promql
   docker --version
   ```

   This command will display the installed Docker version if the installation was successful.

1. Start the sample application:

   ```promql
   docker compose up -d
   ```

   The first time you run `docker compose up -d`, Docker downloads all the necessary resources for the tutorial. This might take a few minutes, depending on your internet connection.

   {{< admonition type="note" >}}
   If you already have Grafana, Loki, or Prometheus running on your system, you might see errors, because the Docker image is trying to use ports that your local installations are already using. . If this is the case, stop the services, then run the command again.
   {{< /admonition >}}

1. Ensure all services are up-and-running:

   ```promql
   docker compose ps
   ```

   In the State column, it should say Up for all services.

The Grafana News app should be live on [localhost:8081](http://localhost:8081/).

### Generate data

To enhance the hands-on aspect of this tutorial, you can actively participate in the Grafana News application to simulate web traffic and interactions. This enables you to observe data within Grafana and set up alerts accordingly.

### Grafana News

Grafana News is an application created to demonstrate the observation of data using the Grafana stack. It achieves this by generating web traffic through activities such as posting links and voting for your preferred ones.

To add a link:

1. Enter a **Title**
1. Enter a **URL**
1. Click **Submit** to add the link.
   The link will appear listed under the Grafana News heading.
1. To vote for a link, click the triangle icon next to the name of the link.

## Create a contact point for Grafana Managed Alerts

Besides being an open-source observability tool, Grafana has its own built-in alerting service. This means that you can receive notifications whenever there is an event of interest in your data, and even see these events graphed in your visualizations.

In this step, we'll set up a new contact point. This contact point will use the _webhooks_ channel. In order to make this work, we also need an endpoint for our webhook channel to receive the alert. We will use [requestbin.com](https://requestbin.com) to quickly set up that test endpoint. This way we can make sure that our alert is actually sending a notification somewhere.

1. In your browser, navigate to [localhost:3000](http://localhost:3000), where Grafana is running.
   You should get logged in automatically.
1. In another window, go to [requestbin.com](https://requestbin.com).
1. Under the **Create Request Bin** button, click the link to create a **public bin** instead.
1. From Request Bin, copy the endpoint URL.

Your Request Bin is now waiting for the first request.

Next, let's configure a Contact Point in Grafana's Alerting UI to send notifications to our Request Bin.

1. Return to Grafana. In Grafana's sidebar, hover over the **Alerting** (bell) icon and then click **Contact points**.
1. Click **+ Add contact point**.
1. In **Name**, write **RequestBin**.
1. In **Integration**, choose **Webhook**.
1. In **URL**, paste the endpoint to your request bin.

1. Click **Test**, and then click **Send test notification** to send a test alert to your request bin.
1. Navigate back to the Request Bin you created earlier. On the left side, there's now a `POST /` entry. Click it to see what information Grafana sent.
1. Return to Grafana and click **Save contact point**.

We have now created a dummy webhook endpoint and created a new Alerting Contact Point in Grafana. Now we can create an alert rule and link it to this new channel.

## Create an alert

Next, we'll establish an alert within Grafana Alerting to notify us whenever our sample app experiences a specific volume of requests.

In Grafana, **navigate to Alerting** > **Alert rules**. Click on **New alert rule**.

1. Enter alert rule name
   Make it short and descriptive as this will appear in your alert notification. For instance, **server-requests-duration**

## Define query and alert condition

In this section, we define queries, expressions (used to manipulate the data), and the condition that must be met for the alert to be triggered.

1. Select the **Prometheus** data source from the drop-down menu.

   {{< admonition type="note" >}}
   To visualize this data in Grafana, we need time-series metrics that we can collect and store. We can do that with [Prometheus](https://grafana.com/docs/grafana/latest/getting-started/get-started-grafana-prometheus/), which pulls metrics from our sample app.
   {{< /admonition >}}

1. In the Query editor, switch to **Code** mode by clicking the button at the right.
1. Enter the following query:

   ```promql
   sum(rate(tns_request_duration_seconds_count[1m])) by(method)
   ```

   This [PromQL](https://prometheus.io/docs/prometheus/latest/querying/basics/) query calculates the sum of the per-second average rates of increase of the `tns_request_duration_seconds_count` metric over the last 1 minute, grouped by the HTTP method used in the requests. This can be useful for analyzing the request duration trends for different HTTP methods.

1. Keep expressions “B” and “C” as they are. These expressions (**Reduce** and **Threshold**, respectively) come by default when creating a new rule.

   The Reduce expression “B”, selects the last value of our query “A”, while the Threshold expression “C” will check if the last value from expression “B” is above a specific value. In addition, the Threshold expression is the alert condition by default. Enter `0.2` as threshold value. You can read more about queries and conditions [here](https://grafana.com/docs/grafana/latest/alerting/fundamentals/alert-rules/queries-conditions/#expression-queries).

1. Click Preview to run the queries.

   You should see the request duration for different HTTP methods.

   {{<admonition type="note">}}
   If it returns “No data,” or an error, you are welcome to post questions in our [Grafana Community forum](https://community.grafana.com/).
   {{</admonition>}}

## Set evaluation behavior

An evaluation group defines an evaluation interval - how often a rule is checked. Alert rules within the same evaluation group are evaluated sequentially

1. In **Folder**, click **+ New folder** and enter a name. For example: _grafana-news_. This folder will contain our alerts.
1. In the **Evaluation group**, repeat the above step to create a new evaluation group. We will name it _1m-evaluation_.
1. Choose an **Evaluation interval** (how often the alert will be evaluated).
   For example, every `1m` (1 minute).
1. Set the **pending period** (the “for” period).
   This is the time that a condition has to be met until the alert enters into **Firing** state and a notification is sent. For example, `0s` (zero seconds) so the alert rule fires the moment the condition is met.

## Configure labels and notifications

Add labels to ease searching or route notifications to a policy.

1. Add a label.
   Add `app` as the label key, and `grafana-news` as the value.

1. Add a notification recipient.
   Under **Contact point**, select **RequestBin** from the drop-down menu.

1. Add an annotation (optional).

   To provide more context on the alert, you can link a dashboard and panel to our Alert. To do this, click **Link Dashboard and panel** button.

   Linking an alert rule to a panel adds an annotation to the panel when the status of your alert rulechanges. If you don’t have a panel already, and since this is optional, you can skip this step for now and link it after you have finished configuring the alert rule.

1. Click **Save rule and exit** at the top right corner.

## Trigger an alert

We have now configured an alert rule and a contact point. Now let’s see if we can trigger an alert by generating some traffic on our sample application.

1. Browse to [localhost:8081](http://localhost:8081/).
1. Add a new title and URL.
1. Repeatedly click the vote button or refresh the page to generate a traffic spike.

Once the query `sum(rate(tns_request_duration_seconds_count[1m])) by(method)` returns a value greater than `0.2`, Grafana will trigger our alert. Browse to the Request Bin we created earlier and find the sent Grafana alert notification with details and metadata.

## Summary

In this tutorial, you have learned how to set up an alert, send alert notifications to a public webhook, and generate some sample data to observe your alert in action. By following these steps, you've gained a foundational understanding of how to leverage Grafana's alerting capabilities to monitor and respond to events of interest in your data. Happy monitoring!

## Learn more

Check out the links below to continue your learning journey with Grafana's LGTM stack.

- [Prometheus][prometheus]
- [Alerting Overview][alerting-overview]
- [Alert rules][alert-rules]
- [Contact points][contact-points]

{{% docs/reference %}}
[prometheus]: "/docs/grafana/ -> /docs/grafana/<GRAFANA_VERSION>/features/datasources/prometheus/"
[prometheus]: "/docs/grafana-cloud/ -> /docs/grafana-cloud/connect-externally-hosted/data-sources/prometheus/"

[alerting-overview]: "/docs/grafana/ -> /docs/grafana/<GRAFANA_VERSION>/alerting/"
[alerting-overview]: "/docs/grafana-cloud/ -> /docs/grafana-cloud/alerting-and-irm/alerting/"

[alert-rules]: "/docs/grafana/ -> /docs/grafana/<GRAFANA_VERSION>/alerting/create-alerts/"
[alert-rules]: "/docs/grafana-cloud/ -> /docs/grafana-cloud/alerting-and-irm/alerting/alerting-rules/"

[contact-points]: "/docs/grafana/ -> /docs/grafana/<GRAFANA_VERSION>/alerting/fundamentals/contact-points/"
[contact-points]: "/docs/grafana-cloud/ -> /docs/grafana-cloud/alerting-and-irm/alerting/fundamentals/notifications/contact-points/"
{{% /docs/reference %}}