---
aliases:
  - ../../manage-notifications/template-notifications/use-notification-templates/ # /docs/grafana/latest/alerting/manage-notifications/template-notifications/use-notification-templates/
canonical: https://grafana.com/docs/grafana/latest/alerting/configure-notifications/template-notifications/use-notification-templates/
description: Use notification templates in contact points to customize your notifications
keywords:
  - grafana
  - alerting
  - notifications
  - templates
  - use templates
labels:
  products:
    - cloud
    - enterprise
    - oss
title: Use notification templates
weight: 300
---

# Use notification templates

Use templates in contact points to customize your notifications.

In the Contact points tab, you can see a list of your contact points.

1. To create a new contact point, click New.

   **Note:** You can edit an existing contact by clicking the Edit icon.

1. Execute a template from one or more fields such as Message and Subject:

   {{< figure max-width="940px" src="/static/img/docs/alerting/unified/use-notification-template-9-4.png" caption="Use notification template" >}}

   For more information on how to write and execute templates, refer to [Using Go's templating language][using-go-templating-language] and [Create notification templates][create-notification-templates].

1. Click **Save contact point**.

{{% docs/reference %}}
[create-notification-templates]: "/docs/grafana/ -> /docs/grafana/<GRAFANA_VERSION>/alerting/configure-notifications/template-notifications/create-notification-templates"
[create-notification-templates]: "/docs/grafana-cloud/ -> /docs/grafana-cloud/alerting-and-irm/alerting/configure-notifications/template-notifications/create-notification-templates"

[using-go-templating-language]: "/docs/grafana/ -> /docs/grafana/<GRAFANA_VERSION>/alerting/configure-notifications/template-notifications/using-go-templating-language"
[using-go-templating-language]: "/docs/grafana-cloud/ -> /docs/grafana-cloud/alerting-and-irm/alerting/configure-notifications/template-notifications/using-go-templating-language"
{{% /docs/reference %}}
