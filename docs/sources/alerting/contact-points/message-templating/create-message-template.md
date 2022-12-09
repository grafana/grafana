---
aliases:
  - ../../message-templating/
  - ../../unified-alerting/message-templating/
  - ./
keywords:
  - grafana
  - alerting
  - guide
  - contact point
  - templating
title: Create message template
weight: 100
---

# Create a message template

You can use message templates to customize notification messages for the contact point types.

To create a message tempplate:

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
