---
aliases:
  - ../../unified-alerting/alerting-rules/create-mimir-loki-managed-rule/ # /docs/grafana/<GRAFANA_VERSION>/alerting/unified-alerting/alerting-rules/create-mimir-loki-managed-rule/
  - ../../unified-alerting/alerting-rules/edit-cortex-loki-namespace-group/ # /docs/grafana/<GRAFANA_VERSION>/alerting/unified-alerting/alerting-rules/edit-cortex-loki-namespace-group/
  - ../../unified-alerting/alerting-rules/edit-mimir-loki-namespace-group/ # /docs/grafana/<GRAFANA_VERSION>/alerting/unified-alerting/alerting-rules/edit-mimir-loki-namespace-group/
  - ../../alerting-rules/create-mimir-loki-managed-rule/ # /docs/grafana/<GRAFANA_VERSION>/alerting/alerting-rules/create-mimir-loki-managed-rule/
  - ../../alerting-rules/create-data-source-managed-rule/ # /docs/grafana/<GRAFANA_VERSION>/alerting/alerting-rules/create-data-source-managed-rule/
canonical: https://grafana.com/docs/grafana/latest/alerting/set-up/data-source-managed-alerts/create-data-source-managed-rule/
description: Configure data source-managed alert rules for an external Grafana Mimir or Loki instance
keywords:
  - grafana
  - alerting
  - guide
  - rules
  - create
  - data source-managed
labels:
  products:
    - cloud
    - enterprise
    - oss
menuTitle: Data source-managed alert rules
title: Configure data source-managed alert rules
weight: 100
---

# Configure data source-managed alert rules

Data source-managed alert rules are alert rules that are stored in the data source, such as in Prometheus or Loki, rather than in Grafana.

{{< admonition type="caution" >}}
Support for data source-managed alert rules in the Grafana Alerting UI is legacy functionality, and data source-managed alerts for the default Grafana Cloud data sources are deprecated. For details and alternatives, including the [Prometheus Alerting](/docs/plugins/grafana-prometheusalerting-app/latest/) app plugin, refer to [Legacy data source-managed alerts](/docs/grafana/<GRAFANA_VERSION>/alerting/set-up/data-source-managed-alerts/).
{{< /admonition >}}

{{< admonition type="note" >}}
The steps on this page don't apply when the [Prometheus Alerting](/docs/plugins/grafana-prometheusalerting-app/latest/) app plugin is installed and enabled. In that case, you create and manage data source-managed alert rules in the plugin. Refer to [Create an alert rule](/docs/plugins/grafana-prometheusalerting-app/latest/alerting-rules/create-alert-rule/) in the plugin documentation, and to [When the Prometheus Alerting plugin is installed](/docs/grafana/<GRAFANA_VERSION>/alerting/set-up/data-source-managed-alerts/#when-the-prometheus-alerting-plugin-is-installed).
{{< /admonition >}}

In Grafana Alerting, you can:

1. Create and edit data source-managed rules for Grafana Mimir and Grafana Loki data sources.
1. View rules from Prometheus data sources when [Manage alerts via Alerting UI](/docs/grafana/<GRAFANA_VERSION>/datasources/prometheus/configure/) is enabled. However, you cannot create or edit these rules in Grafana.
1. [Import data source-managed rules](/docs/grafana/<GRAFANA_VERSION>/alerting/set-up/data-source-managed-alerts/alerting-migration/) from Loki, Mimir, and Prometheus into Grafana-managed rules.

{{< admonition type="note" >}}
Data source-managed rules are supported for horizontal scalability, but they can introduce more operational complexity than Grafana-managed alert rules.

We recommend using [Grafana-managed alert rules](/docs/grafana/<GRAFANA_VERSION>/alerting/alerting-rules/create-grafana-managed-rule/) whenever possible, as they provide a richer feature set and better integration with the full Grafana Alerting workflow.
{{< /admonition >}}

## Comparison with Grafana-managed rules

The table below compares Grafana-managed and data source-managed alert rules.

