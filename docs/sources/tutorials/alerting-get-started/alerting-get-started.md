# Introduction

In this guide, we'll walk you through the process of setting up your first alert in just a few minutes. You'll witness your alert in action with real-time data, as well as receiving alert notifications.

# Before you begin

Ensure you have the following applications installed.

- [Docker Compose](https://docs.docker.com/get-docker/) (included in Docker for Desktop for macOS and Windows)
- [Git](https://git-scm.com/)

## Set up a sample application

The sample application generates real data and exposes metrics,  which are stored in Prometheus. In Grafana Alerting, you can then build an alert rule based on the data generated. 

Download the files to your local machine.


1. Clone the [tutorial environment repository](www.github.com/grafana/tutorial-environment).

    ```
    git clone https://github.com/grafana/tutorial-environment.git
    ```

1. Change to the directory where you cloned this repository:

    ```
    cd tutorial-environment
    ```

1. Make sure Docker is running:

    ```
    docker --version
    ```

    This command will display the installed Docker version if the installation was successful. 
1. Start the sample application:

    ```
    docker compose up -d
    ```

    The first time you run docker `compose up -d`, Docker downloads all the necessary resources for the tutorial. This might take a few minutes, depending on your internet connection.

    {{< admonition type="note" >}}
    If you already have Grafana, Loki, or Prometheus running on your system, then you might see errors because the Docker image is trying to use ports that your local installations are already using. Stop the services, then run the command again.
    {{< /admonition >}}

1. Ensure all services are up-and-running:

    ```
    docker compose ps
    ```

    In the State column, it should say Up for all services.

1. Finally, the Grafana News app should be live on [localhost:8081](http://localhost:8081/).

## Generate some data

### Grafana News

Grafana News is a straightforward application created to demonstrate the observation of data using the Grafana stack. It achieves this by generating web traffic through activities such as posting links and voting for your preferred ones

To add a link:

1. Enter a Title
1. Enter a URL
1. Click **Submit** to add the link. The link will appear listed under the Grafana News heading.
To vote for a link, click the triangle icon next to the name of the link.

## Log in to Grafana

Besides being an open-source observability tool, Grafana has its own built-in alerting service.   This means that you can receive notifications whenever there is an event of interest in your data, and even see these events graphed in your visualizations.

In your browser, simply navigate to [localhost:3000](http://localhost:3000). You should get logged in automatically

## Create an Alert

Next, we'll establish an alert within Grafana Alerting to notify us whenever our sample app experiences a specific volume of requests.

In Grafana, toggle the menu at the top left side of the screen, and **navigate to Alerting** > **Alert rules**. Click on  **+ New alert rule**.

## Enter alert rule name

1. Make it short and descriptive as this will appear in your alert notification. For instance, server-requests-duration

## Define query and alert condition

In this section we define the conditions that trigger alerts. 

1. Select the ** Prometheus** data source from the drop-down menu. 

    {{< admonition type="note" >}}
    To visualize this data in Grafana, we need time-series metrics that we can collect and store. We can do that with [Prometheus](https://grafana.com/docs/grafana/latest/getting-started/get-started-grafana-prometheus/), which pulls metrics from our sample app.
    {{< /admonition >}}

1. In the Query editor, **switch to Code mode**.
1. Paste the query tns_request_duration_seconds_count{status_code="200",method="GET"}
You should see the number of requests made to the server that had a response code 200.
1. Keep expressions “B” and “C” as they are. These expressions (Reduce and Threshold, respectively) come by default when creating a new rule. Expression “B”, selects the last value of our query “A”, while the Threshold expression “C” will check if the last value from expression “B” is above a specific value. In addition, the Threshold expression is the alert condition by default. Enter 0.2 as threshold value. You can read more about queries and conditions [here](https://grafana.com/docs/grafana/latest/alerting/fundamentals/alert-rules/queries-conditions/#expression-queries).
1. Click Preview to run the queries.

At this point, our alert should be working (it should be either in [Firing or Normal state](https://grafana.com/docs/grafana/latest/alerting/manage-notifications/view-state-health/#alert-rule-state)). If it returns an error, follow the instructions in the error message. If it returns “No data,” reselect the metrics from the Metrics browser; make sure the Input of each expression is correct (expression B: Input A and expression C: Input B). If you still get stuck, you are very welcome to post questions in our [Grafana Community forum](https://community.grafana.com/).


## Set evaluation behavior

Define how often the rule is checked.

1. In **Folder**, click **+ New folder** and enter a name. For example: grafana-news. This folder will contain our alerts. 
1. In the **Evaluation group**, repeat the above step to create a new evaluation group. We will name it 1m-evaluation. 
1. Choose an **Evaluation interval** (how often the alert will be evaluated). 
For example, every 1m (1 minute).
1. Set the **pending period** (the “for” period). 
This is the time that a condition has to be met until the alert enters into **Firing** state and a notification is sent. For example, 0s so the alert rule fires the moment the condition is met.

## Configure labels and notifications

Add labels in order to ease searching or route notifications to a policy.

### Labels

1. Add `app` as the label key, and `grafana-news` as the value

### Notifications

Select who should receive a notification when an alert rule fires.

1. Click **View or create contact points**. 
A new tab will open in your browser. 
1. **Edit** the email Contact point. 
1. **Enter an email address** in the Addresses field.
1. **Click Save** contact point.
1. Switch back to the other tab to **continue creating the Alert rule**.


## Add Annotations

In this section, we can Link a dashboard and panel to our Alert. For that, click **Link Dashboard and panel** button.

Linking an alert rule to a panel adds an annotation to the panel when the status of your alert rulechanges. If you don’t have a panel already, and since this is optional, you can skip this step for now and link it after you have finished configuring the alert rule.

## Trigger an alert
We have now configured an alert rule and a contact point. Now let’s see if we can trigger an alert by generating some traffic on our sample application.
Browse to [localhost:8081](http://localhost:8081/).
Add a new title and URL, repeatedly click the vote button, or refresh the page to generate a traffic spike.

Once the query `sum(rate(tns_request_duration_seconds_count[5m])) by(route)` returns a value greater than 0.2 Grafana will trigger our alert. Browse to the Request Bin we created earlier and find the sent Grafana alert notification with details and metadata.

## Receive your first alert notification

Once the alert rule condition is met, you should receive an alert to your email.

The alert comes with additional information besides the annotation summary we wrote, such as links to perform actions like [silencing](https://grafana.com/docs/grafana/latest/alerting/manage-notifications/create-silence/) your alert or visiting the panel to which the alert is linked.


# Next steps
