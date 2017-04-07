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

{{< imgbox max-width="40%" img="/img/docs/v4/alert_notifications_menu.png" caption="Alerting notifications" >}}

> Alerting is only available in Grafana v4.0 and above.

When an alert changes state it sends out notifications. Each alert rule can have
multiple notifications. But in order to add a notification to an alert rule you first need
to add and configure a `notification` object. This is done from the Alerting/Notifications page.

## Notification Setup

On the notifications list page hit the `New Notification` button to go the the page where you
can configure and setup a new notification.

You specify name and type, and type specific options. You can also test the notification to make
sure it's working and setup correctly.

### Send on all alerts

When checked this option will make this notification used for all alert rules, existing and new.

## Supported notification types

Grafana ships with a set of notification types. More will be added in future releases.

### Email

To enable email notification you have to setup [SMTP settings](/installation/configuration/#smtp)
in the Grafana config. Email notification will upload an image of the alert graph to an
external image destination if available or fallback on attaching the image in the email.

### Slack

{{< imgbox max-width="40%" img="/img/docs/v4/slack_notification.png" caption="Alerting Slack Notification" >}}

To set up slack you need to configure an incoming webhook url at slack. You can follow their guide for how
to do that https://api.slack.com/incoming-webhooks If you want to include screenshots of the firing alerts
in the slack messages you have to configure the [external image destination](#external-image-store) in Grafana.

Setting | Description
---------- | -----------
Recipient | allows you to override the slack recipient.
Mention | make it possible to include a mention in the slack notification sent by Grafana. Ex @here or @channel

### Webhook

The webhook notification is a simple way to send information about an state change over HTTP to a custom endpoint.
Using this notification you could integrated Grafana into any system you choose, by yourself.

Example json body:
```json
{
  "title": "My alert",
  "ruleId": 1,
  "ruleName": "Load peaking!",
  "ruleUrl": "http://url.to.grafana/db/dashboard/my_dashboard?panelId=2",
  "state": "Alerting",
  "imageUrl": "http://s3.image.url",
  "message": "Load is peaking. Make sure the traffic is real and spin up more webfronts",
  "evalMatches": [
    {
      "metric": "requests",
      "tags": {},
      "value": 122
    }
  ]
}
```

### PagerDuty

To set up PagerDuty, all you have to do is to provide an api key.

Setting | Description
---------- | -----------
Integration Key | Integration key for pagerduty.
Auto resolve incidents | Resolve incidents in pagerduty once the alert goes back to ok


# Enable images in notifications {#external-image-store}

Grafana can render the panel associated with the alert rule and include that in the notification. Some types
of notifications require that this image be publicly accessable (Slack for example). In order to support
images in notifications like Slack Grafana can upload the image to an image store. It currently supports
Amazon S3 for this and Webdav. So to set that up you need to configure the
[external image uploader](/installation/configuration/#external-image-storage) in your grafana-server ini
config file.

This is an optional requirement, you can get slack and email notifications without setting this up.

# Configure the link back to Grafana from alert notifications

All alert notifications contains a link back to the triggered alert in the Grafana instance. 
This url is based on the [domain](/installation/configuration/#domain) setting in Grafana. 


