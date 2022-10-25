---
aliases:
  - /docs/grafana/latest/datasources/add-a-data-source/
  - /docs/grafana/latest/datasources/datasource_permissions/
  - /docs/grafana/latest/features/datasources/add-a-data-source/
  - /docs/grafana/latest/enterprise/datasource_permissions/
  - /docs/grafana/latest/permissions/datasource_permissions/
  - /docs/grafana/latest/administration/data-source-management/
title: Data source management
description: Data source management information for Grafana administrators
weight: 100
---

# Data source management

Grafana supports many different storage backends for your time series data (data source).
Refer to [data sources]({{< relref "../../datasources" >}}) for more information about using data sources in Grafana.
Only users with the organization admin role can add data sources.

## Add a data source

Before you can create your first dashboard, you need to add your data source.

> **Note:** Only users with the organization admin role can add data sources.

**To add a data source:**

1. Select the cog icon on the side menu to show the configuration options.

   {{< figure src="/static/img/docs/v75/sidemenu-datasource-7-5.png" max-width="150px" class="docs-image--no-shadow">}}

1. Select **Data sources**.

   This opens the data sources page, which displays a list of previously configured data sources for the Grafana instance.

1. Select **Add data source** to see a list of all supported data sources.

   {{< figure src="/static/img/docs/v75/add-data-source-7-5.png" max-width="600px" class="docs-image--no-shadow">}}

1. Enter the name of a specific data source in the search dialog.

   You can also scroll through supported data sources grouped into time series, logging, tracing, and other categories.

1. Move the cursor over the data source you want to add.

   {{< figure src="/static/img/docs/v75/select-data-source-7-5.png" max-width="700px" class="docs-image--no-shadow">}}

1. Select **Select**.

   This opens the data source configuration page.

1. Configure the data source following instructions specific to that data source.

   For links to data source-specific documentation, see [Data sources]({{< relref "../../datasources" >}}).

## Data source permissions

You can configure data source permissions to allow or deny certain users the ability to query a data source.
Each data source's configuration includes a permissions page where you can enable permissions and restrict query permissions to specific **Users** and **Teams**.

> **Note:** Available in [Grafana Enterprise]({{< relref "../../enterprise" >}}) and [Grafana Cloud Pro and Advanced](/docs/grafana-cloud/latest/).

### Enable data source permissions

{{< figure src="/static/img/docs/enterprise/datasource_permissions_enable_still.png" class="docs-image--no-shadow docs-image--right" max-width= "600px" animated-gif="/static/img/docs/enterprise/datasource_permissions_enable.gif" >}}

By default, data sources in an organization can be queried by any user in that organization. For example, a user with the `Viewer` role can issue any possible query to a data source, not just
queries that exist on dashboards they have access to.

When permissions are enabled for a data source in an organization, the user who created the datasource can edit the datasource and in addition, viewers can query the datasource.

**Enable permissions for a data source:**

1. Navigate to **Configuration > Data Sources**.
1. Select the data source you want to enable permissions for.
1. On the Permissions tab, click **Enable**.

<div class="clearfix"></div>

> **Caution:** Enabling permissions for the default data source makes users not listed in the permissions unable to invoke queries. Panels using default data source will return `Access denied to data source` error for those users.

### Allow users and teams to query a data source

{{< figure src="/static/img/docs/enterprise/datasource_permissions_add_still.png" class="docs-image--no-shadow docs-image--right" max-width= "600px" animated-gif="/static/img/docs/enterprise/datasource_permissions_add.gif" >}}

After you have enabled permissions for a data source you can assign query permissions to users and teams which will allow access to query the data source.

**Assign query permission to users and teams:**

1. Navigate to **Configuration > Data Sources**.
1. Select the data source you want to assign query permissions for.
1. On the Permissions tab, click **Add Permission**.
1. Select **Team** or **User**.
1. Select the entity you want to allow query access and then click **Save**.

<div class="clearfix"></div>

### Disable data source permissions

{{< figure src="/static/img/docs/enterprise/datasource_permissions_disable_still.png" class="docs-image--no-shadow docs-image--right" max-width= "600px" animated-gif="/static/img/docs/enterprise/datasource_permissions_disable.gif" >}}

If you have enabled permissions for a data source and want to return data source permissions to the default, then you can disable permissions with a click of a button.

Note that _all_ existing permissions created for the data source will be deleted.

**Disable permissions for a data source:**

1. Navigate to **Configuration > Data Sources**.
1. Select the data source you want to disable permissions for.
1. On the Permissions tab, click **Disable Permissions**.

<div class="clearfix"></div>

## Add data source plugins

Grafana ships with several [built-in data sources]({{< relref "../../datasources#built-in-core-data-sources" >}}).
You can add additional data sources as plugins, which you can install or create yourself.

### Find data source plugins in the plugin catalog

To view available data source plugins, go to the [plugin catalog](/grafana/plugins/?type=datasource) and select the "Data sources" filter.
For details about the plugin catalog, refer to [Plugin management]({{< relref "../../administration/plugin-management/" >}}).

You can further filter the plugin catalog's results for data sources provided by the Grafana community, Grafana Labs, and partners.
If you use [Grafana Enterprise]{{< relref "../../enterprise/" >}}, you can also filter by Enterprise-supported plugins.

For more documentation on a specific data source plugin's features, including its query language and editor, refer to its plugin catalog page.

### Create a data source plugin

To build your own data source plugin, refer to the ["Build a data source plugin"](/tutorials/build-a-data-source-plugin/) tutorial and our documentation about [building a plugin](/developers/plugins/).