| <div style="width:200px">Feature</div>                                                                                                                                                                                                                                                                | <div style="width:200px">Grafana-managed alert rule</div>                                                                  | <div style="width:200px">Data source-managed alert rule                           |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| Supported data sources                                                                                                                                                                                                                                                                                | All backend data sources enabling the [`alerting` option](/docs/grafana/<GRAFANA_VERSION>/alerting/set-up/configure-rbac/) | Only supports creating rules for Mimir and Loki data sources                      |
| Mix and match data sources                                                                                                                                                                                                                                                                            | Yes                                                                                                                        | No                                                                                |
| Add [expressions](/docs/grafana/<GRAFANA_VERSION>/alerting/fundamentals/alert-rules/queries-conditions/#advanced-options-expressions) to transform<wbr /> your data and set [alert conditions](/docs/grafana/<GRAFANA_VERSION>/alerting/fundamentals/alert-rules/queries-conditions/#alert-condition) | Yes                                                                                                                        | No                                                                                |
| [No data and error states](/docs/grafana/<GRAFANA_VERSION>/alerting/fundamentals/alert-rule-evaluation/nodata-and-error-states/)                                                                                                                                                                      | Yes                                                                                                                        | No                                                                                |
| [Stale alert instances](/docs/grafana/<GRAFANA_VERSION>/alerting/fundamentals/alert-rule-evaluation/stale-alert-instances/)                                                                                                                                                                           | Yes                                                                                                                        | No                                                                                |
| [Images in alert notifications](/docs/grafana/<GRAFANA_VERSION>/alerting/configure-notifications/template-notifications/images-in-notifications/)                                                                                                                                                     | Yes                                                                                                                        | No                                                                                |
| [Role-based access control](/docs/grafana/<GRAFANA_VERSION>/alerting/set-up/configure-rbac/)                                                                                                                                                                                                          | Yes                                                                                                                        | No                                                                                |
| [Alert state history](/docs/grafana/<GRAFANA_VERSION>/alerting/monitor-status/view-alert-state-history/)                                                                                                                                                                                              | Yes                                                                                                                        | No                                                                                |
| [Alert version history](/docs/grafana/<GRAFANA_VERSION>/alerting/monitor-status/view-alert-rules/#view-compare-and-restore-alert-rules-versions)                                                                                                                                                      | Yes                                                                                                                        | No                                                                                |
| [Terraform provisioning](/docs/grafana/<GRAFANA_VERSION>/alerting/set-up/provision-alerting-resources/terraform-provisioning/)                                                                                                                                                                        | Yes                                                                                                                        | No                                                                                |
| [Recording rules](/docs/grafana/<GRAFANA_VERSION>/alerting/alerting-rules/create-recording-rules/)                                                                                                                                                                                                    | Yes                                                                                                                        | Yes                                                                               |
| Organization                                                                                                                                                                                                                                                                                          | Organize and manage access with folders                                                                                    | Use namespaces                                                                    |
| Alert rule evaluation                                                                                                                                                                                                                                                                                 | Alert evaluation is done in Grafana                                                                                        | Alert rule evaluation is done in the data source and allow for horizontal scaling |
| Scaling                                                                                                                                                                                                                                                                                               | Alert rules are stored in the Grafana database.                                                                            | Alert rules are stored within the data source and allow for horizontal scaling    |

The following diagram shows the architecture of a Mimir setup that uses data source-managed alert rules.

{{< figure src="/media/docs/alerting/mimir-managed-alerting-architecture-v2.png" max-width="750px" alt="Data source-managed alerting architecture based on Grafana Mimir" >}}

## Create data source-managed alert rules

To create or edit data source-managed alert rules, follow these instructions.

### Before you begin

Verify that you have write permission to the Mimir or Loki data source. Otherwise, you cannot create or update data source-managed alert rules.

#### Enable the Ruler API

For more information, refer to the [Mimir Ruler API](/docs/mimir/latest/references/http-api/#ruler) or [Loki Ruler API](/docs/loki/latest/api/#ruler).

- **Mimir** - use the `/prometheus` prefix. The Prometheus data source supports both Grafana Mimir and Prometheus, and Grafana expects that both the [Query API](/docs/mimir/latest/operators-guide/reference-http-api/#querier--query-frontend) and [Ruler API](/docs/mimir/latest/operators-guide/reference-http-api/#ruler) are under the same URL. You cannot provide a separate URL for the Ruler API.

- **Loki** - The `local` rule storage type, default for the Loki data source, supports only viewing of rules. To edit rules, configure one of the other rule storage types.

#### Permissions

Alert rules for Mimir or Loki instances can be edited or deleted by users with **Editor** or **Admin** roles.

If you do not want to manage alert rules for a particular data source, go to its settings and clear the **Manage alerts via Alerting UI** checkbox.

### Set alert rule name

{{< docs/shared lookup="alerts/configure-alert-rule-name.md" source="grafana" version="<GRAFANA_VERSION>" >}}

### Define query and condition

Define a query to get the data you want to measure and a condition that needs to be met before an alert rule fires.

{{< admonition type="note" >}}
By default, new alert rules are Grafana-managed. To switch to **Data source-managed**, follow these instructions.
{{< /admonition >}}

1. Select a Prometheus-based data source from the drop-down list.

   You can also click **Open advanced data source picker** to find more options.

1. Enter a PromQL or LogQL query, including the alert condition.
1. In the **Rule type** option, select **Data source-managed**.
1. Click **Preview alerts**.

### Set alert evaluation behavior

Use [alert rule evaluation](/docs/grafana/<GRAFANA_VERSION>/alerting/fundamentals/alert-rule-evaluation/) to determine how frequently an alert rule should be evaluated and how quickly it should change its state.

1. Select a namespace or click **+ New namespace**.
1. Select an evaluation group or click **+ New evaluation group**.

   If you are creating a new evaluation group, specify the interval for the group.

   All rules within the same group are evaluated sequentially over the same time interval. You can reorder them from the **Alert rules** page.

1. Enter a pending period.

   The [pending period](/docs/grafana/<GRAFANA_VERSION>/alerting/fundamentals/alert-rule-evaluation/#pending-period) is the period in which an alert rule can be in breach of the condition until it fires.

   After a condition is met, the alert goes into the **Pending** state. If the condition remains active for the duration specified, the alert transitions to the **Firing** state, else it reverts to the **Normal** state.

### Configure labels and notifications

Add [labels](/docs/grafana/<GRAFANA_VERSION>/alerting/fundamentals/alert-rules/annotation-label/#labels) to your alert rules to set which [notification policy](/docs/grafana/<GRAFANA_VERSION>/alerting/fundamentals/notifications/notification-policies/) should handle your firing alert instances.

The Alertmanager configured for the data source handles the notifications for data source-managed alert rules, not the Grafana Alertmanager. To manage its notification policies and contact points in Grafana, refer to [Manage notification resources in other Alertmanagers](/docs/grafana/<GRAFANA_VERSION>/alerting/set-up/data-source-managed-alerts/manage-alertmanager-resources/).

All alert rules and instances, irrespective of their labels, match the default notification policy. If there are no nested policies, or no nested policies match the labels in the alert rule or alert instance, then the default notification policy is the matching policy.

1. Add labels if you want to change the way your notifications are routed.

   Add custom labels by selecting existing key-value pairs from the drop down, or add new labels by entering the new key or value.

### Configure notification message

Use [annotations](/docs/grafana/<GRAFANA_VERSION>/alerting/fundamentals/alert-rules/annotation-label/#annotations) to add information to alert messages that can help respond to the alert.

Annotations are included by default in notification messages, and can use text or [templates](/docs/grafana/<GRAFANA_VERSION>/alerting/alerting-rules/templates/) to display dynamic data from queries.

Grafana provides several optional annotations.

1. Optional: Add a summary.

   Short summary of what happened and why.

1. Optional: Add a description.

   Description of what the alert rule does.

1. Optional: Add a Runbook URL.

   Webpage where you keep your runbook for the alert

1. Optional: Add a custom annotation.

   Add any additional information that could help address the alert.

1. Optional: **Link dashboard and panel**.

   [Link the alert rule to a panel](/docs/grafana/<GRAFANA_VERSION>/alerting/alerting-rules/link-alert-rules-to-panels/) to facilitate alert investigation.

1. Click **Save rule**.

[//]: <> ({{< docs/shared lookup="alerts/configure-notification-message.md" source="grafana" version="<GRAFANA_VERSION>" >}})
