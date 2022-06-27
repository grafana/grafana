---
aliases:
  - /docs/grafana/latest/datasources/add-a-data-source/
  - /docs/grafana/latest/features/datasources/add-a-data-source/
  - /docs/grafana/latest/enterprise/datasource_permissions/
  - /docs/sources/permissions/datasource_permissions/
title: Data source management
description: Data source management information for Grafana administrators
weight: 100
---

# Data source management

Grafana supports many different storage backends for your time series data (data source). Refer to [data sources]({{< relref "../../datasources/" >}}) for more information about using data sources in Grafana. Only users with the organization admin role can add data sources.

## Add a data source

Before you can create your first dashboard, you need to add your data source.

> **Note:** Only users with the organization Admin role can add data sources.

To add a data source:

1. Move your cursor to the cog icon on the side menu which will show the configuration options.

   {{< figure src="/static/img/docs/v75/sidemenu-datasource-7-5.png" max-width="150px" class="docs-image--no-shadow">}}

1. Click on **Data sources**. The data sources page opens showing a list of previously configured data sources for the Grafana instance.

1. Click **Add data source** to see a list of all supported data sources.

   {{< figure src="/static/img/docs/v75/add-data-source-7-5.png" max-width="600px" class="docs-image--no-shadow">}}

1. Search for a specific data source by entering the name in the search dialog. Or you can scroll through supported data sources grouped into time series, logging, tracing and other categories.

1. Move the cursor over the data source you want to add.

   {{< figure src="/static/img/docs/v75/select-data-source-7-5.png" max-width="700px" class="docs-image--no-shadow">}}

1. Click **Select**. The data source configuration page opens.

1. Configure the data source following instructions specific to that data source. See [Data sources]({{< relref "../../datasources" >}}) for links to configuration instructions for all supported data sources.

## Data source permissions

Data source permissions allow you to restrict access for users to query a data source. For each data source there is a permission page that allows you to enable permissions and restrict query permissions to specific **Users** and **Teams**.

> **Note:** Available in [Grafana Enterprise]({{< relref "../../enterprise/" >}}) and [Grafana Cloud Pro and Advanced]({{< ref "/grafana-cloud" >}}).

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
