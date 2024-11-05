---
aliases:
  - ../../manage-notifications/template-notifications/create-notification-templates/ # /docs/grafana/<GRAFANA_VERSION>/alerting/manage-notifications/template-notifications/create-notification-templates/
  - ../../manage-notifications/template-notifications/use-notification-templates/ # /docs/grafana/<GRAFANA_VERSION>/alerting/manage-notifications/template-notifications/use-notification-templates/
  - ../../configure-notifications/template-notifications/use-notification-templates/ # /docs/grafana/<GRAFANA_VERSION>/alerting/manage-notifications/template-notifications/use-notification-templates/
  - ../../configure-notifications/template-notifications/create-notification-templates/ # /docs/grafana/<GRAFANA_VERSION>/alerting/manage-notifications/template-notifications/create-notification-templates/
canonical: https://grafana.com/docs/grafana/latest/alerting/configure-notifications/template-notifications/manage-notification-templates/
description: Create notification templates to sent to your contact points
keywords:
  - grafana
  - alerting
  - notifications
  - templates
  - create templates
  - edit templates
  - delete templates
labels:
  products:
    - cloud
    - enterprise
    - oss
title: Manage notification templates
menuTitle: Manage templates
weight: 101
refs:
  notification-template-reference:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/alerting/configure-notifications/template-notifications/reference/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/alerting-and-irm/alerting/configure-notifications/template-notifications/reference/
---

# Manage notification templates

In contact points, you can select notification templates to customize the notification messages sent.

By default, Grafana provides a template for the notification title (`default.title`) and a template for the notification message (`default.message`). Both default templates display common alert details.

You can also create custom templates to customize the content and format of notification messages, which can then be applied to one or more contact points.

This documentation provides step-by-step instructions for selecting templates in contact points, previewing templates, and creating custom templates using the Grafana UI.

## Select a notification template for a contact point

To add an existing notification template to your contact point, complete the following steps.

1. Click an existing contact point or create a new one.
1. In **Optional settings**, click any field that contains templates.

   For example, if you are creating an email contact point integration, click **Message** or **Subject**.

1. Click **Edit**.
   A dialog box opens where you can select templates.
1. Click **Select existing template** to select a template and [preview](#preview-a-notification-template) it using the default payload.

   You can also copy the selected template and use it in the custom tab.

1. Click **Enter custom message** to customize and edit the field directly. Note that the title changes depending on the field you are editing.

1. You can switch between the two tabs to access the list of available templates and copy them across to the customized version.

1. Click **Save contact point**.

## Create a notification template

Create notification templates to customize notification messages and reuse them in contact points.

Your notification template name must be unique. You cannot have two templates with the same name in the same notification template or in different notification templates. Avoid defining templates with the same name as default templates, such as: `__subject`, `__text_values_list`, `__text_alert_list`, `default.title` and `default.message`.

To create a notification template in Grafana, complete the following steps.

1. Click **Alerts & IRM** -> **Contact points**.
1. Click the **Notification Templates** tab and then **+ Add notification template**.

1. Enter a name for the notification template.

1. Write the content of the template in the content field.

1. Save your changes.

   If `{{ define }}` is not included in the content, `{{ define "<NOTIFICATION_TEMPLATE_NAME>" }}` and `{{ end }}` is automatically added to the start and end.

To create a notification template that contains more than one template, complete the following steps.

1. Click **+ Add notification template**.

1. Enter a name for the notification template.

1. Write each template in the Content field, including `{{ define "name-of-template" }}` and `{{ end }}` at the start and end of each template.

1. Save your changes.

For more details on how to write notification templates, refer to the [template reference](ref:notification-template-reference) and [examples](ref:notification-template-examples).

## Preview a notification template

Preview how your notification templates should look before using them in your contact points, helping you understand the result of the template you are creating as well as enabling you to fix any errors before saving it.

{{% admonition type="note" %}}
Notification template preview is only for Grafana Alertmanager.
{{% /admonition %}}

To preview your notification templates:

1. Navigate to **Alerts&IRM** -> **Alerting** -> **Contact points** -> **Notification Templates**.
1. Click **+ Add notification template** or edit an existing template.
1. Add or update your template content.

   Default data is provided and you can add or edit alert data to it as well as alert instances. You can add alert data directly in the Payload data window itself or click **Select alert instances** or **Add custom alerts**.

1. Optional: To add alert data from existing alert instances:

   a. Click **Select alert instances**.

   b. Hover over the alert instances to view more information on each alert instance.

   c. Click **Confirm** to add the alert instance(s) to the payload.

1. Optional: To add alert data using the Alert data editor, click **Add custom data:**

   a. Add annotations, custom labels and/or set a dashboard or a panel.

   b. Toggle Firing/resolved depending on whether you want to add firing or resolved alerts to your notification.

   c. Click **Add alert data**.

   d. Click **Refresh preview** to see what your template content should look like and the corresponding payload data.

   If there are any errors in your template, they are displayed in the Preview and you can correct them before saving.

1. Save your changes.
