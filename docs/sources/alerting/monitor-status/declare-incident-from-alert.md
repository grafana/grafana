---
aliases:
  - ../../alerting/alerting-rules/declare-incident-from-alert/ # /docs/grafana/<GRAFANA_VERSION>/alerting/alerting-rules/declare-incident-from-alert/
  - ../../alerting/manage-notifications/declare-incident-from-alert/ # /docs/grafana/<GRAFANA_VERSION>/alerting/manage-notifications/declare-incident-from-alert/
canonical: https://grafana.com/docs/grafana/latest/alerting/monitor-status/declare-incident-from-alert/
description: Declare an incident from a firing alert
keywords:
  - grafana
  - alert rules
  - incident
labels:
  products:
    - cloud
title: Declare incidents from firing alerts
weight: 1010
---

# Declare incidents from firing alerts

Declare an incident from a firing alert to streamline your alert to incident workflow.

## Before you begin

- Ensure you have [Grafana Incident](/docs/grafana-cloud/incident/) installed.
- You must have a firing alert.

## Procedure

To declare an incident from a firing alert, complete the following steps.

1. Navigate to **Alerts & IRM** -> **Alerting** -> **Alert rules**.
1. From the Alert rules page, click the **Firing** filter to display firing alerts. Find the firing alert that you want to declare an incident for.
1. Click **More** -> **Declare Incident**.

   Alternatively, you can declare an incident from the Alert details page.

   The **Declare Incident** pop-up opens in the Grafana Incident application.

1. In the **Declare Incident** pop-up, enter the **What's going on?** field.

   This field is pre-filled with the name of the alert rule, but you can edit it as required.

   The alert rule is also linked to the incident.

1. Select a severity.
1. Add labels, as required.
1. Click **More options** to include a channel prefix and status.
1. Click **Automated options** to enable automated actions configured by admins.
1. Click **Declare Incident**.

## Next steps

View and manage the incident in the **Grafana Incident** application.

{{< figure src="/media/docs/alerting/incident-response-management-timeline-ui.png" max-width="750px" alt="Incident timeline view in Grafana Incident" >}}

For more information, refer to the [Grafana Incident documentation](/docs/grafana-cloud/incident/configure-settings/).
