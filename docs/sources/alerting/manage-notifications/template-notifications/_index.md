---
aliases:
keywords:
  - grafana
  - alerting
  - notifications
  - templates
title: Customize notifications
weight: 100
---

# Customize notifications

Customize your notifications using message templates, so you don't have to create notifications from scratch each time. You can use message templates to change the title, message, and format of the message in your notifications.

Message templates are not tied to specific contact point integrations, such as email or Slack. However, you can choose to create separate message templates for different contact point integrations.

You can use message templates to:

- Add, remove, or re-order information in the notification including the summary, description, labels and annotations, values, and links
- Format text in bold and italic, and add or remove line breaks

You cannot use message templates to:

- Change how images are included in notifications, such as the number of images in each notification or where in the notification inline images are shown
- Change the design of notifications in instant messaging services such as Slack and Microsoft Teams
- Change the data in webhook notifications, including the structure of the JSON request or sending data in other formats such as XML
- Add or remove HTTP headers in webhook notifications other than those in the contact point configuration

[Using Go's templating language]({{< relref "./using-go-templating-language" >}})

Learn how to write the content of your message templates in Go’s templating language.

[Create message templates]({{< relref "./create-message-templates" >}})

Create reusable message templates for your contact points.

[Use message templates]({{< relref "./use-message-templates" >}})

Use message templates to send notifications to your contact points.

[Reference]({{< relref "./reference" >}})

Data that is available when writing templates.
