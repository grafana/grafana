---
aliases:
  - /docs/grafana/latest/alerting/contact-points/message-templating/
  - /docs/grafana/latest/alerting/contact-points/message-templating/create-message-template/
  - /docs/grafana/latest/alerting/message-templating/
  - /docs/grafana/latest/alerting/unified-alerting/message-templating/
  - /docs/grafana/latest/alerting/contact-points/message-templating/delete-message-template/
  - /docs/grafana/latest/alerting/contact-points/message-templating/edit-message-template/
  - /docs/grafana/latest/alerting/manage-notifications/create-message-template/
keywords:
  - grafana
  - alerting
  - guide
  - contact point
  - templating
title: Create and edit message templates
weight: 200
---

# Create and edit message templates

You can use message templates to customize notification messages for the contact point types.

To create a message template:

1. In the Grafana menu, click the **Alerting** (bell) icon to open the Alerting page listing existing alerts.
2. In the Alerting page, click **Contact points** to open the page listing existing contact points.
3. From Alertmanager drop-down, select an external Alertmanager to create and manage templates for the external data source. Otherwise, keep the default option of Grafana.
   {{< figure max-width="250px" src="/static/img/docs/alerting/unified/contact-points-select-am-8-0.gif" caption="Select Alertmanager" >}}
4. Click **Add template**.
5. In **Name**, add a descriptive name.
6. In **Content**, add the content of the template.
7. Click **Save template** button at the bottom of the page.
   <img  src="/static/img/docs/alerting/unified/templates-create-8-0.png" width="600px">

The `define` tag in the Content section assigns the template name. This tag is optional, and when omitted, the template name is derived from the **Name** field. When both are specified, it is a best practice to ensure that they are the same.

To edit a message template:

1. In the Alerting page, click **Contact points** to open the page listing existing contact points.
1. In the Template table, find the template you want to edit, then click the **Edit** (pen icon).
1. Make your changes, then click **Save template**.

To delete a message template:

1. In the Alerting page, click **Contact points** to open the page listing existing contact points.
1. In the Template table, find the template you want to delete, then click the **Delete** (trash icon).
1. In the confirmation dialog, click **Yes, delete** to delete the template.

Use caution when deleting a template since Grafana does not prevent you from deleting templates that are in use.
