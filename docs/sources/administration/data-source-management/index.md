---
aliases:
  - ../datasources/add-a-data-source/
  - ../datasources/datasource_permissions/
  - ../enterprise/datasource_permissions/
  - ../enterprise/query-caching/
  - ../features/datasources/add-a-data-source/
  - ../permissions/datasource_permissions/
description: Data source management information for Grafana administrators
title: Data source management
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

1. Click **Connections** in the left-side menu.
1. Enter the name of a specific data source in the search dialog. You can filter by **Data source** to only see data sources.
1. Click the data source you want to add.
1. Configure the data source following instructions specific to that data source.

   For links to data source-specific documentation, see [Data sources]({{< relref "../../datasources" >}}).

## Data source permissions

You can configure data source permissions to allow or deny certain users the ability to query or edit a data source. Each data source’s configuration includes a Permissions tab where you can restrict data source permissions to specific users, teams, or roles.

> **Note:** Available in [Grafana Enterprise]({{< relref "../../introduction/grafana-enterprise/" >}}) and [Grafana Cloud Pro and Advanced](/docs/grafana-cloud).

By default, data sources in an organization can be queried by any user in that organization. For example, a user with the `Viewer` role can issue any possible query to a data source, not just queries that exist on dashboards to which they have access. Additionally, by default, data sources can be edited by the user who created the data source, as well as users with the `Admin` role.

<div class="clearfix"></div>

### Assign data source permissions to users, teams, or roles

You can assign data source permissions to users, teams, and roles which will allow access to query or edit the data source.

1. Click **Connections** in the left-side menu.
1. Under Your connections, click **Data sources**.
1. Select the data source to which you want to assign permissions.
1. On the Permissions tab, click **Add a permission**.
1. Select **User**, **Team**, or **Role**.
1. Select the entity for which you want to modify permissions.
1. Select the **Query** or **Edit** permission.
1. Click **Save**.

<div class="clearfix"></div>

### Edit data source permissions for users, teams, or roles

1. Click **Connections** in the left-side menu.
1. Under Your connections, click **Data sources**.
1. Select the data source for which you want to edit permissions.
1. On the Permissions tab, find the user, team, or role permission you want to update.
1. Select a different option in the **Permission** dropdown.

<div class="clearfix"></div>

### Remove data source permissions for users, teams, or roles

1. Click **Connections** in the left-side menu.
1. Under Your connections, click **Data sources**.
1. Select the data source from which you want to remove permissions.
1. On the Permissions tab, find the user, team, or role permission you want to remove.
1. Click the **X** next to the permission.

<div class="clearfix"></div>

## Query caching

When query caching is enabled, Grafana temporarily stores the results of data source queries. When you or another user submit the exact same query again, the results will come back from the cache instead of from the data source (like Splunk or ServiceNow) itself.

Query caching works for all backend data sources. You can enable the cache globally and configure the cache duration (also called Time to Live, or TTL).

> **Note:** Available in [Grafana Enterprise]({{< relref "../../introduction/grafana-enterprise/" >}}) and [Grafana Cloud Pro and Advanced](/docs/grafana-cloud/).

The following cache backends are available: in-memory, Redis, and Memcached.

> **Note:** Storing cached queries in-memory can increase Grafana's memory footprint. In production environments, a Redis or Memcached backend is highly recommended.

When a panel queries a cached data source, the time until this query fetches fresh data is determined by the panel's **interval.** This means that wider panels and dashboards with shorter time ranges fetch new data more frequently than narrower panels and dashboards with longer time ranges.

Interval is visible in a panel's [query options]({{< relref "../../panels-visualizations/query-transform-data/" >}}). It is calculated like this: `(max data points) / time range`. Max data points are calculated based on the width of the panel. For example, a full-width panel on a dashboard with a time range of `last 7 days` will retrieve fresh data every 10 minutes. In this example, cached data for this panel will be served for up to 10 minutes before Grafana queries the data source again and returns new data.

You can make a panel retrieve fresh data more frequently by increasing the **Max data points** setting in the panel's [query options]({{< relref "../../panels-visualizations/query-transform-data/" >}}).

### Query caching benefits

- Faster dashboard load times, especially for popular dashboards.
- Reduced API costs.
- Reduced likelihood that APIs will rate-limit or throttle requests.

### Data sources that work with query caching

