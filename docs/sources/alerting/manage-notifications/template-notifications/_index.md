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

You can customize your notifications with message templates. Message templates can be used to change the title, message, and format of the message in notifications.

You can use message templates to:

- Add, remove, or re-order information in the notification including the summary, description, labels and annotations, values, and links
- Format text in bold and italic, and add or remove line breaks

You cannot use message templates to:

- Change how images are included in notifications, such as the number of images in each notification or where in the notification inline images are shown
- Change the design of notifications in instant messaging services such as Slack and Microsoft Teams
- Change the data in webhook notifications, including the structure of the JSON request or sending data in other formats such as XML
- Add or remove HTTP headers in webhook notifications other than those in the contact point configuration

## Useful links

- If looking to template labels and annotations themselves see the documentation on [Templating labels and annotations]({{< relref "../fundamentals/annotation-label/variables-label-annotation/" >}}).
