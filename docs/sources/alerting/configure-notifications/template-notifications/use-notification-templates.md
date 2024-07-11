---
aliases:
  - ../../manage-notifications/template-notifications/use-notification-templates/ # /docs/grafana/<GRAFANA_VERSION>/alerting/manage-notifications/template-notifications/use-notification-templates/
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
refs:
  create-notification-templates:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/alerting/configure-notifications/template-notifications/create-notification-templates/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/alerting-and-irm/alerting/configure-notifications/template-notifications/create-notification-templates/
  using-go-templating-language:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/alerting/configure-notifications/template-notifications/using-go-templating-language/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/alerting-and-irm/alerting/configure-notifications/template-notifications/using-go-templating-language/
---

# Use notification templates

Use templates in contact points to customize your notifications.

Complete the following steps to add templates to your contact point.

1. Click an existing contact point or create a new one
1. In **Optional settings**, click any field that contains templates.

   For example, if you are creating an email contact point integration, click **Message** or **Subject**.

1. Click **Edit**.
   A dialog box opens where you can select templates.
1. Click **Select existing template** to select a template and preview it using the default payload.

   You can also copy the selected template and use it in the custom tab.

1. Click **Enter custom message** to customize and edit the field directly. Note that the title changes depending on the field you are editing.

1. You can switch between the two tabs to access the list of available templates and copy them across to the customized version.

1. Click **Save contact point**.
