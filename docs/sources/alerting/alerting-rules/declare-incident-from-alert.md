---
aliases:
description: Declare an incident from a firing alert
keywords:
  - grafana
  - alert rules
  - incident
title: Declare an incident from a firing alert
weight: 430
---

# Declare incidents from firing alerts

Declare an incident from a firing alert to streamline your alert to incident workflow.

## Before you begin

- Ensure you have Grafana Incident installed
- You must have a firing alert

## Procedure

To declare an incident from a firing alert, complete the following steps.

1. Navigate to Alerts & Incidents -> Alerting -> Alert rules.
2. From the Alert rules list view, click the firing alert that you want to declare an incident for.

   **Note:**

   You can also access **Declare Incident** from the alert details page.

3. Click **Declare Incident**.
   The **Declare Incident** pop-up opens in the Grafana Incident application.
4. In the **Declare Incident** pop-up, enter what's going on.

   **Note**: This field is pre-filled with the name of the alert rule, but you can edit it as required.

   The alert rule is also linked to the incident.

5. Select a severity.
6. Add labels, as required.
7. Click **More options** to include a channel prefix and status.
8. Click **Declare Incident**.

## Next steps

View and track the incident in the Grafana Incident application.

For more information, refer to [Grafana Incident documentation.](https://grafana.com/docs/grafana-cloud/incident/configure-settings/)
