---
canonical: https://grafana.com/docs/grafana/latest/alerting/configure-notifications/manage-contact-points/integrations/configure-email/
description: Configure email integration to send email notifications when your alerts are firing
keywords:
  - grafana
  - alerting
  - email
  - integration
labels:
  products:
    - cloud
    - enterprise
    - oss
menuTitle: Email
title: Configure email for alert notifications
weight: 110
refs:
  configure-contact-points:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/alerting/configure-notifications/manage-contact-points/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/alerting-and-irm/alerting/configure-notifications/manage-contact-points/
  notification-templates:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/alerting/configure-notifications/template-notifications/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/alerting-and-irm/alerting/configure-notifications/template-notifications/
---

# Configure email for alert notifications

Use the email integration to send alert notifications to one or more addresses.

You can customize the [subject and main section of the email body](#optional-settings-using-templates). By default, the subject and body are generated from the alert data included in the notification.

## Before you begin

In Grafana OSS, you must configure SMTP settings before you can enable email notifications.

{{<admonition type="note">}}
In Grafana Cloud, SMTP configuration is not required.
{{</admonition>}}

1. Open the [configuration file](/docs/grafana/<GRAFANA_VERSION>/setup-grafana/configure-grafana/). The file is typically named `grafana.ini` or `custom.ini` and located in the `conf` directory of your Grafana installation.

1. Configure the [SMTP settings](/docs/grafana/<GRAFANA_VERSION>/setup-grafana/configure-grafana/#smtp) for your email server in the `[smtp]` section.

1. Save your changes and restart Grafana.

1. Test email notifications by creating a contact point.

## Configure Email for a contact point

To create a contact point with a email integration, complete the following steps.

1. Navigate to **Alerts & IRM** -> **Alerting** -> **Contact points**.
1. Click **+ Create contact point**.
1. Enter a name for the contact point.
1. From the **Integration** list, select **Email**.
1. Set up the required [settings](#email-settings) for your Email configuration.
1. Click **Save contact point**.

For more details on contact points, including how to test them and enable notifications, refer to [Configure contact points](ref:configure-contact-points).

## Email settings

| Option    | Description                                                                                |
| --------- | ------------------------------------------------------------------------------------------ |
| Addresses | The list of email addresses to send the notifications. Email addresses are case sensitive. |

#### Optional settings

| Option       | Description                                                               |
| ------------ | ------------------------------------------------------------------------- |
| Single email | Send a single email to all email addresses rather than individual emails. |

#### Optional settings using templates

{{<admonition type="note">}}
You can customize the email subject and main section of the email body, but you can't edit HTML or CSS for visual changes.

In Grafana OSS and Enterprise, you can edit the full email template. However, this is not officially supported because it's an internal API that may change without prior notice.
{{</admonition>}}

| Option  | Description                                                                                                                             |
| ------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| Subject | Sets the email subject, replacing the default template. Supports [notification templates](ref:notification-templates).                  |
| Message | Sets the main section of the email body, replacing the default template. Supports [notification templates](ref:notification-templates). |

{{< figure src="/media/docs/alerting/custom-email-message5.png" caption="Email notification with custom message." max-width="750px" >}}

#### Optional notification settings

| Option                   | Description                                                         |
| ------------------------ | ------------------------------------------------------------------- |
| Disable resolved message | Enable this option to prevent notifications when an alert resolves. |
