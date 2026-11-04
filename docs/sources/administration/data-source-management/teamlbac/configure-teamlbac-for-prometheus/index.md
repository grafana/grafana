---
description: Configure LBAC for data sources for a Prometheus data source
keywords:
  - Prometheus
  - datasource
  - team
labels:
  products:
    - cloud
    - enterprise
title: Configure LBAC for a Prometheus data source
weight: 250
review_date: 2026-09-22
---

# Configure LBAC for a Prometheus data source

This document explains how to configure Label-Based Access Control (LBAC) for data sources for a Prometheus data source. LBAC for data sources filters the metrics that a team can query based on labels. You can configure it on both Grafana Cloud and Grafana Enterprise.

## Grafana Cloud

LBAC for data sources is generally available on Grafana Cloud for Prometheus data sources created with basic authentication. You create a new data source as described in [Configure a new Prometheus data source](#configure-a-new-prometheus-data-source-on-grafana-cloud). Provisioning is currently not available.

You can't configure LBAC rules for Grafana-provisioned data sources from the UI. We recommend that you replicate the settings of the provisioned data source in a new data source, and then add the LBAC configuration to the new data source.

### Before you begin

Before you configure LBAC for data sources, ensure you have the following:

- Permission to create a Prometheus tenant in Grafana Cloud.
- Admin data source permissions for Grafana.

Grafana recommends that you remove all permissions for roles and teams that don't require access to the data source. This ensures that only the required teams access the data source. The recommended permissions are `Admin` permission for administrators, and `Query` permission only for the teams that you want to add LBAC for data sources rules for.

### Configure a new Prometheus data source on Grafana Cloud

1. Access Prometheus data source details for your stack in Grafana Cloud.
1. Copy Prometheus details and create a CAP.
   - Copy the details of your Prometheus setup.
   - Create a Cloud Access Policy (CAP) for the Prometheus data source in Grafana Cloud.
   - Ensure the CAP includes `metrics:read` permissions.
   - Ensure the CAP doesn't include `labels` rules.
1. Create a new Prometheus data source.
   - In Grafana, add a new data source and select Prometheus as the type.
1. Navigate back to the Prometheus data source.
   - Set up the Prometheus data source using basic authentication. Use the `userID` as the username. Use the generated CAP `token` as the password.
   - Select **Save & test**.
1. Navigate to data source permissions.
   - Go to the **Permissions** tab of the newly created Prometheus data source. Here, you find the LBAC for data sources rules section.

For more information on how to set up LBAC for data sources rules for a Prometheus data source, refer to [Create LBAC for data sources rules for the Prometheus data source](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/administration/data-source-management/teamlbac/create-teamlbac-rules/).

## Grafana Enterprise

LBAC for data sources is available in Grafana Enterprise for Prometheus connected to Grafana Enterprise Metrics (GEM), created with basic authentication.

You can't configure LBAC rules for Grafana-provisioned data sources from the UI. Alternatively, you can replicate the settings of the provisioned data source in a new data source, and then add the LBAC configuration to the new data source.

### Before you begin

Before you configure LBAC for data sources, ensure you have the following:

- Permission to create a cluster in your Grafana.
- Admin plugins permissions for Grafana.
- Admin data source permissions for Grafana.

Grafana recommends that you remove all permissions for roles and teams that don't require access to the data source. This ensures that only the required teams access the data source. The recommended permissions are `Admin` permission for administrators, and `Query` permission only for the teams that you want to add LBAC for data sources rules for.

### Set up a Grafana Enterprise Metrics tenant and access policies

1. Access the plugins page and install the Grafana Enterprise Metrics plugin.
1. Connect your plugin and use the app as the cluster.
1. Access the Grafana Enterprise Metrics app and configure a tenant.
1. Store the `uid` of the tenant to use as the username for basic authentication.
1. Access the policies page inside the app and create an access policy.
   - Create an access policy for the Prometheus data source.
   - Ensure the access policy includes `metrics:read` permissions.
   - Ensure the access policy doesn't include `labels` rules.
   - Store the `token` to use as the password for authentication.

### Configure a new Prometheus data source on Grafana Enterprise

1. Create a new Prometheus data source.
   - In Grafana, add a new data source and select Prometheus as the type.
1. Navigate back to the Prometheus data source.
   - Set up the Prometheus data source using basic authentication. Use the `uid` as the username. Use the generated `token` as the password.
   - Select **Save & test**.
1. Navigate to data source permissions.
   - Go to the **Permissions** tab of the newly created Prometheus data source. Here, you find the LBAC for data sources rules section.

For more information on how to set up LBAC for data sources rules for a Prometheus data source, refer to [Create LBAC for data sources rules for the Prometheus data source](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/administration/data-source-management/teamlbac/create-teamlbac-rules/).

## Examples of LBAC rules

An LBAC rule is a `logql` query that filters metrics based on labels. Each rule operates independently as its own filter, separate from other rules within a team. The following examples show common patterns. For more detail, refer to [Create LBAC for data sources rules for the Prometheus data source](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/administration/data-source-management/teamlbac/create-teamlbac-rules/).

### Single rule

Multiple label selectors in a single rule are combined with `AND`. The following rule grants access to metrics that match both `job="api-server"` and `region="europe"`:

```logql
{job="api-server", region="europe"}
```

### Multiple rules

Multiple rules assigned to the same team are combined with `OR`. The following two rules grant access to metrics that match `job="api-server"` or `region="europe"`:

```logql
{job="api-server"}
{region="europe"}
```

### Match multiple values with a regular expression

Use the `=~` operator to match a label against a regular expression. The following rule grants access to metrics in the `europe` or `us-east` region:

```logql
{region=~"europe|us-east"}
```

### Exclude a label value

Use the `!=` operator to exclude metrics that carry a specific label value. The following rule grants access to all metrics except those labeled `cluster="restricted"`:

```logql
{cluster!="restricted"}
```

### User on multiple teams

Users on multiple teams receive access based on all the combined rules assigned to each team, combined with `OR`. For example, if Team A has `{region="europe"}` and Team B has `{region="us-east"}`, a user on both teams can access metrics that match `region="europe"` or `region="us-east"`.

## Related resources

- [LBAC for data sources overview](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/administration/data-source-management/teamlbac/) explains how LBAC works, which data sources are supported, and current limitations.
- [Create LBAC for data sources rules for a supported data source](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/administration/data-source-management/teamlbac/create-teamlbac-rules/) explains how to define and manage rules.
