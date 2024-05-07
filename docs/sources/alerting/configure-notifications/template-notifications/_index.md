---
aliases:
  - ../manage-notifications/template-notifications/ # /docs/grafana/<GRAFANA_VERSION>/alerting/manage-notifications/template-notifications/
canonical: https://grafana.com/docs/grafana/latest/alerting/configure-notifications/template-notifications/
description: Customize your notifications using notification templates
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
title: Configure notification messages
weight: 430
---

# Configure notification messages

Customize the content of your notifications with notifications templates.

You can use notification templates to change the title, message, and format of the message in your notifications.

Notification templates are not tied to specific contact point integrations, such as email or Slack. However, you can choose to create separate notification templates for different contact point integrations.

You can use notification templates to:

- Customize content: Personalize the subject of an email or the title of a message. Modify text within notifications, like selecting or omitting certain labels, annotations, and links. Format text with bold and italic styles, and add or remove line breaks.

However, there are limitations. You cannot:

- Modify Visual Appearance: Add HTML and CSS to email notifications for visual changes. Alter the design of notifications in messaging services like Slack and Microsoft Teams, such as adding custom blocks or adaptive cards.
- Manage Media and Data: Adjust the number and size of images or their placement in notifications. Customize webhook data structure or format, including JSON fields or sending data in XML. Modify HTTP headers in webhooks beyond those in the contact point configuration.

## Learn more

[Using Go's templating language][using-go-templating-language]

Learn how to write the content of your notification templates in Go’s templating language.

Create reusable notification templates for your contact points.

[Use notification templates][use-notification-templates]

Use notification templates to send notifications to your contact points.

[Reference][reference]

Data that is available when writing templates.

{{% docs/reference %}}
[reference]: "/docs/grafana/ -> /docs/grafana/<GRAFANA_VERSION>/alerting/configure-notifications/template-notifications/reference"
[reference]: "/docs/grafana-cloud/ -> /docs/grafana-cloud/alerting-and-irm/alerting/configure-notifications/template-notifications/reference"

[use-notification-templates]: "/docs/grafana/ -> /docs/grafana/<GRAFANA_VERSION>/alerting/configure-notifications/template-notifications/use-notification-templates"
[use-notification-templates]: "/docs/grafana-cloud/ -> /docs/grafana-cloud/alerting-and-irm/alerting/configure-notifications/template-notifications/use-notification-templates"

[using-go-templating-language]: "/docs/grafana/ -> /docs/grafana/<GRAFANA_VERSION>/alerting/configure-notifications/template-notifications/using-go-templating-language"
[using-go-templating-language]: "/docs/grafana-cloud/ -> /docs/grafana-cloud/alerting-and-irm/alerting/configure-notifications/template-notifications/using-go-templating-language"
{{% /docs/reference %}}
