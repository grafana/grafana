---
canonical: https://grafana.com/docs/grafana/latest/alerting/manage-notifications/template-notifications/
description: How to customize your notifications using templating
keywords:
  - grafana
  - alerting
  - notifications
  - templates
labels:
  products:
    - cloud
    - enterprise
    - oss
title: Customize notifications
weight: 400
---

# Customize notifications

Customize your notifications with notifications templates.

You can use notification templates to change the title, message, and format of the message in your notifications.

Notification templates are not tied to specific contact point integrations, such as email or Slack. However, you can choose to create separate notification templates for different contact point integrations.

You can use notification templates to:

- Add, remove, or re-order information in the notification including the summary, description, labels and annotations, values, and links
- Format text in bold and italic, and add or remove line breaks

You cannot use notification templates to:

- Change how images are included in notifications, such as the number of images in each notification or where in the notification inline images are shown
- Change the design of notifications in instant messaging services such as Slack and Microsoft Teams
- Change the data in webhook notifications, including the structure of the JSON request or sending data in other formats such as XML
- Add or remove HTTP headers in webhook notifications other than those in the contact point configuration

[Using Go's templating language][using-go-templating-language]

Learn how to write the content of your notification templates in Go’s templating language.

Create reusable notification templates for your contact points.

[Use notification templates][use-notication-templates]

Use notification templates to send notifications to your contact points.

[Reference][reference]

Data that is available when writing templates.

{{% docs/reference %}}
[reference]: "/docs/grafana/ -> /docs/grafana/<GRAFANA VERSION>/alerting/manage-notifications/template-notifications/reference"
[reference]: "/docs/grafana-cloud/ -> /docs/grafana-cloud/alerting-and-irm/alerting/manage-notifications/template-notifications/reference"

[use-notification-templates]: "/docs/grafana/ -> /docs/grafana/<GRAFANA VERSION>/alerting/manage-notifications/template-notifications/use-notification-templates"
[use-notification-templates]: "/docs/grafana-cloud/ -> /docs/grafana-cloud/alerting-and-irm/alerting/manage-notifications/template-notifications/use-notification-templates"

[using-go-templating-language]: "/docs/grafana/ -> /docs/grafana/<GRAFANA VERSION>/alerting/manage-notifications/template-notifications/using-go-templating-language"
[using-go-templating-language]: "/docs/grafana-cloud/ -> /docs/grafana-cloud/alerting-and-irm/alerting/manage-notifications/template-notifications/using-go-templating-language"
{{% /docs/reference %}}
