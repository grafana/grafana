---
aliases:
keywords:
  - grafana
  - alerting
  - notifications
  - templates
title: Template notifications
weight: 100
---

# Template notifications

You customize your notifications with message templates. Message templates can be used to change the title, message, and format of the message in notifications. Message templates are not tied to specific contact point integrations, such as email and Slack. However, you can choose to create separate message templates for different integrations if you prefer. Your message templates should be general rather than written for a specific alert as contact points can receive all different kinds of alerts. You can find examples of this in [Create message templates]({{< relref "./create-message-templates" >}}).

You can use message templates to:

- Add, remove, or re-order information in the notification including the summary, description, labels and annotations, values, and links
- Format text in bold and italic, and add or remove line breaks

You cannot use message templates to:

- Change how images are included in notifications, such as the number of images in each notification or where in the notification inline images are shown
- Change the design of notifications in instant messaging services such as Slack and Microsoft Teams
- Change the data in webhook notifications, including the structure of the JSON request or sending data in other formats such as XML
- Add or remove HTTP headers in webhook notifications other than those in the contact point configuration

[Using Go's templating language]({{< relref "./using-go-templating-language" >}})

Write the content of your templates in Go’s templating language

[Create message templates]({{< relref "./create-message-templates" >}})

Create reusable templates for your contact points

[Use message templates]({{< relref "./use-message-templates" >}})

Use the templates in contact points to customize your notifications

[Reference]({{< relref "./reference" >}})

The data available when writing templates
