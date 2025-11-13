---
canonical: https://grafana.com/docs/grafana/latest/alerting/monitor-status/alert-triage/
title: Alert triage view
description: Use the Alert triage view to assess, prioritize, and take action on alerts quickly in Grafana Cloud.
weight: 405
keywords:
  - Grafana Cloud
  - alerting
  - triage
  - incidents
  - monitoring
  - Grafana-managed alerts
---

# Alert triage view

Grafana provides a consolidated view of your Grafana-managed alerts in a simplified triage view. For users with complex deployments, it can be difficult to monitor and prioritize critical incidents among a large volume of firing or pending alerts. With the Alert triage page, you have a view where you can quickly explore and sort your recent alert history and see what alerts have been firing or are pending. 

To see your alerts in the triage view, go to **Alerts & IRM > Alerting > Alerts**. 

## How it works

The triage view only shows alerts from Grafana-managed alert rules. Grafana uses a metric called `GRAFANA_ALERTS`, which is recorded in the default Mimir data source that is provisioned for cloud users. 

{{< admonition type="note" >}}
OSS users need to manually configure this. To configure alert state history for OSS, refer to the <a href="https://grafana.com/docs/grafana/latest/alerting/set-up/configure-alert-state-history/#configure-loki-and-prometheus-for-alert-state">configure Loki and Prometheus for alert state</a> documentation.
{{< /admonition >}}

## Filter alerts in the triage view

The page displays the count of alert rules and instances that are both firing and pending. Use the filters to group your alerts and find specific alerts by label.

To group alerts by label, click the **Group by** field and select the labels from the dropdown menu. You can select multiple labels for alert grouping.

To filter by specific label values, click the **Filters** field and select label you to filter by, followed by an expression of what label value you want to use. You can enter multiple label values in your search.

You can also select a time range from the time picker to further adjust your results. Click the **time range** field and enter an absolute time range or select a period from the quick ranges list to apply a new time window to the display results.

