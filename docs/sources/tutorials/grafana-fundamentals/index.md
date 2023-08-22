---
Feedback Link: https://github.com/grafana/tutorials/issues/new
authors:
  - grafana_labs
categories:
  - fundamentals
description: Get familiar with Grafana
id: grafana-fundamentals
labels:
  products:
    - enterprise
    - oss
status: Published
summary: Get familiar with Grafana
tags:
  - beginner
title: Grafana fundamentals
weight: 10
---

## Introduction

In this tutorial, you'll learn how to use Grafana to set up a monitoring solution for your application.

In this tutorial, you'll:

- Explore metrics and logs
- Build dashboards
- Annotate dashboards
- Set up alerts

{{% class "prerequisite-section" %}}

### Prerequisites

- [Docker](https://docs.docker.com/install/)
- [Docker Compose](https://docs.docker.com/compose/) (included in Docker for Desktop for macOS and Windows)
- [Git](https://git-scm.com/)
  {{% /class %}}

## Set up the sample application

This tutorial uses a sample application to demonstrate some of the features in Grafana. To complete the exercises in this tutorial, you need to download the files to your local machine.

In this step, you'll set up the sample application, as well as supporting services, such as [Prometheus](https://prometheus.io/) and [Loki](/oss/loki/).

1. Clone the [github.com/grafana/tutorial-environment](https://github.com/grafana/tutorial-environment) repository.

   ```
   git clone https://github.com/grafana/tutorial-environment.git
   ```

1. Change to the directory where you cloned this repository:

   ```
   cd tutorial-environment
   ```

1. Make sure Docker is running:

   ```
   docker ps
   ```

   No errors means it is running. If you get an error, then start Docker and then run the command again.

1. Start the sample application:

   ```
   docker-compose up -d
   ```

   The first time you run `docker-compose up -d`, Docker downloads all the necessary resources for the tutorial. This might take a few minutes, depending on your internet connection.

   > **Note:** If you already have Grafana, Loki, or Prometheus running on your system, then you might see errors because the Docker image is trying to use ports that your local installations are already using. Stop the services, then run the command again.

1. Ensure all services are up-and-running:

   ```
   docker-compose ps
   ```

   In the **State** column, it should say `Up` for all services.

1. Browse to the sample application on [localhost:8081](http://localhost:8081).

### Grafana News

The sample application, Grafana News, lets you post links and vote for the ones you like.

To add a link:

1. In **Title**, enter **Example**.
1. In **URL**, enter **https://example.com**.
1. Click **Submit** to add the link.

   The link appears in the list under the Grafana News heading.

To vote for a link, click the triangle icon next to the name of the link.

## Log in to Grafana

Grafana is an open-source platform for monitoring and observability that lets you visualize and explore the state of your systems.

1. Open a new tab.
1. Browse to [localhost:3000](http://localhost:3000).
1. In **email or username**, enter **admin**.
1. In **password**, enter **admin**.
1. Click **Log In**.

   The first time you log in, you're asked to change your password:

1. In **New password**, enter your new password.
1. In **Confirm new password**, enter the same password.
1. Click **Save**.

The first thing you see is the Home dashboard, which helps you get started.

In the top left corner, you can see the menu icon. Clicking it will open the _sidebar_, the main menu for navigating Grafana.

## Add a metrics data source

The sample application exposes metrics which are stored in [Prometheus](https://prometheus.io/), a popular time series database (TSDB).

To be able to visualize the metrics from Prometheus, you first need to add it as a data source in Grafana.

1. In the sidebar, click **Connections** and then **Data sources**.
1. Click **Add data source**.
1. In the list of data sources, click **Prometheus**.
1. In the URL box, enter **http\://prometheus:9090**.
1. Scroll to the bottom of the page and click **Save & test**.

   Prometheus is now available as a data source in Grafana.

## Explore your metrics

Grafana Explore is a workflow for troubleshooting and data exploration. In this step, you'll be using Explore to create ad-hoc queries to understand the metrics exposed by the sample application.

> Ad-hoc queries are queries that are made interactively, with the purpose of exploring data. An ad-hoc query is commonly followed by another, more specific query.

1. Click the menu icon and, in the sidebar, click **Explore**. The Prometheus data source that you added will already be selected.
1. Confirm that you're in code mode by checking the **Builder/Code** toggle at the top right corner of the query panel.
1. In the query editor, where it says _Enter a PromQL query…_, enter `tns_request_duration_seconds_count` and then press Shift + Enter.
   A graph appears.
1. In the top right corner, click the dropdown arrow on the **Run Query** button, and then select **5s**. Grafana runs your query and updates the graph every 5 seconds.

   You just made your first _PromQL_ query! [PromQL](https://prometheus.io/docs/prometheus/latest/querying/basics/) is a powerful query language that lets you select and aggregate time series data stored in Prometheus.

   `tns_request_duration_seconds_count` is a _counter_, a type of metric whose value only ever increases. Rather than visualizing the actual value, you can use counters to calculate the _rate of change_, i.e. how fast the value increases.

1. Add the [`rate`](https://prometheus.io/docs/prometheus/latest/querying/functions/#rate) function to your query to visualize the rate of requests per second. Enter the following in the query editor and then press Shift + Enter.

   ```
   rate(tns_request_duration_seconds_count[5m])
   ```

   Immediately below the graph there's an area where each time series is listed with a colored icon next to it. This area is called the _legend_.

   PromQL lets you group the time series by their labels, using the [`sum`](https://prometheus.io/docs/prometheus/latest/querying/operators/#aggregation-operators) aggregation operator.

1. Add the `sum` aggregation operator to your query to group time series by route:

   ```
   sum(rate(tns_request_duration_seconds_count[5m])) by(route)
   ```

1. Go back to the [sample application](http://localhost:8081) and generate some traffic by adding new links, voting, or just refresh the browser.

1. Back in Grafana, in the upper-right corner, click the _time picker_, and select **Last 5 minutes**. By zooming in on the last few minutes, it's easier to see when you receive new data.

Depending on your use case, you might want to group on other labels. Try grouping by other labels, such as `status_code`, by changing the `by(route)` part of the query.

## Add a logging data source

Grafana supports log data sources, like [Loki](/oss/loki/). Just like for metrics, you first need to add your data source to Grafana.

1. Click the menu icon and, in the sidebar, click **Connections** and then **Data sources**.
1. Click **+ Add new data source**.
1. In the list of data sources, click **Loki**.
1. In the URL box, enter [http://loki:3100](http://loki:3100).
1. Scroll to the bottom of the page and click **Save & Test** to save your changes.

Loki is now available as a data source in Grafana.

## Explore your logs

Grafana Explore not only lets you make ad-hoc queries for metrics, but lets you explore your logs as well.

1. Click the menu icon and, in the sidebar, click **Explore**.
1. In the data source list at the top, select the **Loki** data source.
1. Confirm that you're in code mode by checking the **Builder/Code** toggle at the top right corner of the query panel.
1. Enter the following in the query editor, and then press Shift + Enter:

   ```
   {filename="/var/log/tns-app.log"}
   ```

1. Grafana displays all logs within the log file of the sample application. The height of each bar in the graph encodes the number of logs that were generated at that time.

1. Click and drag across the bars in the graph to filter logs based on time.

Not only does Loki let you filter logs based on labels, but on specific occurrences.

Let's generate an error, and analyze it with Explore.

1. In the [sample application](http://localhost:8081), post a new link without a URL to generate an error in your browser that says `empty url`.
1. Go back to Grafana and enter the following query to filter log lines based on a substring:

   ```
   {filename="/var/log/tns-app.log"} |= "error"
   ```

1. Click on the log line that says `level=error msg="empty url"` to see more information about the error.

   > **Note:** If you're in Live mode, clicking logs will not show more information about the error. Instead, stop and exit the live stream, then click the log line there.

Logs are helpful for understanding what went wrong. Later in this tutorial, you'll see how you can correlate logs with metrics from Prometheus to better understand the context of the error.

## Build a dashboard

A _dashboard_ gives you an at-a-glance view of your data and lets you track metrics through different visualizations.

Dashboards consist of _panels_, each representing a part of the story you want your dashboard to tell.

Every panel consists of a _query_ and a _visualization_. The query defines _what_ data you want to display, whereas the visualization defines _how_ the data is displayed.

1. Click the menu icon and, in the sidebar, click **Dashboards**.
1. On the **Dashboards** page, click **New** in top right corner and select **New Dashboard** in the drop-down.
1. Click **+ Add visualization**.
1. In the modal that opens, select the Prometheus data source that you just added.
1. In the **Query** tab below the graph, enter the query from earlier and then press Shift + Enter:

   ```
   sum(rate(tns_request_duration_seconds_count[5m])) by(route)
   ```

1. Click **Options** under the query field to open the panel.
1. In the **Legend** field, select **Custom** and then enter `route` to rename the series in the legend. The graph legend updates when you click outside the field.
1. In the panel editor on the right, under **Panel options**, change the panel title to "Traffic".
1. Click **Apply** in the top-right corner to save the panel and go back to the dashboard view.
1. Click the **Save dashboard** (disk) icon at the top of the dashboard to save your dashboard.
1. Enter a name in the **Dashboard name** field and then click **Save**.

## Annotate events

When things go bad, it often helps if you understand the context in which the failure occurred. Time of last deploy, system changes, or database migration can offer insight into what might have caused an outage. Annotations allow you to represent such events directly on your graphs.

In the next part of the tutorial, we will simulate some common use cases that someone would add annotations for.

1. To manually add an annotation, click anywhere in your graph, then click **Add annotation**.
1. In **Description**, enter **Migrated user database**.
1. Click **Save**.

   Grafana adds your annotation to the graph. Hover your mouse over the base of the annotation to read the text.

Grafana also lets you annotate a time interval, with _region annotations_.

Add a region annotation:

1. Press Ctrl (or Cmd on macOS), then click and drag across the graph to select an area.
1. In **Description**, enter **Performed load tests**.
1. In **Tags**, enter **testing**.
1. Click **Save**.

Manually annotating your dashboard is fine for those single events. For regularly occurring events, such as deploying a new release, Grafana supports querying annotations from one of your data sources. Let's create an annotation using the Loki data source we added earlier.

1. At the top of the dashboard, click the **Dashboard settings** (gear) icon.
1. Go to **Annotations** and click **Add annotation query**.
1. In **Name**, enter **Errors**.
1. In **Data source**, select **Loki**.
1. In **Query**, enter the following query:

   ```
   {filename="/var/log/tns-app.log"} |= "error"
   ```

<!--this add button is gone rn. look into this -->

1. Click **Apply**. Grafana displays the **Annotations** page, with your new annotation in the list.
1. Click the name of the dashboard in the breadcrumb at the top of the screen to return to your dashboard.
1. At the top of your dashboard, there is now a toggle with the name **Errors** to display the results of the newly created annotation query. The toggle is enabled by default.

The log lines returned by your query are now displayed as annotations in the graph.

Being able to combine data from multiple data sources in one graph allows you to correlate information from both Prometheus and Loki.

Annotations also work very well alongside alerts. In the next and final section, we will set up an alert for our app `grafana.news` and then we will trigger it. This will provide a quick intro to our new Alerting platform.

## Create a Grafana Managed Alert

Alerts allow you to identify problems in your system moments after they occur. By quickly identifying unintended changes in your system, you can minimize disruptions to your services.

Grafana's new alerting platform debuted with Grafana 8. A year later, with Grafana 9, it became the default alerting method. In this step we will create a Grafana Managed Alert. Then we will trigger our new alert and send a test message to a dummy endpoint.

The most basic alert consists of two parts:

1. A _Contact point_ - A Contact point defines how Grafana delivers an alert. When the conditions of an _alert rule_ are met, Grafana notifies the contact points, or channels, configured for that alert. Some popular channels include email, webhooks, Slack notifications, and PagerDuty notifications.
1. An _Alert rule_ - An Alert rule defines one or more _conditions_ that Grafana regularly evaluates. When these evaluations meet the rule's criteria, the alert is triggered.

To begin, let's set up a webhook contact point. Once we have a usable endpoint, we'll write an alert rule and trigger a notification.

### Create a contact point for Grafana Managed Alerts

In this step, we'll set up a new contact point. This contact point will use the _webhooks_ channel. In order to make this work, we also need an endpoint for our webhook channel to receive the alert. We will use [requestbin.com](https://requestbin.com) to quickly set up that test endpoint. This way we can make sure that our alert is actually sending a notification somewhere.

1. Browse to [requestbin.com](https://requestbin.com).
1. Under the **Create Request Bin** button, click the **public bin** link.

Your request bin is now waiting for the first request.

1. Copy the endpoint URL.

Next, let's configure a Contact Point in Grafana's Alerting UI to send notifications to our Request Bin.

1. Return to Grafana. Click the menu icon and, in the sidebar, click **Alerting** and then **Contact points**.
1. Click **+ Add contact point**.
1. In **Name**, write **RequestBin**.
1. In the **Integration** dropdown menu, choose **Webhook**.
1. In **Url**, paste the endpoint to your request bin.
1. Click **Test** to send a test alert to your request bin.
1. Navigate back to the request bin you created earlier. On the left side, there's now a `POST /` entry. Click it to see what information Grafana sent.
1. Return to Grafana and click **Save contact point**.

We have now created a dummy webhook endpoint and created a new Alerting Contact Point in Grafana. Now we can create an alert rule and link it to this new channel.

### Add an Alert Rule to Grafana

Now that Grafana knows how to notify us, it's time to set up an alert rule:

1. In the sidebar, click **Alert rules**.
1. Click **Create alert rule**.
1. In section **1**, name the rule `fundamentals-test`.
1. For section **2**, select **Grafana Managed Alert** as the rule type. Next, find query box **A**. Choose your Prometheus datasource and enter the same query that we used in our earlier panel: `sum(rate(tns_request_duration_seconds_count[5m])) by(route)`. Click **Run queries**. You should see some data in the graph.
1. Now scroll down to query box **B**. Change the operation from **Reduce** to **Classic condition**. [You can read more about classic and multi-dimensional conditions here](/docs/grafana/latest/alerting/unified-alerting/alerting-rules/create-grafana-managed-rule/#single-and-multi-dimensional-rule). For conditions enter the following: `WHEN last() OF A IS ABOVE 0.2`. Delete query **C**.
1. In section **3**, Select **+ Add New** in **Folder** dropdown menu. Name the new folder `fundamentals` and press enter. This will create the folder needed. In **Evaluation Group**, name the group also `fundamentals` for now. In the **for** field, enter `0m`. This setting makes Grafana wait until an alert has fired for a given time before Grafana sends the notification.
1. In section **4**, you can add some sample text to your summary message. [Read more about message templating here](/docs/grafana/latest/alerting/unified-alerting/message-templating/).
1. In the top right corner of the page, click **Save rule and exit**.
1. In the sidebar, click **Notification policies**.
1. Under **Default policy**, click the button with the three dots and select **Edit**. Change the **Default contact point** to **RequestBin**. Click **Update default policy**.
   As a system grows, admins can use the **Notification policies** setting to organize and match alert rules to
   specific contact points.

### Trigger a Grafana Managed Alert

We have now configured an alert rule and a contact point. Now let's see if we can trigger a Grafana Managed Alert by generating some traffic on our sample application.

1. Browse to [localhost:8081](http://localhost:8081).
1. Repeatedly click the vote button or refresh the page to generate a traffic spike.

Once the query `sum(rate(tns_request_duration_seconds_count[5m])) by(route)` returns a value greater than `0.2` Grafana will trigger our alert. Browse to the Request Bin we created earlier and find the sent Grafana alert notification with details and metadata.

## Summary

In this tutorial you learned about fundamental features of Grafana. To do so, we ran several Docker containers on your local machine. When you are ready to clean up this local tutorial environment, run the following command:

```
docker-compose down -v
```

### Learn more

Check out the links below to continue your learning journey with Grafana's LGTM stack.

- [Prometheus](/docs/grafana/latest/features/datasources/prometheus/)
- [Loki](/docs/grafana/latest/features/datasources/loki/)
- [Explore](/docs/grafana/latest/features/explore/)
- [Alerting Overview](/docs/grafana/latest/alerting/)
- [Alert rules](/docs/grafana/latest/alerting/create-alerts/)
- [Contact Points](/docs/grafana/latest/alerting/notifications/)
