+++
title = "Data source permissions"
description = "Grafana Datasource Permissions Guide "
keywords = ["grafana", "configuration", "documentation", "datasource", "permissions", "users", "teams", "enterprise"]
type = "docs"
[menu.docs]
name = "Datasource"
identifier = "datasource-permissions"
parent = "enterprise"
weight = 4
+++

# Data source permissions

> Only available in Grafana Enterprise.

Data source permissions allow you to restrict access for users to query a data source. For each data source there is a permission page that allows you to enable permissions and restrict query permissions to specific **Users** and **Teams**.

## Restricting Access - Enable Permissions

{{< docs-imagebox img="/img/docs/enterprise/datasource_permissions_enable_still.png" class="docs-image--no-shadow docs-image--right" max-width= "600px" animated-gif="/img/docs/enterprise/datasource_permissions_enable.gif" >}}

By default, permissions are disabled for data sources and a data source in an organization can be queried by any user in
that organization. For example a user with `Viewer` role can still issue any possible query to a data source, not just
those queries that exist on dashboards he/she has access to.

When permissions are enabled for a data source in an organization you will restrict admin and query access for that
data source to [admin users]({{< relref "../permissions/organization_roles/#admin-role" >}}) in that organization.

**To enable permissions for a data source:**

1. Navigate to Configuration / Data Sources.
2. Select the data source you want to enable permissions for.
3. Select the Permissions tab and click on the `Enable` button.

<div class="clearfix"></div>

## Allow users and teams to query a data source

{{< docs-imagebox img="/img/docs/enterprise/datasource_permissions_add_still.png" class="docs-image--no-shadow docs-image--right" max-width= "600px" animated-gif="/img/docs/enterprise/datasource_permissions_add.gif" >}}

After you have [enabled permissions](#restricting-access-enable-permissions) for a data source you can assign query
permissions to users and teams which will allow access to query the data source.

**Assign query permission to users and teams:**

1. Navigate to Configuration / Data Sources.
2. Select the data source you want to assign query permissions for.
3. Select the Permissions tab.
4. click on the `Add Permission` button.
5. Select Team/User and find the team/user you want to allow query access and click on the `Save` button.

<div class="clearfix"></div>

## Restore Default Access - Disable Permissions

{{< docs-imagebox img="/img/docs/enterprise/datasource_permissions_disable_still.png" class="docs-image--no-shadow docs-image--right" max-width= "600px" animated-gif="/img/docs/enterprise/datasource_permissions_disable.gif" >}}

If you have enabled permissions for a data source and want to return data source permissions to the default, i.e.
data source can be queried by any user in that organization, you can disable permissions with a click of a button.
Note that all existing permissions created for data source will be deleted.

**Disable permissions for a data source:**

1. Navigate to Configuration / Data Sources.
2. Select the data source you want to disable permissions for.
3. Select the Permissions tab and click on the `Disable Permissions` button.

<div class="clearfix"></div>
