---
description: Configure LBAC for data sources for a Loki data source
keywords:
  - loki
  - datasource
  - team
labels:
  products:
    - cloud
    - enterprise
title: Configure LBAC for a Loki data source
weight: 250
review_date: 2026-09-22
---

# Configure LBAC for a Loki data source

This document explains how to configure Label-Based Access Control (LBAC) for data sources for a Loki data source. LBAC for data sources filters the logs that a team can query based on labels. You can configure it on both Grafana Cloud and Grafana Enterprise.

## Grafana Cloud

LBAC for data sources is generally available on Grafana Cloud for Loki data sources created with basic authentication. You create a new data source as described in [Configure a new Loki data source](#configure-a-new-loki-data-source-on-grafana-cloud). Provisioning is currently not available.

You can't configure LBAC rules for Grafana-provisioned data sources from the UI. We recommend that you replicate the settings of the provisioned data source in a new data source, and then add the LBAC configuration to the new data source.

### Before you begin

Before you configure LBAC for data sources, ensure you have the following:

- Permission to create a Loki tenant in Grafana Cloud.
- Admin data source permissions for Grafana.

Grafana recommends that you remove all permissions for roles and teams that don't require access to the data source. This ensures that only the required teams access the data source. The recommended permissions are `Admin` permission for administrators, and `Query` permission only for the teams that you want to add LBAC for data sources rules for.

### Configure a new Loki data source on Grafana Cloud

1. Access Loki data source details for your stack in Grafana Cloud.
1. Copy Loki details and create a CAP.
   - Copy the details of your Loki setup.
   - Create a Cloud Access Policy (CAP) for the Loki data source in Grafana Cloud.
   - Ensure the CAP includes `logs:read` permissions.
   - Ensure the CAP doesn't include `labels` rules.
1. Create a new Loki data source.
   - In Grafana, add a new data source and select Loki as the type.
1. Navigate back to the Loki data source.
   - Set up the Loki data source using basic authentication. Use the `userID` as the username. Use the generated CAP `token` as the password.
   - Select **Save & test**.
1. Navigate to data source permissions.
   - Go to the **Permissions** tab of the newly created Loki data source. Here, you find the LBAC for data sources rules section.

For more information on how to set up LBAC for data sources rules for a Loki data source, refer to [Create LBAC for data sources rules for the Loki data source](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/administration/data-source-management/teamlbac/create-teamlbac-rules/).

## Grafana Enterprise

LBAC for data sources is available in Grafana Enterprise for Loki connected to Grafana Enterprise Logs (GEL), created with basic authentication.

You can't configure LBAC rules for Grafana-provisioned data sources from the UI. Alternatively, you can replicate the settings of the provisioned data source in a new data source, and then add the LBAC configuration to the new data source.

### Before you begin

Before you configure LBAC for data sources, ensure you have the following:

- Permission to create a cluster in your Grafana.
- Admin plugins permissions for Grafana.
- Admin data source permissions for Grafana.

Grafana recommends that you remove all permissions for roles and teams that don't require access to the data source. This ensures that only the required teams access the data source. The recommended permissions are `Admin` permission for administrators, and `Query` permission only for the teams that you want to add LBAC for data sources rules for.

### Set up a Grafana Enterprise Logs tenant and access policies

1. Access the plugins page and install the Grafana Enterprise Logs plugin.
1. Connect your plugin and use the app as the cluster.
1. Access the Grafana Enterprise Logs app and configure a tenant.
1. Store the `uid` of the tenant to use as the username for basic authentication.
1. Access the policies page inside the app and create an access policy.
   - Create an access policy for the Loki data source.
   - Ensure the access policy includes `logs:read` permissions.
   - Ensure the access policy doesn't include `labels` rules.
   - Store the `token` to use as the password for authentication.

### Configure a new Loki data source on Grafana Enterprise

1. Create a new Loki data source.
   - In Grafana, add a new data source and select Loki as the type.
1. Navigate back to the Loki data source.
   - Set up the Loki data source using basic authentication. Use the `uid` as the username. Use the generated `token` as the password.
   - Select **Save & test**.
1. Navigate to data source permissions.
   - Go to the **Permissions** tab of the newly created Loki data source. Here, you find the LBAC for data sources rules section.

For more information on how to set up LBAC for data sources rules for a Loki data source, refer to [Create LBAC for data sources rules for the Loki data source](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/administration/data-source-management/teamlbac/create-teamlbac-rules/).

## Examples of LBAC rules

An LBAC rule is a `logql` query that filters logs based on labels. Each rule operates independently as its own filter, separate from other rules within a team. The following examples show common patterns. For more detail, refer to [Create LBAC for data sources rules for the Loki data source](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/administration/data-source-management/teamlbac/create-teamlbac-rules/).

### Single rule

Multiple label selectors in a single rule are combined with `AND`. The following rule grants access to log lines that match both `namespace="dev"` and `cluster="us-west-0"`:

```logql
{namespace="dev", cluster="us-west-0"}
```

### Multiple rules

Multiple rules assigned to the same team are combined with `OR`. The following two rules grant access to log lines that match `namespace="dev"` or `cluster="us-west-0"`:

```logql
{namespace="dev"}
{cluster="us-west-0"}
```

### Match multiple values with a regular expression

Use the `=~` operator to match a label against a regular expression. The following rule grants access to log lines in the `dev` or `prod` namespace:

```logql
{namespace=~"dev|prod"}
```

### Exclude a label value

Use the `!=` operator to exclude log lines that carry a specific label value. The following rule grants access to all log lines except those labeled `secret="true"`:

```logql
{secret!="true"}
```

### User on multiple teams

Users on multiple teams receive access based on all the combined rules assigned to each team, combined with `OR`. For example, if Team A has `{namespace="dev"}` and Team B has `{namespace="prod"}`, a user on both teams can access log lines that match `namespace="dev"` or `namespace="prod"`.
