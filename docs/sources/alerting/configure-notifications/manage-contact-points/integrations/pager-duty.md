---
aliases:
  - ../../../alerting-rules/manage-contact-points/integrations/pager-duty/ # /docs/grafana/<GRAFANA_VERSION>/alerting/alerting-rules/manage-contact-points/integrations/pager-duty/
canonical: https://grafana.com/docs/grafana/latest/alerting/configure-notifications/manage-contact-points/integrations/pager-duty/
description: Configure the PagerDuty integration for Alerting
keywords:
  - grafana
  - alerting
  - pagerduty
labels:
  products:
    - cloud
    - enterprise
    - oss
menuTitle: PagerDuty
title: Configure PagerDuty for Alerting
weight: 400
---

# Configure PagerDuty for Alerting

Use the Grafana Alerting - PagerDuty integration to receive notifications in PagerDuty when your alerts are firing.

## Before you begin

To set up PagerDuty for integration with Grafana Alerting, you need to create a [PagerDuty](https://www.pagerduty.com/) account. There are several set up steps to perform within PagerDuty before you set up the integration in Grafana Alerting.

### Create a Service

In PagerDuty, a service represents a component, microservice, or infrastructure element that a team oversees, manages, and monitors.

1. Refer to [PagerDuty’s services and integrations guide](https://support.pagerduty.com/docs/services-and-integrations#create-a-service).

1. Follow steps 1 to 5 under **Create a Service**.

{{< admonition type="note" >}}
In step 5, choose **Create a service without an integration**.
{{< /admonition >}}

### Obtain a PagerDuty integration key

1. Once the service is created, click **Integrations** within the Service options.
1. Click **+ Add an integration**.
1. Select **Events API V2**.
1. Click **Add**.
1. Click the drop-down arrow to display the integration details.
1. Copy the **Integration Key**.

## Procedure

To create your PagerDuty integration in Grafana Alerting, complete the following steps.

1. Navigate to **Alerts & IRM** -> **Alerting** -> **Contact points**.
1. Click **+ Add contact point**.
1. Enter a contact point name.
1. From the Integration list, select **PagerDuty**.
1. In the **Integration Key** field, copy in your integration key.
1. Click **Test** to check that your integration works.

   An incident should display in the Service’s Activity tab in PagerDuty.

1. Click **Save contact point**.

## Next steps

To add the contact point and integration you created to your default notification policy, complete the following steps.

1. Navigate to **Alerts & IRM** -> **Alerting** -> **Notification policies**.
1. In the Default policy, click the ellipsis icon (…) and then **Edit**.
1. Change the default policy to the contact point you created.
1. Click **Update default policy**.

{{< admonition type="note" >}} If you have more than one contact point, add a new notification policy rather than edit the default one, so you can route specific alerts to PagerDuty. {{< /admonition >}}
