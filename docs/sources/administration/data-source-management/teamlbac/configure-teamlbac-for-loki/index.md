---
description: Configure LBAC for data sources for Loki data source on Grafana Cloud
keywords:
  - loki
  - datasource
  - team
labels:
  products:
    - cloud
title: Configure LBAC for data sources for Loki
weight: 250
---

# Configure LBAC for data sources for Loki data source on Grafana Cloud

LBAC for data sources is available in private preview on Grafana Cloud for Loki created with basic authentication. Loki data sources for LBAC for data sources can only be created, provisioning is currently not available.

You cannot add LBAC rules through the UI to data sources that are provisioned by Grafana. This includes your default Grafana Cloud Loki data source. To work around this limitation, you can create a new Loki data source, copy the same settings from your Grafana-provisioned data source to the new data source, and add your LBAC rules. For detailed steps to configure this, see below in [Create an access policy and new Loki data source](https://grafana.com/docs/grafana/latest/administration/data-source-management/teamlbac/configure-teamlbac-for-loki/#create-an-access-policy-and-new-loki-data-source). 

## Before you begin

To be able to use LBAC for data sources rules, you need to enable the feature toggle `teamHttpHeaders` on your Grafana instance. Contact support to enable the feature toggle for you.

- Be sure that you have permissions to create a Cloud Access Policy in the Grafana Cloud Portal
- Be sure that you have permissions to add and modify data sources in Grafana.

### Permissions

We recommend that you remove all permissions for all roles and teams that do not need to access the data source. This will help to ensure that only the required teams have access to the data source. 

The recommended permissions are:

- `Admin` permission for any administrators
- and only add the teams `Query` permissions that you want to add LBAC for data sources rules for.

## Create an access policy and new Loki data source

1. In your Grafana Cloud Portal, navigate to the Grafana Cloud stack where you want to configure LBAC for data sources.
1. Under Manage your stack, in the Loki box, click on the **Details** button.
1. From this page, copy the **URL** and **User** of your Loki instance.
1. In the left-side navigation, select **Access Policies** under the Security heading.
1. Create a new access policy:
   - Give the policy a name.
   - Select the Realm where this access policy will apply - either to all stacks in your organization, or to an individual stack.
   - Under Scopes, add `logs:read`.
   - Ensure the access policy does not specify any _label selector_ rules; you will add these rules to the Grafana data source itself later.
   - Click **Create**.
1. After creating the access policy, click **Add token** to create a new token, and copy the generated token.
1. Navigate to your Grafana instance, and create a new Loki data source:
   - For the URL field, paste the Loki URL you copied earlier.
   - Under _Authentication_, choose _Basic authentication_. For the User field, paste in the Loki numeric username. For the Password field, paste in the cloud access policy token you created above.
   - Click **Save & Test**.
1. Navigate to the Permissions tab, and grant the `Query` permission to the team(s) which will access this data source. Remove unrestricted access from other roles.
1. To add individual LBAC rules to this data source, from the Permissions tab, click **Add a LBAC rule**.

For more information on how to add rules, refer to [Create LBAC for data sources rules for the Loki data source](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/administration/data-source-management/teamlbac/create-teamlbac-rules/).
