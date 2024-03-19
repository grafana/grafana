# Introduction

In this guide, we'll walk you through the process of setting up your first alert in just a few minutes. You'll witness your alert in action with real-time data, as well as receiving alert notifications.

## Before you begin

Docker Compose (included in Docker for Desktop for macOS and Windows)
Git

### Set up the sample application

In order to provide a more hands-on experience, you will use a real-world web application to generate real data. The app will expose metrics, which will be stored in Prometheus, a popular time series database (TSDB). And finally, in Grafana Alerting, you will build an alert rule based on the data generated. 

You will need to download the files to your local machine.


1. Clone the github.com/grafana/tutorial-environment repository.

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

1. Finally, the Grafana News app should be live on localhost:8081.

## Generate some data

### Grafana News

Grafana News is a straightforward application created to demonstrate the observation of data using the Grafana stack. It achieves this by generating web traffic through activities such as posting links and voting for your preferred ones

To add a link:

1. In Title, enter Example.
1. In the URL, enter https://example.com.
1. Click Submit to add the link. The link will appear listed under the Grafana News heading.
To vote for a link, click the triangle icon next to the name of the link.

### Log in to Grafana

Besides being an open-source observability tool, Grafana has its own built-in alerting service.   This means that you can receive notifications whenever there is an event of interest in your data, and even see these events graphed in your visualizations.

1. In your browser, simply navigate to localhost:3000. You should get logged in automatically

### Create the Alert

Before we get started, it’s important to note that Grafana Alerting supports two alert rule types: Grafana-managed alert rules, which allow you to create alerts that can act on data from multiple data sources, and data source-managed alert rules, which are alert rules created and stored within the data source itself. In our case, our data source is Prometheus, so we will be creating a Grafana-managed alert rule. This is because Grafana uses Prometheus Alertmanager as the default Alertmanager, which handles alerts sent by client applications, such as the Prometheus server. Moreover, the exported metrics can be queried using the Prometheus Query language (PromQL)  

1. In Grafana, toggle the menu at the top left side of the screen, and navigate to Alerting > Alert rules. Click on  + New alert rule.

#### Enter alert rule name

1. Give a name to the alert rule. For instance, server-requests-duration

#### Define query and alert condition

1. Choose the data source from the drop-down menu. Since our data source is Prometheus, the rule type should automatically switch to Grafana-managed alert. 


1. In the Query editor, switch to Code mode
P1. aste the query tns_request_duration_seconds_count{status_code="200",method="GET"}
You should see the number of requests made to the server that had a response code 200.
1. Keep expressions “B” and “C” as they are. These expressions (Reduce and Threshold, respectively) come by default when creating a new rule. Expression “B”, selects the last value of our query “A”, while the Threshold expression “C” will check if the last value from expression “B” is above a specific value. In addition, the Threshold expression is the alert condition by default. Enter 0.2 as threshold value. You can read more about queries and conditions here.
1. Click Preview to run the queries.

At this point, our alert should be working (it should be either in Firing or Normal state). If it returns an error, follow the instructions in the error message. If it returns “No data,” reselect the metrics from the Metrics browser; make sure the Input of each expression is correct (expression B: Input A and expression C: Input B). If you still get stuck, you are very welcome to post questions in our Grafana Community forum.

Let’s fill in some other important details.

#### Set evaluation behavior

1. In Folder, click + New folder and enter a name. For example: grafana-news. This folder will contain our alerts. 
1. In the Evaluation group, repeat the above step to create a new evaluation group. We will name it 1m-evaluation. 
1. Choose an Evaluation interval (how often the alert will be evaluated). For example, every 1m (1 minute).
1. Set the pending period (aka, the “for” period). This is the time that a condition has to be met until the alert enters into a Firing state and a notification is sent. For example, 0s so the alert rule fires the moment the condition is met.

#### Configure labels and notifications

In order to ease searching or route notifications to a policy, you should add a label.

##### Labels

1. Add app as the label key, and grafana-news as the value

##### Notifications

Here you can select who should receive a notification when an alert rule fires.

1. Click View or create contact points. A new tab will open in your browser. 
1. Edit the email Contact point 
1. Enter an email address in the Addresses field.
1. Click Save contact point
1. Switch back to the other tab to continue with the Alert rule.


#### Add Annotations

In this section, we can Link a dashboard and panel to our Alert. For that, click **Link Dashboard and panel** button t

Linking an alert to a panel will add an annotation to the panel when the status of your alert changes. If you don’t have a panel already, and since this is optional, you can skip this step for now and link it after you have finished configuring the alert.

#### Trigger an alert
We have now configured an alert rule and a contact point. Now let’s see if we can trigger our Alert by generating some traffic on our sample application.
Browse to localhost:8081.
Add a new title and URL, repeatedly click the vote button, or refresh the page to generate a traffic spike.
Once the query sum(rate(tns_request_duration_seconds_count[5m])) by(route) returns a value greater than 0.2 Grafana will trigger our alert. Browse to the Request Bin we created earlier and find the sent Grafana alert notification with details and metadata.

### Receive your first alert notification

Once the alert rule condition is met, you should receive an alert.

The alert comes with additional information besides the annotation summary we wrote, such as links to perform actions like silencing your alert or visiting the panel to which the alert is linked.


### Next steps