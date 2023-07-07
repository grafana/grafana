---
aliases:
  - /docs/grafana-cloud/alerts/grafana-cloud-alerting/create-edit-rules/
  - /docs/grafana-cloud/how-do-i/grafana-cloud-alerting/create-edit-rules/
  - /docs/grafana-cloud/legacy-alerting/grafana-cloud-alerting/create-edit-rules/
description: Create and edit alert rules
title: Create and edit alert rules
weight: 200
---

# Create and edit alert rules

Creating alerts in Grafana Cloud differs from creating alerts directly with Prometheus or Loki. While the rule format is the same, everything is done in the Grafana Cloud Alerting interface, rather than with configuration files.

{{% admonition type="note" %}}
Only organization Admins can create or edit alert rules.
{{% /admonition %}}

## Create an alert rule

1. In Grafana, hover your cursor over the **Grafana Cloud Alerting** icon and then click **Alerts and rules**.
1. If you have more than one Prometheus or Loki data source, there will be a dropdown at the top for you to select the data source to create or edit rules.
1. Click **Edit rules**.
1. Click **Add rule**.

Grafana creates a new rule with placeholders.

```
alert: ""
expr: ""
```

Enter text according to regular Prometheus rule configuration guidelines:

- [Recording rules](https://prometheus.io/docs/prometheus/latest/configuration/recording_rules/)
- [Alerting rules](https://prometheus.io/docs/prometheus/latest/configuration/alerting_rules/)

{{% admonition type="note" %}}
Grafana Cloud Alerting does not support comments.
{{% /admonition %}}

When you are finished, click **Save**. You can then repeat the process to create more rules or click **Finish editing** to return to the rules list.

## Edit an alert rule

1. In Grafana, hover your cursor over the **Grafana Cloud Alerting** icon and then click **Alerts and rules**.
1. If you have more than one Prometheus or Loki data source, there will be a dropdown at the top for you to select the data source to create or edit rules.
1. Click **Edit rules**.
1. Scroll down to the rule that you want to edit and then click **Edit**.
1. Make any necessary changes to the rule text and then click **Save**.
1. Click **Finish editing** to return to the rules list.

## Delete an alert rule

1. In Grafana, hover your cursor over the **Grafana Cloud Alerting** icon and then click **Alerts and rules**.
1. If you have more than one Prometheus or Loki data source, there will be a dropdown at the top for you to select the data source to create or edit rules.
1. Click **Edit rules**.
1. Scroll down to the rule that you want to edit and then click **Delete**.
1. Click **Finish editing** to return to the rules list.
