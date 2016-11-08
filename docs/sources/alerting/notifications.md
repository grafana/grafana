+++
title = "Alerting Notifications"
description = "Alerting Notifications Guide"
keywords = ["Grafana", "alerting", "guide", "notifications"]
type = "docs"
[menu.docs]
name = "Notifications"
parent = "alerting"
weight = 2
+++


# Alert Notifications


> Alerting is only available in Grafana v4.0 and above.


When an alert changes state it sends a notification. One alert can be associated with multiple notifications. You can also configure notifications to be sent for all alerts within Grafana to make sure you won’t miss to configure notifications for an alert. 


You can find the alert notification page in the main menu under alerting. 


## Add a notifications to an Alert
You can add and remove notifications from an alert by going to the `Notifications` sub menu in the alerting tab. 


<img class="no-shadow" src="/img/docs/v4/alerttab_notifications_submenu.png">


Click the `+` button to add a new notification and the `x` to remove. Notifications with a blue backgrounds are enabled by default for all alerts and cannot be modified from this view.


<img class="no-shadow" src="/img/docs/v4/add_remove_notifications.png">


## Default notifications


On the notifications list page (`/alerting/notifications`) you can see all notifiers that have been enabled by default. To make an notification enabled by default
you can check the `Send on all alerts` checkbox on the notification edit page.


## Testing
You can test an notification on the edit page by clicking the `Send Test` button. Grafana will then send test data based on the info on the edit page. This is a simple way of making sure that notifications are working as intended. 

## Supported notifiers
### Email


To enable email notification you have to setup [SMTP settings](/installation/configuration/#smtp) in the Grafana config. 
Email notification will upload an image of the alert graph to an external image destination if available or fallback on attaching the image in the email. 


### Webhook
The webhook notification is a simple way to send information about an state change over HTTP to a custom endpoint. 
Using this notification you could integrated Grafana into any system you choose, by yourself.  


### Slack
To set up slack you need to configure an incoming webhook url at slack. You can follow their guide for how to do that https://api.slack.com/incoming-webhooks
If you want to include screenshots of the firing alerts in the slack messages you have to configure the [external image destination](/alerting/notifications/#graph-screenshots-in-notifiations) in Grafana. 

Setting | Description
---------- | -----------
Recipient | allows you to override the slack recipient.
Mention | make it possible to include a mention in the slack notification sent by Grafana. Ex @here or @channel

### Pagerduty
To set up pagerduty, all you have to do is to provide an api key. 


> Our pagerduty integration only support trigger events at the moment. You have to resolve them by yourself.


## Enable screenshot of alerting graphs
Some notifiers requires you to configure the [external image uploader](/installation/configuration/#external-image-storage) to be able to upload screenshots of the alerts. This is not a requirement for any notifier within Grafana but we strongly encourage you to use it since the alert notifications give the recipient very valuable information.






