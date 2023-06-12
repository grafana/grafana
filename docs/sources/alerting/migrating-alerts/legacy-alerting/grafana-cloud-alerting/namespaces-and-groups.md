---
aliases:
  - /docs/grafana-cloud/alerts/grafana-cloud-alerting/namespaces-and-groups/
  - /docs/grafana-cloud/how-do-i/grafana-cloud-alerting/namespaces-and-groups/
  - /docs/grafana-cloud/legacy-alerting/grafana-cloud-alerting/namespaces-and-groups/
description: Namespaces and rule groups
title: Namespaces and rule groups
weight: 400
---

# Namespaces and rule groups

By default, all alerting and recording rules created in Grafana Cloud Alerting will default to a single namespace and a single rule group.

## Managing namespaces

While Grafana Cloud Alerting does support viewing multiple namespaces that have been added through the mimirtool, it is currently not possible to add new namespaces or to rename the existing ones.

## Managing rule groups

Rule groups can be managed directly within the Grafana Cloud Alerting interface or through the mimirtool, similar to managing namespaces.

{{% admonition type="note" %}}
By default, Grafana Cloud limits the number of rule groups to 20, with a limit of up to 15 rules per group. If you wish to increase the default limits, please [open a support ticket](/profile/org#support) or reach out to your account manager.
{{% /admonition %}}

### Create a new rule group:

1. In Grafana, hover your cursor over the **Grafana Cloud Alerting** icon and then click **Alerts and rules**.
2. If you have more than one Prometheus or Loki data source, there will be a dropdown at the top for you to select the data source to create or edit rules.
3. Click **Create new rule group**.
4. Enter text to name your new rule group.
5. Enter text for the new rule in your new rule group, according to regular Prometheus rule configuration guidelines:

- [Recording rules](https://prometheus.io/docs/prometheus/latest/configuration/recording_rules/)
- [Alerting rules](https://prometheus.io/docs/prometheus/latest/configuration/alerting_rules/)

6. When you are finished naming your new rule group and adding new rule details, click **Save**.

{{% admonition type="note" %}}
In order to create a new rule group, you must also create a new rule for it.
{{% /admonition %}}

### Update a rule group

Existing rule groups can be renamed by selecting the **pencil** icon next to the rule group name.

### Delete a rule group

Rule groups will be automatically deleted once the all rules within a group are deleted.
