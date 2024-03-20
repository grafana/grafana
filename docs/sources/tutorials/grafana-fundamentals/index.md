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

In this tutorial, you'll learn how to use Grafana to set up a monitoring solution for your application, and:

- Explore metrics and logs
- Build dashboards
- Annotate dashboards
- Set up alerts

Alternatively, you can also watch our Grafana for Beginners series where we discuss fundamental concepts to help you get started with Grafana.

<div style="position:relative;padding-bottom:56.25%;height:0;overflow:hidden">
   <iframe src="https://www.youtube.com/embed/videoseries?si=ueLa_QEXz20IWnGt&amp;list=PLDGkOdUX1Ujo27m6qiTPPCpFHVfyKq9jT" style="position:absolute;top:0;left:0;width:100%;height:100%;border:0" title="YouTube video player" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen>
   </iframe>
</div>

{{% class "prerequisite-section" %}}

### Prerequisites

- [Docker](https://docs.docker.com/install/)
- [Docker Compose](https://docs.docker.com/compose/) (included in Docker for Desktop for macOS and Windows)
- [Git](https://git-scm.com/)
  {{% /class %}}

## Set up the sample application

This tutorial uses a sample application to demonstrate some of the features in Grafana. To complete the exercises in this tutorial, you need to download the files to your local machine.

In this step, you'll set up the sample application, as well as supporting services, such as [Loki](/oss/loki/).

> **Note:** [Prometheus](https://prometheus.io/), a popular time series database (TSDB), has already been configured as a data source as part of this tutorial.

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

## Explore your metrics

Grafana Explore is a workflow for troubleshooting and data exploration. In this step, you'll be using Explore to create ad-hoc queries to understand the metrics exposed by the sample application.

> Ad-hoc queries are queries that are made interactively, with the purpose of exploring data. An ad-hoc query is commonly followed by another, more specific query.

1. Click the menu icon and, in the sidebar, click **Explore**. A dropdown menu for the list of available data sources is on the upper-left side. The Prometheus data source will already be selected. If not, choose Prometheus.
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

Depending on your use case, you might want to group on other labels. Try grouping by other labels, such as `status_code`, by changing the `by(route)` part of the query to `by(status_code)`.

## Add a logging data source

Grafana supports log data sources, like [Loki](/oss/loki/). Just like for metrics, you first need to add your data source to Grafana.

1. Click the menu icon and, in the sidebar, click **Connections** and then **Data sources**.
1. Click **+ Add new data source**.
1. In the list of data sources, click **Loki**.
1. In the URL box, enter [http://loki:3100](http://loki:3100).
1. Scroll to the bottom of the page and click **Save & Test** to save your changes.

You should see the message "Data source successfully connected." Loki is now available as a data source in Grafana.

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

1. In the panel editor on the right, under **Panel options**, change the panel title to "Traffic".
1. Click **Apply** in the top-right corner to save the panel and go back to the dashboard view.
1. Click the **Save dashboard** (disk) icon at the top of the dashboard to save your dashboard.
1. Enter a name in the **Dashboard name** field and then click **Save**.

   You should now have a panel added to your dashboard.

   {{< figure src="/media/tutorials/grafana-fundamentals-dashboard.png" alt="A panel in a Grafana dashboard" caption="A panel in a Grafana dashboard" >}}

## Annotate events

When things go bad, it often helps if you understand the context in which the failure occurred. Time of last deploy, system changes, or database migration can offer insight into what might have caused an outage. Annotations allow you to represent such events directly on your graphs.

In the next part of the tutorial, we will simulate some common use cases that someone would add annotations for.

1. To manually add an annotation, click anywhere in your graph, then click **Add annotation**.
   Note: you might need to save the dashboard first.
1. In **Description**, enter **Migrated user database**.
1. Click **Save**.

   Grafana adds your annotation to the graph. Hover your mouse over the base of the annotation to read the text.

Grafana also lets you annotate a time interval, with _region annotations_.

Add a region annotation:

1. Press Ctrl (or Cmd on macOS) and hold, then click and drag across the graph to select an area.
1. In **Description**, enter **Performed load tests**.
1. In **Tags**, enter **testing**.
1. Click **Save**.

### Using annotations to correlate logs with metrics

Manually annotating your dashboard is fine for those single events. For regularly occurring events, such as deploying a new release, Grafana supports querying annotations from one of your data sources. Let's create an annotation using the Loki data source we added earlier.

1. At the top of the dashboard, click the **Dashboard settings** (gear) icon.
1. Go to **Annotations** and click **Add annotation query**.
1. In **Name**, enter **Errors**.
1. In **Data source**, select **Loki**.
1. In **Query**, enter the following query:

   ```
   {filename="/var/log/tns-app.log"} |= "error"
   ```

1. Click **Apply**. Grafana displays the Annotations list, with your new annotation.
1. Click on your dashboard name to return to your dashboard.
1. At the top of your dashboard, there is now a toggle to display the results of the newly created annotation query. Press it if it's not already enabled.
1. Click the **Save dashboard** icon to save the changes.
1. To test the changes, go back to the [sample application](http://localhost:8081), post a new link without a URL to generate an error in your browser that says `empty url`.

The log lines returned by your query are now displayed as annotations in the graph.

{{< figure src="/media/tutorials/annotations-grafana-dashboard.png" alt="A panel in a Grafana dashboard with log queries from Loki displayed as annotations" caption="Displaying log queries from Loki as annotations" >}}

Being able to combine data from multiple data sources in one graph allows you to correlate information from both Prometheus and Loki.

Annotations also work very well alongside alerts. In the next and final section, we will set up an alert for our app `grafana.news` and then we will trigger it. This will provide a quick intro to our new Alerting platform.

## Create a Grafana Managed Alert

Alerts allow you to identify problems in your system moments after they occur. By quickly identifying unintended changes in your system, you can minimize disruptions to your services.

Grafana's new alerting platform debuted with Grafana 8. A year later, with Grafana 9, it became the default alerting method. In this step we will create a Grafana Managed Alert. Then we will trigger our new alert and send a test message to a dummy endpoint.

The most basic alert consists of two parts:

1. A _Contact point_ - A Contact point defines how Grafana delivers an alert. When the conditions of an _alert rule_ are met, Grafana notifies the contact points, or channels, configured for that alert.

   Some popular channels include:

   - Email
   - [Webhooks](#create-a-contact-point-for-grafana-managed-alerts)
   - [Telegram](https://grafana.com/blog/2023/12/28/how-to-integrate-grafana-alerting-and-telegram/)
   - Slack
   - PagerDuty

1. An _Alert rule_ - An Alert rule defines one or more _conditions_ that Grafana regularly evaluates. When these evaluations meet the rule's criteria, the alert is triggered.

To begin, let's set up a webhook contact point. Once we have a usable endpoint, we'll write an alert rule and trigger a notification.

### Create a contact point for Grafana Managed Alerts

In this step, we'll set up a new contact point. This contact point will use the _webhooks_ channel. In order to make this work, we also need an endpoint for our webhook channel to receive the alert. We will use [requestbin.com](https://requestbin.com) to quickly set up that test endpoint. This way we can make sure that our alert is actually sending a notification somewhere.

1. Browse to [requestbin.com](https://requestbin.com).
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

### Add an Alert Rule to Grafana

Now that Grafana knows how to notify us, it's time to set up an alert rule:

1. In Grafana's sidebar, hover over the **Alerting** (bell) icon and then click **Alert rules**.
1. Click **+ New alert rule**.
1. For **Section 1**, name the rule `fundamentals-test`.
1. For **Section 2**, Find the **query A** box. Choose your Prometheus datasource. Note that the rule type should automatically switch to Grafana-managed alert.
1. Switch to code mode by checking the Builder/Code toggle.
1. Enter the same Prometheus query that we used in our earlier panel:

   ```
   sum(rate(tns_request_duration_seconds_count[5m])) by(route)
   ```

1. Press **Preview**. You should see some data returned.
1. Keep expressions “B” and "C" as they are. These expressions (Reduce and Threshold, respectively) come by default when creating a new rule. Expression "B", selects the last value of our query “A”, while the Threshold expression "C" will check if the last value from expression "B" is above a specific value. In addition, the Threshold expression is the alert condition by default. Enter `0.2` as threshold value. [You can read more about queries and conditions here](https://grafana.com/docs/grafana/latest/alerting/fundamentals/alert-rules/queries-conditions/#expression-queries).
1. In **Section 3**, in Folder, create a new folder, by clicking `New folder` and typing a name for the folder. This folder will contain our alerts. For example: `fundamentals`. Then, click `create`.
1. In the Evaluation group, repeat the above step to create a new one. We will name it `fundamentals` too.
1. Choose an Evaluation interval (how often the alert will be evaluated). For example, every `10s` (10 seconds).
1. Set the pending period. This is the time that a condition has to be met until the alert enters in Firing state and a notification is sent. Enter `0s`. For the purposes of this tutorial, the evaluation interval is intentionally short. This makes it easier to test. This setting makes Grafana wait until an alert has fired for a given time before Grafana sends the notification.
1. In **Section 4**, you can optionally add some sample text to your summary message. [Read more about message templating here](/docs/grafana/latest/alerting/unified-alerting/message-templating/).
1. Click **Save rule and exit** at the top of the page.
1. In Grafana's sidebar, navigate to **Notification policies**.
1. Under **Default policy**, select **...** &rsaquo; **Edit** and change the **Default contact point** from **grafana-default-email** to **RequestBin**.
1. Expand the **Timing options** dropdown and under **Group wait** and **Group interval** update the value to `30s` for testing purposes. Group wait is the time Grafana waits before sending the first notification for a new group of alerts. In contrast, group interval is the time Grafana waits before sending notifications about changes to the group.
1. Click **Update default policy**.

   As a system grows, admins can use the **Notification policies** setting to organize and match alert rules to
   specific contact points.

### Trigger a Grafana Managed Alert

We have now configured an alert rule and a contact point. Now let's see if we can trigger a Grafana Managed Alert by generating some traffic on our sample application.

1. Browse to [localhost:8081](http://localhost:8081).
1. Add a new title and URL, repeatedly click the vote button, or refresh the page to generate a traffic spike.

Once the query `sum(rate(tns_request_duration_seconds_count[5m])) by(route)` returns a value greater than `0.2` Grafana will trigger our alert. Browse to the Request Bin we created earlier and find the sent Grafana alert notification with details and metadata.

### Display Grafana Alerts to your dashboard

In most cases, it's also valuable to display Grafana Alerts as annotations to your dashboard. Check out the video tutorial below to learn how to display alerting to your dashboard.

{{< youtube id="ClLp-iSoaSY" >}}

Let's see how we can configure this.

1. In Grafana's sidebar, hover over the **Alerting** (bell) icon and then click **Alert rules**.
1. Expand the `fundamentals > fundamentals` folder to view our created alert rule.
1. Click the **Edit** icon and scroll down to **Section 4**.
1. Click the **Link dashboard and panel** button and select the dashboard and panel to which you want the alert to be added as an annotation.
1. Click **Confirm** and **Save rule and exit** to save all the changes.
1. In Grafana's sidebar, navigate to the dashboard by clicking **Dashboards** and selecting the dashboard you created.
1. To test the changes, follow the steps listed to [trigger a Grafana Managed Alert](#trigger-a-grafana-managed-alert).

   You should now see a red, broken heart icon beside the panel name, signifying that the alert has been triggered. An annotation for the alert, represented as a vertical red line, is also displayed.

   {{< figure src="/media/tutorials/grafana-alert-on-dashboard.png" alt="A panel in a Grafana dashboard with alerting and annotations configured" caption="Displaying Grafana Alerts on a dashboard" >}}

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