Query caching works for all [Enterprise data sources](/grafana/plugins/?type=datasource&enterprise=1) as well as the following [built-in data sources]({{< relref "../../datasources/" >}}):

- CloudWatch Metrics
- Google Cloud Monitoring
- InfluxDB
- Microsoft SQL Server
- MySQL
- Postgres
- Tempo

Some data sources, such as Elasticsearch, Prometheus, and Loki, cache queries themselves, so Grafana query caching does not improve performance.

Query caching also works for all data sources that include a backend. More specifically, caching works with data sources that extend the `DataSourceWithBackend` class in the plugins SDK.

To tell if a data source works with query caching, follow the instructions below to **Enable and Configure query caching**. If caching is enabled in Grafana but the Caching tab is not visible for the given data source, then query caching is not available for that data source.

### Enable and configure query caching

You must be an Org admin or Grafana admin to enable query caching for a data source. For more information on Grafana roles and permissions, refer to [About users and permissions]({{< relref "../roles-and-permissions/" >}}).

By default, data source queries are not cached. To enable query caching for a single data source:

1. Click **Connections** in the left-side menu.
1. Under Your Connections, click **Data sources**.
1. In the data source list, click the data source that you want to turn on caching for.
1. Go to the Cache tab.
1. Click **Enable**.
1. (Optional) Choose custom TTLs for the data source's queries and resources caching. If you skip this step, then Grafana uses the default TTL.

You can optionally override a data source's configured TTL for individual dashboard panels. This can be be useful when you have queries whose results change more or less often than the configured TTL. In the Edit Panel view, select the caching-enabled data source, expand the Query options, and enter your the TTL in milliseconds.

{{< figure max-width="500px" src="/media/docs/grafana/per-panel-cache-ttl-9-4.png" caption="Set Cache TTL for a single panel" >}}

> **Note:** If query caching is enabled and the Cache tab is not visible in a data source's settings, then query caching is not available for that data source.

To configure global settings for query caching, refer to the [Query caching section of Enterprise Configuration]({{< relref "../../setup-grafana/configure-grafana/enterprise-configuration/#caching" >}}).

### Disable query caching

To disable query caching for a single data source:

1. Click **Connections** in the left-side menu.
1. Under Your Connections, click **Data sources**.
1. In the data source list, click the data source that you want to turn off caching for.
1. On the Cache tab, click **Disable**.

To disable query caching for an entire Grafana instance, set the `enabled` flag to `false` in the [Query caching section of Enterprise Configuration]({{< relref "../../setup-grafana/configure-grafana/enterprise-configuration/#caching" >}}). You will no longer see the Cache tab on any data sources, and no data source queries will be cached.

### Clear cache

If you experience performance issues or repeated queries become slower to execute, consider clearing your cache.

> **Note:** This action impacts all cache-enabled data sources. If you are using Memcached, the system clears all data from the Memcached instance.

1. Click **Connections** in the left-side menu.
1. Under Your Connections, click **Data sources**.
1. In the data source list, click the data source that you want to clear the cache for.
1. In the Cache tab, click **Clear cache**.

### Sending a request without cache

If a data source query request contains an `X-Cache-Skip` header, then Grafana skips the caching middleware, and does not search the cache for a response. This can be particularly useful when debugging data source queries using cURL.

## Add data source plugins

Grafana ships with several [built-in data sources]({{< relref "../../datasources#built-in-core-data-sources" >}}).
You can add additional data sources as plugins, which you can install or create yourself.

### Find data source plugins in the plugin catalog

To view available data source plugins, go to the [plugin catalog](/grafana/plugins/?type=datasource) and select the "Data sources" filter.
For details about the plugin catalog, refer to [Plugin management]({{< relref "../../administration/plugin-management/" >}}).

You can further filter the plugin catalog's results for data sources provided by the Grafana community, Grafana Labs, and partners.
If you use [Grafana Enterprise]({{< relref "../../introduction/grafana-enterprise/" >}}), you can also filter by Enterprise-supported plugins.

For more documentation on a specific data source plugin's features, including its query language and editor, refer to its plugin catalog page.

### Create a data source plugin

To build your own data source plugin, refer to the ["Build a data source plugin"](/tutorials/build-a-data-source-plugin/) tutorial and our documentation about [building a plugin](/developers/plugins/).
