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
title: How to create Grafana Alerts with Log data
weight: 70
---
# How to create Alerts from Log data with Loki

In this tutorial, you'll:

* Create a conditional alert using Loki
* Create a custom alert message template that uses labels and values from the alert query response

## Before you begin

Before starting this tutorial, ensure the following:

* You’re on Grafana 8 or later with [Grafana Alerting](https://grafana.com/docs/grafana/latest/alerting/set-up/migrating-alerts/) enabled
* You’ve [configured Loki datasource](https://grafana.com/docs/grafana/latest/datasources/loki/#configure-the-data-source) in Grafana

## Optional:  Use promtail and a python script to create sample logs and send them to Loki

This optional step will create sample logs that you can use later in this tutorial to create alerts.

1. [Install promtail](https://grafana.com/docs/loki/latest/clients/promtail/installation/) on your local machine and configure it to send logs to your Loki instance.
1. Install Python3 on your local machine if needed.
1. Copy the python script below and paste it into a new file on your local machine

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

1. Give the script executable permissions:
    For Linux-based systems:
    In a terminal window use:
    `chmod 755  ./web-server-logs-simulator.py`

1. Run the script as a user that has access to the directory that promtail is watching.

1. Use the `tee` parameter to direct the script output to the console and the specified file path. For example, if promtail is
 configured to monitor `/var/log` for `.log` files you can direct the script output to `/var/log/web_requests.log` file.

    `python3 ./web-server-logs-simulator.py | tee -a /var/log/web_requests.log`

1. Verify that the logs are showing up in Grafana’s Explore view:

    * Navigate to explore in Grafana
    * Select the Loki datasource from the drop-down
    * Check the toggle for **builder | code** in the top right corner of the query box and switch the query mode to builder if it’s not already selected.
    * Select the filename label from the drop-down and choose your `web_requests.log` file from the value drop-down.
    * Click **Run Query**.
    * You should see logs and a graph of log volume.

## Optional: Running the tutorial using Grafana, Loki and Promtail with Docker compose

### Requirements

* [Docker Compose](https://docs.docker.com/compose/install/)
* Python 3

1. Start a command line from a directory of your choice.
1. From that directory, get a `docker-compose.yaml` file to run Grafana, Loki, and Promtail

    **Bash:**
        
    ```
    wget https://raw.githubusercontent.com/grafana/loki/v2.8.0/production/docker-compose.yaml -O docker-compose.yaml
    ```
        
    **Windows Powershell:**

    ```
    $client = new-object System.Net.WebClient
    $client.DownloadFile("https://raw.githubusercontent.com/grafana/loki/v2.8.0/production/docker-compose.yaml",
    "C:\Users\$Env:UserName\Desktop\docker-compose.yaml") 
    #downloads the file to the Desktop
    ```

1. Run the container
    `docker compose up -d`

1. Create and edit a python file that will generate logs.
 
    **Bash:**

    `touch web-server-logs-simulator.py && nano web-server-logs-simulator.py`

    **Windows’ Powershell:**

    `New-Item web-server-logs-simulator.py ; notepad web-server-logs-simulator.py`

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

1. Execute the python script (outputs logs to a file and to the console).

    **Linux-based systems:**

    Give the script executable permissions:

    `chmod 755  ./web-server-logs-simulator.py`

    Run the script as a user that has access to the directory that promtail is watching.

    **Bash:** 

    `python3 ./web-server-logs-simulator.py | tee -a /var/log/web_requests.log`

    **Windows users:**

    Run Powershell as administrator

    `python ./web-server-logs-simulator.py | Tee-Object "C:\ProgramFiles\GrafanaLabs\grafana\var\log\web_requests.log"`

1. Verify that the logs are showing up in Grafana’s Explore view:
    * Navigate to explore in Grafana
    * Select the Loki datasource from the drop-down
    * Check the toggle for **builder | code** in the top right corner of the query box and switch the query mode to builder if it’s not already selected.
    * Select the filename label from the drop-down and choose your `web_requests.log` file from the value drop-down.
    * Click **Run Query**.
    * You should see logs and a graph of log volume.

## Create an alert
Create an alert and define an expression to evaluate. This example uses a classic condition.

1. Navigate in Grafana to Alerting & IRM, then to Alert Rules and click  **+ Create alert rule**
     
### Create a Grafana-managed alert

1. Choose **Grafana Managed Alert** to create an alert that uses expressions
1. Select your Loki datasource from the drop-down
1. Enter the alert query in the query editor using the code option instead of builder

    ```
    sum by (message)(count_over_time({filename="/var/log/web_requests.log"} != `status=200` | pattern `<_> <message> duration<_>` [$__interval]))
    ```

    This query will count the number of status codes that are not 200 (OK) over the interval period chosen from the alert time range drop-down
    and sum them up by message type. It uses the logql pattern parser to add a new label called `message` that contains the level, method, url,
    and status from the log line.

    You can use the explain query toggle button for a full explanation of the query syntax.

    The optional script will output a sample log line similar to this
    ```
    2023-04-22T02:49:32.562825+00:00 level=info method=GET url=/ status=200 duration=171ms
    ```

    There are two expressions automatically added in box B  and box C. Update the expressions to the values shown in the tables below:

    **Box B - reduce expression**

    |                  |                           |
    | ---------------- | ------------------------- |
    | Function         | Sum                       |
    | Input            | Query A                   |

    **Box C - threshold expression**
    |                  |                           |
    | ---------------- | --------------------------|
    | Input            | Expression B              |
    | Expression value | Is above 5                |
    | Alert condition  | checked with green        |

1. Click on **preview alert** to see a preview of the query result and alert evaluation.

1. Expression B will show a table of labels and values returned. The message label includes this string
 `level=info method=GET url=/ status=500` and the number of times that string occurs during the evaluation interval.

    |   labels         |       values              |
    | ---------------- | --------------------------|
    |  message=level=info method=GET url=/ status=500 | 27 |
    |  message=level=info method=POST url=/ status=500 | 1 |

1. **Add folder & evaluation interval**
    * Choose a folder or use +add new to add a new folder for this alert in the Alert Evaluation section
    * Choose an evaluation group from the drop-down or create a new one if this is your first alert
    * Use a for value of 0s so the alert will fire instantly
    * Leave Configure no data and error handling No data handling on the default values

1. Add an annotation using labels & values
    To refer to labels and values from the query in your alert notification, add a new annotation to the alert:

    * Select +Add new and add the following:
    * **Annotation name:** AlertValues
    * **Annotation value:**
    ```{{ $labels.message }}  has returned an error status {{$values.B}} times.```

1. Click the **Save and exit** button at the top of the alert definition page

### Create a Loki managed alert (alternate option)

1. Choose  Mimir or Loki managed alert to create an alert using Loki
1. Select your Loki datasource from the drop-down
1. The optional script will output a sample log line similar to this:
    ```2023-04-22T02:49:32.562825+00:00 level=info method=GET url=/ status=200 duration=171ms```
1. Enter the alert query below if you’re using the sample script.

    This query will count the number of status codes that are not 200 (OK) over the interval period chosen from the alert time range drop-down and sum
     them up by message type. It uses the logql pattern parser to add a new label called `message` that contains the level, method, url, and status from the log line.

    For loki alerts, the interval needs to be specified in brackets instead of a variable and the alert threshold is added to the query. For this example, the interval is 5m and the alert will fire if there are more than 5 non-200 status messages.

    ```
    sum by (message)(count_over_time({filename="/var/log/web_requests.log", job="integrations/macos-node"} != `status=200` | pattern `<_> <message> duration<_>` [5m])) > 5
    ```

1. Click **preview alert** to see a preview of the labels and value. Hover over the i icon under the info column to see the query values.

1. Add an annotation using labels & values
   To refer to labels and values from the query in your alert notification, add a new annotation to the alert:

    * **Annotation name:** AlertValues
    * **Annotation value:**
    `{{ $labels.message }} has returned an error status {{$values}} times.`

1. Click **Save and exit** at the top of the alert screen.

### Create a message template

1. **Add a single alert message template** and reference the annotation from your alert.

    * In Alerting under the Contact points tab:
        * Choose **Grafana** to use the built-in alertmanager
        * Click **+Add template**
        * Name the template `myalert`
        * Add the snippet below to your alert template in the **Content** field. Notice that you will reference the annotation from your alert by name `(.Annotations.AlertValues)` to insert the annotation string into the alert notification:

        ```
        {{ define "myalert" }}
        [{{.Status}}] {{ .Labels.alertname }}
        {{ .Annotations.AlertValues }}
        {{ end }}
        ```

        * Save the template

1. **Add a message template for grouped messages**. This template will find all of the grouped alerts that are firing and send them in a single notification:
    * Click **+Add template** 
    * Name the template **mymessage**
    * Add the snippet below to your alert template in the **Description** field.
     
     **NOTE:** This template refers to the myalert template that you created in step 1.

        ```
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
    * Click the **Save template** button
1. Add the template to your contact point
    - Add the mymessage template to the body of your contact point. If you’re using the default email contact point:
    - Navigate to **Alerts > Contact point** and edit the email contact point (configure SMTP)
    - Add an email address in the to field for the recipient
    - Expand Optional Email Settings and refer to the template by adding this to the body field:
        **Alert summary:**
        ```
        {{ template "mymessage" . }}
        ```

**Tada! You're finished!** Grafana will email an alert with a message that looks similar to the one below. The format varies slightly depending on which type of alert you created (Loki or Grafana managed). The contents should be the same:  

```
1 firing: [firing] LokiAlertTest1 Error message level=info method=GET url=/ status=500 has occurred 12 times.
```