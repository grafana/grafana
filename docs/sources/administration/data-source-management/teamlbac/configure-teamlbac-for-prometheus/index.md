---
description: Configure LBAC for data sources for Prometheus data source
keywords:
  - Prometheus
  - datasource
  - team
labels:
  products:
    - cloud
    - enterprise
title: Configure LBAC for data sources for Prometheus
weight: 250
---

# Configure LBAC for data sources for Prometheus data source

## Grafana Cloud

LBAC for data sources is available in private preview on Grafana Cloud for Prometheus created with basic authentication. Prometheus data sources for LBAC for data sources can only be created, provisioning is currently not available.

You cannot configure LBAC rules for Grafana-provisioned data sources from the UI. Alternatively, you can replicate the setting of the provisioned data source in a new data source as described in [LBAC Configuration for New Prometheus Data Source](#task-1-lbac-configuration-for-new-prometheus-data-source) and then add the LBAC configuration to the new data source.

## Before you begin

To be able to use LBAC for Prometheus data sources, you need to enable the feature toggle `teamHttpHeadersMimir` on your Grafana instance. Contact support to enable the feature toggle for you.

- Be sure that you have the permission setup to create a Prometheus tenant in Grafana Cloud
- Be sure that you have admin data source permissions for Grafana.

## Grafana Cloud

LBAC for data sources is available in private preview on Grafana Cloud for Prometheus created with basic authentication. Prometheus data sources for LBAC for data sources can only be created, provisioning is currently not available.

You cannot configure LBAC rules for Grafana-provisioned data sources from the UI. We recommend that you replicate the setting of the provisioned data source in a new data source as described in [LBAC Configuration for New Prometheus Data Source](https://grafana.com/docs/grafana/latest/administration/data-source-management/teamlbac/configure-teamlbac-for-Prometheus/#task-1-lbac-configuration-for-new-Prometheus-data-source) and then add the LBAC configuration to the new data source.

### Permissions

We recommend that you remove all permissions for roles and teams that are not required to access the data source. This will help to ensure that only the required teams have access to the data source. The recommended permissions are `Admin` permission and only add the teams `Query` permissions that you want to add LBAC for data sources rules for.

## Task 1: LBAC Configuration for new Prometheus data source

1. Access Prometheus data sources details for your stack through grafana.com
1. Copy Prometheus details and create a CAP
   - Copy the details of your Prometheus setup.
   - Create a Cloud Access Policy (CAP) for the Prometheus data source in grafana.com.
   - Ensure the CAP includes `metrics:read` permissions.
   - Ensure the CAP does not include `labels` rules.
1. Create a new Prometheus data source
   - In Grafana, proceed to add a new data source and select Prometheus as the type.
1. Navigate back to the Prometheus data source
   - Set up the Prometheus data source using basic authentication. Use the `userID` as the username. Use the generated CAP `token` as the password.
   - Save and connect.
1. Navigate to data source permissions
   - Go to the permissions tab of the newly created Prometheus data source. Here, you'll find the LBAC for data sources rules section.

For more information on how to setup LBAC for data sources rules for a Prometheus data source, refer to [Create LBAC for data sources rules for the Prometheus data source](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/administration/data-source-management/teamlbac/create-teamlbac-rules/).

## Grafana Enterprise

LBAC for data sources is available in Grafana Enterprise for Prometheus created with basic authentication. Prometheus data sources for LBAC for data sources can only be created.

You cannot configure LBAC rules for Grafana-provisioned data sources from the UI. Alternatively, you can replicate the setting of the provisioned data source in a new data source as described in [LBAC Configuration for new Prometheus data source](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/administration/data-source-management/teamlbac/configure-teamlbac-for-prometheus/#task-1-lbac-configuration-for-new-prometheus-data-source) and then add the LBAC configuration to the new data source.

## Before you begin

To be able to use LBAC for Prometheus data sources, you need to enable the feature toggle `teamHttpHeadersMimir` on your Grafana instance. Contact support to enable the feature toggle for you.

- Be sure that you have the permission setup to create a cluster in your Grafana
- Be sure that you have admin plugins permissions for Grafana.
- Be sure that you have admin data source permissions for Grafana.

### Permissions

We recommend that you remove all permissions for roles and teams that are not required to access the data source. This will help to ensure that only the required teams have access to the data source. The recommended permissions are `Admin` permission and only add the teams `Query` permissions that you want to add LBAC for data sources rules for.

## Task 0: Setup Grafana Enterprise Metrics tenant and access policies

1. Access the plugins page and install Grafana Enterprise Metrics plugins
1. Connect your plugin and use app as the cluster
1. Access the app Grafana Enterprise Metrics and configure a tenant
1. Store the `uid` of the tenant to be used as the username for the basic authentication
1. Access the policies page inside of the app and create a AP
   - Create a Access Policy (CAP) for the Prometheus data source.
   - Ensure the CAP includes `metrics:read` permissions.
   - Ensure the CAP does not include `labels` rules.
   - Store the `token` to be used as password for authentication.

## Task 1: LBAC Configuration for new Prometheus data source

1. Create a new Prometheus data source
   - In Grafana, proceed to add a new data source and select Prometheus as the type.
1. Navigate back to the Prometheus data source
   - Set up the Prometheus data source using basic authentication. Use the `uid` as the username. Use the generated `token` as the password.
   - Save and connect.
1. Navigate to data source permissions
   - Go to the permissions tab of the newly created Prometheus data source. Here, you'll find the LBAC for data sources rules section.

For more information on how to setup LBAC for data sources rules for a Prometheus data source, refer to [Create LBAC for data sources rules for the Prometheus data source](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/administration/data-source-management/teamlbac/create-teamlbac-rules/).
