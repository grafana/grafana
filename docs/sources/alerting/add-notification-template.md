+++
title = "Adding notification templating"
keywords = ["grafana", "documentation", "alerting", "alerts", "notification", "templating"]
weight = 110
+++

# Alert notification templating

In order to help provide more detailed information to alert notification recipients, you can inject alert query 
data into an alert notification. This page explains how to use alert query labels in your alert notifications.

## Adding alert label data into your alert notification

1. Navigate to the panel you want to add or edit an alert rule for, click the title, and then click **Edit**.
1. On the Alert tab, click **Create Alert**. If an alert already exists for this panel, then you can just edit the alert directly on the Alert tab.
1. Labels that exist from the evaluation of the alert query can be used in the alert rule name or alert notification message fields. Alert data template syntax is formatted as follows: `${Label}`. See the image below for an example.    
1. When you finish writing your rule, click **Save** in the upper right corner to save the alert rule and the dashboard.
1. Finally, when the alert is in the alerting state, the alert label data is injected into the notification fields where appropriate. In the cases where there are multiple unique label values, they will be shown in the notification as comma separated. 

![Alerting notification template](/img/docs/alerting/notification_template.png)
