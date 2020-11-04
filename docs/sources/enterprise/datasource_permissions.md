+++
title = "Data source permissions"
description = "Grafana Datasource Permissions Guide "
keywords = ["grafana", "configuration", "documentation", "datasource", "permissions", "users", "teams", "enterprise"]
type = "docs"
[menu.docs]
name = "Datasource"
identifier = "datasource-permissions"
parent = "enterprise"
weight = 200
+++

# Data source permissions

Data source permissions allow you to restrict access for users to query a data source. For each data source there is a permission page that allows you to enable permissions and restrict query permissions to specific **Users** and **Teams**.

> Only available in Grafana Enterprise.

## Enable data source permissions

{{< docs-imagebox img="/img/docs/enterprise/datasource_permissions_enable_still.png" class="docs-image--no-shadow docs-image--right" max-width= "600px" animated-gif="/img/docs/enterprise/datasource_permissions_enable.gif" >}}

By default, data sources in an organization can be queried by any user in that organization. For example, a user with the `Viewer` role can issue any possible query to a data source, not just
queries that exist on dashboards they have access to.

When permissions are enabled for a data source in an organization, you restrict admin and query access for that data source to [admin users]({{< relref "../permissions/organization_roles/#admin-role" >}}) in that organization.

**Enable permissions for a data source:**

1. Navigate to **Configuration > Data Sources**.
1. Select the data source you want to enable permissions for.
1. On the Permissions tab, click **Enable**.

<div class="clearfix"></div>

> **Caution:** Enabling permissions for the default data source makes users not listed in the permissions unable to invoke queries. Panels using default data source will return `Access denied to data source` error for those users.

## Allow users and teams to query a data source

{{< docs-imagebox img="/img/docs/enterprise/datasource_permissions_add_still.png" class="docs-image--no-shadow docs-image--right" max-width= "600px" animated-gif="/img/docs/enterprise/datasource_permissions_add.gif" >}}

After you have enabled permissions for a data source you can assign query permissions to users and teams which will allow access to query the data source.

**Assign query permission to users and teams:**

1. Navigate to **Configuration > Data Sources**.
1. Select the data source you want to assign query permissions for.
1. On the Permissions tab, click **Add Permission**.
1. Select **Team** or **User**.
1. Select the entity you want to allow query access and then click **Save**.

<div class="clearfix"></div>

## Disable data source permissions

{{< docs-imagebox img="/img/docs/enterprise/datasource_permissions_disable_still.png" class="docs-image--no-shadow docs-image--right" max-width= "600px" animated-gif="/img/docs/enterprise/datasource_permissions_disable.gif" >}}

If you have enabled permissions for a data source and want to return data source permissions to the default, then you can disable permissions with a click of a button.

Note that *all* existing permissions created for the data source will be deleted.

**Disable permissions for a data source:**

1. Navigate to **Configuration > Data Sources**.
1. Select the data source you want to disable permissions for.
1. On the Permissions tab, click **Disable Permissions**.

<div class="clearfix"></div>
