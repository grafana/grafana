+++
title = "Contact points"
description = "Create or edit contact point"
keywords = ["grafana", "alerting", "guide", "contact point", "notification channel", "create"]
weight = 400
+++

# Contact points

Contact points define where to send notifications about alerts that match a particular [notification policy]({{< relref "./notification-policies.md" >}}). A contact point can contain one or more contact point types, eg email, slack, webhook and so on. A notification will dispatched to all contact point types defined on a contact point. [Templating]({{< relref "./message-templating/_index.md" >}}) can be used to customize contact point type message with alert data. Grafana alerting UI can be used to configure both Grafana managed contact points and contact points for an [external Alertmanager if one is configured]({{< relref "../../datasources/alertmanager.md" >}}).

## Add a contact point

1. In the Grafana side bar, hover your cursor over the **Alerting** (bell) icon and then click **Contact points**.
1. Click **Add contact point**.
1. Enter a **Name** for the contact point 
1. Select contact point type and fill out mandatory fields. **Optional settings** can be expanded for more options.
1. If you'd like this contact point to notify via multiple channels, for example both email and slack, click **New contact point type** and fill out additional contact point type details.
1. Click **Save contact point** button at the bottom of the page.

## Editing a contact point
1. In the Grafana side bar, hover your cursor over the **Alerting** (bell) icon and then click **Contact points**.
1. Find the contact point you want to edit in the contact points table and click the **pen icon** on the right side.
1. Make any changes and click **Save contact point** button at the bottom of the page.

## Deleting a contact point 
1. In the Grafana side bar, hover your cursor over the **Alerting** (bell) icon and then click **Contact points**.
1. Find the contact point you want to edit in the contact points table and click the **trash can icon** on the right side.
1. A confirmation dialog will open. Click **Yes, delete**.

**Note** You will not be able to delete contact points that are currently used by any notification policy. If you want to delete such contact point, you will have to first go to [notification policies]({{< relref "./notification-policies.md" >}}) and delete the policy or update it to use another contact point.

## List of notifiers supported by Grafana

Name | Type 
-----|-----
[DingDing](#dingdingdingtalk) | `dingding`
[Discord](#discord) | `discord`
[Email](#email) | `email`
[Google Hangouts Chat](#google-hangouts-chat) | `googlechat`
[Kafka](#kafka) | `kafka`
Line | `line`
Microsoft Teams | `teams`
[Opsgenie](#opsgenie) | `opsgenie`
[Pagerduty](#pagerduty) | `pagerduty`
Prometheus Alertmanager | `prometheus-alertmanager`
[Pushover](#pushover) | `pushover`
Sensu | `sensu`
[Sensu Go](#sensu-go) | `sensugo`
[Slack](#slack) | `slack`
Telegram | `telegram`
Threema | `threema`
VictorOps | `victorops`
[Webhook](#webhook) | `webhook`
[Zenduty](#zenduty) | `webhook` 

## Manage contact points for an external Alertmanager

Grafana alerting UI supports managing external Alertmanager configuration. Once you add an [Alertmanager data source]({{< relref "../../datasources/alertmanager.md" >}}), a dropdown displays at the top of the page where you can select either `Grafana` or an external Alertmanager as your data source. 

{{< figure max-width="40%" src="/static/img/docs/alerting/unified/contact-points-select-am-8-0.gif" caption="Select Alertmanager" >}}

### Edit Alertmanager global config

To edit global configuration options for an alertmanager, like SMTP server that is used by default for all email contact types:


1. In the Grafana side bar, hover your cursor over the **Alerting** (bell) icon and then click **Contact points**.
1. In the dropdown at the top of the page, select an Alertmanager data source.
1. Click **Edit global config** button at the bottom of the page.
1. Fill out the form and click **Save global config**.

**Note** this is only for external Alertmanagers. Some global options for Grafana contact types, like email settings, can be configured via [Grafana configuration]({{< relref "../../administration/configuration.md" >}}).
