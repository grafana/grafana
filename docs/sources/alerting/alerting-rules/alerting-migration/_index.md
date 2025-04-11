---
description: Use the Grafana Alerting import tool to convert your datasource managed alert rules into Grafana managed alert rules
labels:
  products:
    - cloud
    - enterprise
    - oss
title: Import data source-managed alert rules
menuTitle: Import to Grafana-managed alert rules
weight: 600
refs:
---

# Import data source-managed alert rules

Grafana provides an internal tool in Alerting which allows you to import Prometheus and Loki alert rules into Grafana-managed alert rules.

## Before you begin

The `alertingMigrationUI` and `grafanaManagedRecordingRulesDatasources` [feature flags](/docs/grafana/latest/setup-grafana/configure-grafana/feature-toggles/) needs to be enabled to use this feature.

To use the migration tool, you need the following [RBAC permissions](/docs/grafana/latest/administration/roles-and-permissions/access-control/):

- Alerting: Rules Writer
- Alerting: Set provisioning status
- Datasources: Reader
- Folders: Creator  
  {{< admonition type="note" >}}
  The Folders permission is optional and only necessary if you want to create new folders for your target namespace. If your account doesn't have permissions to view a namespace, the tool creates a new one. It is a best practice to prepare an import plan before you convert all your alert rules.
  {{< /admonition >}}

## How it works

When you use the import tool, a folder of data source-managed rules is copied to another folder as Grafana-managed alert rules, preserving the behavior of the rules, and the original alert rules are kept in their original location.

When data source-managed alert rules are converted to Grafana-managed alert rules, the following are applied to the Grafana-managed alert rules:

- All rules are given `rule_query_offset` offset value of 1m.
- The `missing_series_evals_to_resolve` is set to 1 for the new rules.
- The newly created rules are given unique UIDs.

{{< admonition type="note" >}}
Plugin rules that have the label `__grafana_origin` are not included on alert rule imports.
{{< /admonition >}}

## Import alert rules

To convert data source-managed alert rules to Grafana managed alerts:

1. Go to **Alerting > Alert rules**.

1. Navigate to the Data source-managed alert rules section and click **Import to Grafana-managed rules**.

   The import alert rules page opens.

1. In the Data source dropdown, select the Loki or Prometheus data source of the alert rules.

1. In Additional settings, select a target folder or designate a new folder to import the rules into.

   If you import the rules into an existing folder, don't chose a folder with existing alert rules, as they could get overwritten.

1. (Optional) Select a Namespace and/or Group to determine which rules are imported.

1. (Optional) Turn on **Pause imported alerting rules**.

   Pausing stops alert rule evaluation and doesn’t create any alert instances for the newly created Grafana-managed alert rules.

1. (Optional) Turn on **Pause imported recording rules**.

   Pausing stops alert rule evaluation behavior for the newly created Grafana-managed alert rules.

1. Select which target data source the new recording rule is written to.

1. Click **Import**.

   A preview shows the rules that will be imported. If your target folder contains folders with the same name of the imported folders, a warning displays to inform you. You can explore the warning to see a list of folders that might be overwritten.

   Click **Yes, import** to import the rules.
