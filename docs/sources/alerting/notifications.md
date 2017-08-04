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

When an alert changes state it sends out notifications. Each alert rule can have
multiple notifications. But in order to add a notification to an alert rule you first need
to add and configure a `notification` channel (can be email, Pagerduty or other integration). This is done from the Notification Channels page.

## Notification Channel Setup

{{< imgbox max-width="40%" img="/img/docs/v43/alert_notifications_menu.png" caption="Alerting Notification Channels" >}}

On the Notification Channels page hit the `New Channel` button to go the page where you
can configure and setup a new Notification Channel.

You specify name and type, and type specific options. You can also test the notification to make
sure it's working and setup correctly.

### Send on all alerts

When checked this option will make this notification used for all alert rules, existing and new.

## Supported Notification Types

Grafana ships with the following set of notification types:

### Email

To enable email notification you have to setup [SMTP settings](/installation/configuration/#smtp)
in the Grafana config. Email notification will upload an image of the alert graph to an
external image destination if available or fallback to attaching the image in the email.

### Slack

{{< imgbox max-width="40%" img="/img/docs/v4/slack_notification.png" caption="Alerting Slack Notification" >}}

To set up slack you need to configure an incoming webhook url at slack. You can follow their guide for how
to do that https://api.slack.com/incoming-webhooks If you want to include screenshots of the firing alerts
in the slack messages you have to configure the [external image destination](#external-image-store) in Grafana.

Setting | Description
---------- | -----------
Recipient | allows you to override the slack recipient.
Mention | make it possible to include a mention in the slack notification sent by Grafana. Ex @here or @channel

### PagerDuty

To set up PagerDuty, all you have to do is to provide an api key.

Setting | Description
---------- | -----------
Integration Key | Integration key for pagerduty.
Auto resolve incidents | Resolve incidents in pagerduty once the alert goes back to ok

### Webhook

The webhook notification is a simple way to send information about an state change over HTTP to a custom endpoint.
Using this notification you could integrate Grafana into any system you choose, by yourself.

Example json body:

```json
{
  "title": "My alert",
  "ruleId": 1,
  "ruleName": "Load peaking!",
  "ruleUrl": "http://url.to.grafana/db/dashboard/my_dashboard?panelId=2",
  "state": "alerting",
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

- **state** - The possible values for alert state are: `ok`, `paused`, `alerting`, `pending`, `no_data`.

### DingDing/DingTalk

[Instructions in Chinese](https://open-doc.dingtalk.com/docs/doc.htm?spm=a219a.7629140.0.0.p2lr6t&treeId=257&articleId=105733&docType=1).

In DingTalk PC Client:

1. Click "more" icon on left bottom of the panel.

2. Click "Robot Manage" item in the pop menu, there will be a new panel call "Robot Manage".

3. In the  "Robot Manage" panel, select "customised: customised robot with Webhook".

4. In the next new panel named "robot detail", click "Add" button.

5. In "Add Robot" panel, input a nickname for the robot and select a "message group" which the robot will join in. click "next".

6. There will be a Webhook URL in the panel, looks like this: https://oapi.dingtalk.com/robot/send?access_token=xxxxxxxxx. Copy this URL to the grafana Dingtalk setting page and then click "finish".

Dingtalk supports the following "message type": `text`, `link` and `markdown`. Only the `text` message type is supported.

### Other Supported Notification Channels

Grafana also supports the following Notification Channels:

- HipChat

- VictorOps

- Sensu

- OpsGenie

- Threema

- Pushover

- Telegram

- LINE

# Enable images in notifications {#external-image-store}

Grafana can render the panel associated with the alert rule and include that in the notification. Most Notification Channels require that this image be publicly accessible (Slack and PagerDuty for example). In order to include images in alert notifications, Grafana can upload the image to an image store. It currently supports
Amazon S3 and Webdav for this. So to set that up you need to configure the [external image uploader](/installation/configuration/#external-image-storage) in your grafana-server ini config file.

Currently only the Email Channels attaches images if no external image store is specified. To include images in alert notifications for other channels then you need to set up an external image store.

This is an optional requirement, you can get Slack and email notifications without setting this up.

# Configure the link back to Grafana from alert notifications

All alert notifications contains a link back to the triggered alert in the Grafana instance.
This url is based on the [domain](/installation/configuration/#domain) setting in Grafana.
