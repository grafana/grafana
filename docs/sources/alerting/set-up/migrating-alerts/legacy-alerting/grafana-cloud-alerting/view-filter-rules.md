---
aliases:
  - /docs/grafana-cloud/alerts/grafana-cloud-alerting/view-filter-rules/
  - /docs/grafana-cloud/how-do-i/grafana-cloud-alerting/view-filter-alerts/
  - /docs/grafana-cloud/legacy-alerting/grafana-cloud-alerting/view-filter-rules/
description: View and filter alert rules
title: View and filter alert rules
weight: 300
---

# View and filter alert rules

Grafana Cloud Alerting displays a list of all recording and alerting rules assigned to a selected data source in the Alerts and rules tab.

All members of an organization that have access to a particular data source can view the list of rules and filter or reorder their view.

## View alert rules

1. Hover your cursor over the **Grafana Cloud Alerting** icon (alarm bell with Prometheus logo) and then click **Alerts and rules**.
1. In the list at the top of the tab, select the data source for which you want to view rules.

Grafana displays rules according to rule groups. If your instance has added namespaces and alert groups, then they will be ordered alphabetically. Otherwise, you will have one namespace called `default` and an alert group called `rules`.

If an alert is firing, then click the down carrot arrow to see additional information. The Label and annotations section appears.

## Filter your alert rule view

You can control which alerts you see and in what order they appear several ways. Combine different filters to personalize your view so that you can quickly find the information that you need.

- **Filter by alert state -** Click the toggles to show or hide alerts in different states. Turn off the toggle to hide alerts matching the state.
- **Filter by rule type -** Click the toggles to show or hide alerting rules or recording rules.
- **View options -** Click the toggle to show or hide the Prometheus annotations shown in the Labels and annotations section.
- **Rule sorting -** Click an option to sort alert rules within each rule group.
  - **None -** No special sort is applied and sorts as if in a file, ordered according to the editing list order.
  - **A-Z -** Sorts rules alphabetically according to the rule name.
  - **Alert state -** Sorts rules according to the alert state (Firing, Pending, or Inactive).

## View alert in Explore

Click **View in Explore** or click the `expr` link to open the `expr` in [Explore](/docs/grafana/latest/explore/).

> **Note:** Only users with Admin or Editor roles in an organization can use the Explore feature unless the viewers can edit.
