---
Feedback Link: https://github.com/grafana/tutorials/issues/new
authors:
  - melori_arellano
categories:
  - alerting
description: Create alerts with Logs
id: grafana-alerts-with-loki
labels:
  products:
    - enterprise
    - oss
    - loki
status: draft
summary: Create alerts with Logs
tags:
  - advanced
title: How to create alerts with log data
weight: 70
---
# How to create alerts with logs

Loki stores your logs and only indexes labels for each log stream. Using Loki with Grafana Alerting is a powerful way to keep track of what's happening in your environment. You can create metric alerts based on content in your log lines to notify your team. Even better, you can add label data from the log message directly into your alert notification.

In this tutorial, you'll:

* Create a conditional alert using Loki.
* Create a custom alert message template
* Configure an email notification that includes part of the log message.

## Before you begin

* Ensure you’re on Grafana 8 or later with [Grafana Alerting](https://grafana.com/docs/grafana/latest/alerting/set-up/migrating-alerts/) enabled.
* Ensure you’ve [configured a Loki datasource](https://grafana.com/docs/grafana/latest/datasources/loki/#configure-the-data-source) in Grafana.
* If you already have logs to work with, you can skip the optional sections and go straight to [create an alert](#create-an-alert).
* If you want to use a log-generating sample script to create the logs demonstrated in this tutorial, refer to the optional steps:
    * [Use promtail and log-generating script](#optional-use-promtail-and-a-python-script-to-create-sample-logs-and-send-them-to-loki)
    * [Use docker with promtail and the log-generating script](#optional-running-the-tutorial-using-grafana-loki-and-promtail-with-docker-compose)

## Create an alert

In these steps you'll create an alert and define an expression to evaluate. These examples use a classic condition.

### Create a Grafana-managed alert

1. Navigate in Grafana to **Alerting**, then to **Alert Rules** and click  **+ Create alert rule**.
1. Choose **Grafana Managed Alert** to create an alert that uses expressions.
1. Select your Loki datasource from the drop-down.
1. Enter the alert query in the query editor, switch to **code** mode in the top right corner of the editor to paste the query below:

    ```
    sum by (message)(count_over_time({filename="/var/log/web_requests.log"} != `status=200` | pattern `<_> <message> duration<_>` [10m]))
    ```

    This query will count the number of log lines with a status code that is not 200 (OK), then sum the result set by message type using an **instant query** and the time interval indicated in brackets. It uses the logql pattern parser to add a new label called `message` that contains the level, method, url, and status from the log line.

    You can use the **explain query** toggle button for a full explanation of the query syntax. The optional log-generating script creates a sample log line similar to the one below:
    **`2023-04-22T02:49:32.562825+00:00 level=info method=GET url=/ status=200 duration=171ms`**

{{% admonition type="note" %}}
If you're using your own logs, modify the logql query to match your own log message. Refer to the Loki docs to understand the [pattern parser](https://grafana.com/docs/loki/latest/logql/log_queries/#pattern).

{{% / admonition %}}

1. Update the default expressions to match the values shown in the tables below:

    **Box B - reduce expression**

    |                  |                           |
    | ---------------- | ------------------------- |
    | Function         | Sum                       |
    | Input            | A                         |
    | Mode             | Strict                    |

    **Box C - threshold expression**
    |                  |                           |
    | ---------------- | --------------------------|
    | Input            | B                         |
    | Expression value | Is above 5                |
    | Alert condition  |This is the alert condition|

1. Expand **Options** and select **Range** as the type.

1. Click **preview** to see a preview of the query result and alert evaluation. If you see **No Data**, verify that you changed the query type to **Range**.

1. Expression B shows a table of labels and values returned. The message label captured the message string from the log line
 and the value shows the number of times that string occurred during the evaluation interval.

    |   labels         |       values              |
    | ---------------- | --------------------------|
    |  message=level=info method=GET url=/ status=500 | 27 |
    |  message=level=info method=POST url=/ status=500 | 1 |

1. Configure your alert evaluation behavior.
    * Choose a folder or use **+add new** to add a new folder for this alert.
    * Select an existing evaluation group from the drop-down or create a new one if this is your first alert.
    * Set the **for** value to **0s** so the alert will fire instantly.
    * Leave Configure no data and error handling No data handling on the default values.

1. Add an annotation that refers to labels and values from the query result in your alert notification.
  
    * Choose **+Add new** in the drop down and type the annotation name **AlertValues** into the blank box
    * In the blank `text` box paste ```{{ $labels.message }}  has returned an error status {{$values.B}} times.```

1. Click the **Save and exit** button at the top of the alert definition page

### Create a Loki managed alert

[Loki managed alerts](https://grafana.com/docs/loki/latest/rules/#alerting-and-recording-rules) are stored and evaluated by Loki. They use LogQL for their expressions. 

1. Choose  Mimir or Loki managed alert to create an alert using Loki
1. Select your Loki data source from the drop-down
1. The optional script will output a sample log line similar to this:
    ```
    2023-04-22T02:49:32.562825+00:00 level=info method=GET url=/ status=200 duration=171ms
    ```
1. Enter the alert query below if you’re using the sample logs or modify it for your own file path and condition.
    ```
    sum by (message)(count_over_time({filename="/var/log/web_requests.log"} != `status=200` | pattern `<_> <message> duration<_>` [5m])) > 5
    ```
    This query will search the interval period and count the number of log lines with a status code that is not 200 (OK), then sum the result set by message type. It uses the logql pattern parser to add a new label called `message` that captured the level, method, url, and status from the log line.

    For loki alerts, the interval needs to be specified in brackets instead of a variable and the alert threshold is added to the query. For this example, the interval is 5m and the alert will fire if there are more than 5 non-200 status messages.

1. Click **preview alert** to see a preview of the labels and value. Hover over the **i** icon under the info column to see the query values.

1. Add an annotation that refers to labels and values from the query result in your alert notification.
  
    * Choose **+Add new** in the drop down and type the annotation name **AlertValues** into the blank box
    * In the blank `text` box, paste the following:
       ```
       {{ $labels.message }}  has returned an error status {{$values.B}} times
       ```

1. Click **Save rule and exit** at the top of the alert screen.

## Create a message template

1. **Add an alert message template** and reference the annotation from your alert.

    * In Alerting under the Contact points tab:
        * Choose **Grafana** to use the built-in alertmanager
        * Click **+Add template**
        * Name the template `mynotification`
        * Add the snippet below to your alert template in the **Content** field. Notice that you will reference the annotation from your alert by name `(.Annotations.AlertValues)` to insert the annotation string into the alert notification:

        ```
        {{ define "myalert" }}
        [{{.Status}}] {{ .Labels.alertname }}
        {{ .Annotations.AlertValues }}
        {{ end }}
        {{ define "mymessage" }}
        {{ if gt (len .Alerts.Firing) 0 }}
            {{ len .Alerts.Firing }} firing:
            {{ range .Alerts.Firing }} {{ template "myalert" .}} {{ end }}
        {{ end }}
        {{ if gt (len .Alerts.Resolved) 0 }}
            {{ len .Alerts.Resolved }} resolved:
            {{ range .Alerts.Resolved }} {{ template "myalert" .}} {{ end }}
        {{ end }}
        {{ end }}
        ```
        * There are two sections to the notification template: 
            1. The `myalert` template creates a single alert notification based on a specific alert.
            1. The `mymessage` template will find all of the grouped alerts that are firing and send them in a single notification.
        * Save the template

1. Add the template to your contact point
    1. Navigate to **Alerts > Contact point** and edit the email contact point. If you're using Grafana Cloud, SMTP is already enabled. Otherwise, for local installations you'll need to [configure SMTP](https://grafana.com/docs/grafana/latest/setup-grafana/configure-grafana/#smtp).
    1. Add an email address in the to field for the recipient
    1. Expand Optional Email Settings and refer to the template by adding this to the body field:
    ```
    {{ template "mynotification" . }}
    ```

**Tada! You're finished!** Grafana will email an alert with a message that looks similar to the one below. The format varies slightly depending on which type of alert you created - Loki or Grafana managed. The contents should be the same:  

```
1 firing: [firing] LokiAlertTest1 Error message level=info method=GET url=/ status=500 has occurred 12 times.
```



## Optional: Use promtail with a sample log-generating script

This optional step uses a python script to generate the sample logs used in this tutorial to create alerts.

1. [Install promtail](https://grafana.com/docs/loki/latest/clients/promtail/installation/) on your local machine and configure it to send logs to your Loki instance.
1. Install Python3 on your local machine if needed.
1. Copy the python script below and paste it into a new file on your local machine.

    ```#!/bin/env python3
    ​
    import datetime
    import math
    import random
    import sys
    import time


    ​# Simulation parameters
    requests_per_second = 2
    failure_rate = 0.05
    get_post_ratio = 0.9
    get_average_duration_ms = 500
    post_average_duration_ms = 2000
    ​
    ​
    while True:
    # Exponential distribution random value of average 1/lines_per_second.
    d = random.expovariate(requests_per_second)
    time.sleep(d)
    if random.random() < failure_rate:
        status = "500"
    else:
        status = "200"
    if random.random() < get_post_ratio:
        method = "GET"
        duration_ms = math.floor(random.expovariate(1/get_average_duration_ms))
    else:
        method = "POST"
        duration_ms = math.floor(random.expovariate(1/post_average_duration_ms))
    timestamp = datetime.datetime.now(tz=datetime.timezone.utc).isoformat()
    print(f"{timestamp} level=info method={method} url=/ status={status} duration={duration_ms}ms")
    sys.stdout.flush()
    ```

1. Give the script executable permissions.

    In a terminal window on linux-based systems run the command:

    ```
    chmod 755  ./web-server-logs-simulator.py
    ```

1. Run the script.

    * Use `tee` to direct the script output to the console and the specified file path. For example, if promtail is
    configured to monitor `/var/log` for `.log` files you can direct the script output to `/var/log/web_requests.log` file.

    * To avoid running the script with elevated permissions, create the log file manually and change the permissions for the output file only.

        ```
        sudo touch /var/log/web_requests.log
        chmod 755 /var/log/web_requests.log
        python3 ./web-server-logs-simulator.py | tee -a /var/log/web_requests.log
        ```

1. Verify that the logs are showing up in Grafana’s Explore view:

    * Navigate to explore in Grafana.
    * Select the Loki datasource from the drop-down.
    * Check the toggle for **builder | code** in the top right corner of the query box and switch the query mode to builder if it’s not already selected.
    * Select the filename label from the drop-down and choose your `web_requests.log` file from the value drop-down.
    * Click **Run Query**.
    * You should see logs and a graph of log volume.

#### Troubleshooting the script

If you don't see the sample logs in Explore:

* Does the output file exist, check /var/log/web_requests.log to see if it contains logs.
* If the file is empty, check that you followed the steps above to create the file and change the permissions.
* If the file exists, verify that promtail is running and check that it is configured correctly.
* In Grafana Explore, check that the time range is only for the last 5 minutes.

## Optional: Use Docker compose to create the tutorial environment 

These optional steps walk you through installing Grafana, Loki and Promtail with Docker compose. You'll also configure a log-generating script
that generates the sample logs used in this tutorial to create alerts.

#### Pre-requisites

* [Docker Compose](https://docs.docker.com/compose/install/)
* Python 3


1. Start a command line from a directory of your choice.
1. From that directory, get a `docker-compose.yaml` file to run Grafana, Loki, and Promtail:

    **Bash**


    ```
    wget https://raw.githubusercontent.com/grafana/loki/v2.8.0/production/docker-compose.yaml -O docker-compose.yaml
    ```

    **Windows Powershell**

    ```
    $client = new-object System.Net.WebClient
    $client.DownloadFile("https://raw.githubusercontent.com/grafana/loki/v2.8.0/production/docker-compose.yaml",
    "C:\Users\$Env:UserName\Desktop\docker-compose.yaml") 
    #downloads the file to the Desktop
    ```

1. Run the container

    ```
    docker compose up -d
    ```

1. Create and edit a python file that will generate logs.

    **Bash**

    ```
    touch web-server-logs-simulator.py && nano web-server-logs-simulator.py
    ```

    **Windows Powershell**

    ```
    New-Item web-server-logs-simulator.py ; notepad web-server-logs-simulator.py
    ```

1. Paste the following code into the file

    ```#!/bin/env python3

    import datetime
    import math
    import random
    import sys
    import time



    requests_per_second = 2
    failure_rate = 0.05
    get_post_ratio = 0.9
    get_average_duration_ms = 500
    post_average_duration_ms = 2000


    while True:
    # Exponential distribution random value of average 1/lines_per_second.
    d = random.expovariate(requests_per_second)
    time.sleep(d)
    if random.random() < failure_rate:
        status = "500"
    else:
        status = "200"
    if random.random() < get_post_ratio:
        method = "GET"
        duration_ms = math.floor(random.expovariate(1/get_average_duration_ms))
    else:
        method = "POST"
        duration_ms = math.floor(random.expovariate(1/post_average_duration_ms))
    timestamp = datetime.datetime.now(tz=datetime.timezone.utc).isoformat()
    print(f"{timestamp} level=info method={method} url=/ status={status} duration={duration_ms}ms")
    sys.stdout.flush()```

1. Execute the log-generating python script.

    In a terminal window on linux-based systems run the command:

    ```
    chmod 755  ./web-server-logs-simulator.py
    ```

    * Use `tee` to direct the script output to the console and the specified file path. For example, if promtail is
    configured to monitor `/var/log` for `.log` files you can direct the script output to `/var/log/web_requests.log` file.

    * To avoid running the script with elevated permissions, create the log file manually and change the permissions for the output file only.

    ```
    sudo touch /var/log/web_requests.log
    chmod 755 /var/log/web_requests.log
    python3 ./web-server-logs-simulator.py | tee -a /var/log/web_requests.log
    ```

    **Running on Windows**
    
    Run Powershell as administrator

    ```
    python ./web-server-logs-simulator.py | Tee-Object "C:\ProgramFiles\GrafanaLabs\grafana\var\log\web_requests.log"
    ```

1. Verify that the logs are showing up in Grafana’s Explore view:

    * Navigate to explore in Grafana
    * Select the Loki datasource from the drop-down
    * Check the toggle for **builder | code** in the top right corner of the query box and switch the query mode to builder if it’s not already selected.
    * Select the filename label from the drop-down and choose your `web_requests.log` file from the value drop-down.
    * Click **Run Query**.
    * You should see logs and a graph of log volume.

**Troubleshooting the script**
    
    If you don't see the logs in Explore, check these things:

    * Does the output file exist, check /var/log/web_requests.log to see if it contains logs.
    * If the file is empty, check that you followed the steps above to create the file and change the permissions.
    * If the file exists, verify that promtail is running and check that it is configured correctly.
    * In Grafana Explore, check that the time range is only for the last 5 minutes.
