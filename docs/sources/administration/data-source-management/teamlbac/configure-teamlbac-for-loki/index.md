---
description: Configure Team LBAC for Loki data source on Grafana Cloud
keywords:
  - loki
  - datasource
  - team
labels:
  products:
    - cloud
title: Configure Team LBAC for Loki
weight: 250
---

# Configure Team LBAC for Loki data source on Grafana Cloud

Team LBAC is available in private preview on Grafana Cloud for Loki created with basic authentication. Loki datasources for Team LBAC can only be created, provisioning is currently not available.

## Before you begin

To be able to use Team LBAC rules, you need to enable the feature toggle `teamHttpHeaders` on your Grafana instance. Contact support to enable the feature toggle for you.

- Be sure that you have the permission setup to create a loki tenant in Grafana Cloud
- Be sure that you have admin data source permissions for Grafana.

### Permissions

We recommend that you remove all permissions for roles and teams that are not required to access the data source. This will help to ensure that only the required teams have access to the data source. The recommended permissions are `Admin` permission and only add the teams `Query` permissions that you want to add Team LBAC rules for.

## Task 1: Configure Team LBAC for a new Loki data source

1. Access Loki data sources details for your stack through grafana.com
1. Copy Loki Details and Create a CAP
   - Copy the details of your Loki setup.
   - Create a Cloud Access Policy (CAP) for the Loki data source in grafana.com.
   - Ensure the CAP includes `logs:read` permissions.
   - Ensure the CAP does not include `labels` rules.
1. Create a New Loki Data Source
   - In Grafana, proceed to add a new data source and select Loki as the type.
1. Navigate back to the Loki data source
   - Set up the Loki data source using basic authentication. Use the userID as the username. Use the generated CAP token as the password.
   - Save and connect.
1. Navigate to Data Source Permissions
   - Go to the permissions tab of the newly created Loki data source. Here, you'll find the Team LBAC rules section.

For more information on how to setup Team LBAC rules for a Loki data source, refer to [Create Team LBAC rules for the Loki data source](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/administration/data-source-management/teamlbac/create-teamlbac-rules/).
