---
canonical: https://grafana.com/docs/grafana/latest/alerting/configure-notifications/manage-contact-points/integrations/configure-alertmanager/
description: Use the Alertmanager integration in a contact point to send specific alerts to a different Alertmanager.
keywords:
  - grafana
  - alerting
  - Alertmanager
  - integration
labels:
  products:
    - cloud
    - enterprise
    - oss
menuTitle: Alertmanager
title: Configure an Alertmanager contact point
weight: 100
refs:
  configure-contact-points:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/alerting/configure-notifications/manage-contact-points/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/alerting-and-irm/alerting/configure-notifications/manage-contact-points/
  configure-alertmanagers:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/alerting/configure-notifications/manage-contact-points/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/alerting-and-irm/alerting/configure-notifications/manage-contact-points/
---

# Configure an Alertmanager contact point

Use the Alertmanager integration in a contact point to send specific alerts to a different Alertmanager.

If you have an existing Alertmanager running in your infrastructure, you can use a contact point to forward Grafana alerts to your Alertmanager.

For example, a team might run its own Alertmanager to manage notifications from other alerting systems. That team can create alerts with Grafana and configure an Alertmanager contact point to forward only their alerts to their existing Alertmanager.

This setup avoids duplicating Alertmanager configurations for better maintenance.

{{% admonition type="note" %}}
To send all Grafana-managed alerts to an Alertmanager, add it as a data source and enable it to receive all alerts. With this setup, you can configure multiple Alertmanagers to receive all alerts.

For setup instructions, refer to [Configure Alertmanagers](ref:configure-alertmanagers).
{{% /admonition %}}

## Configure an Alertmanager for a contact point

To create a contact point with Alertmanager integration, complete the following steps.

1. Navigate to **Alerts & IRM** -> **Alerting** -> **Contact points**.
1. Click **+ Add contact point**.
1. Enter a name for the contact point.
1. From the **Integration** list, select **Alertmanager**.
1. In the **URL** field, enter the URL of the Alertmanager.
1. (Optional) Configure [optional settings](#optional-settings).
1. Click **Save contact point**.

For more details on contact points, including how to test them and enable notifications, refer to [Configure contact points](ref:configure-contact-points).

## Alertmanager settings

| Option | Description           |
| ------ | --------------------- |
| URL    | The Alertmanager URL. |

#### Optional settings

| Option              | Description                             |
| ------------------- | --------------------------------------- |
| Basic Auth User     | Username for HTTP Basic Authentication. |
| Basic Auth Password | Password for HTTP Basic Authentication. |

#### Optional notification settings

| Option                   | Description                                                         |
| ------------------------ | ------------------------------------------------------------------- |
| Disable resolved message | Enable this option to prevent notifications when an alert resolves. |
