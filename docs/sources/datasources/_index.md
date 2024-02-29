---
aliases:
  - data-sources/
  - overview/
  - ./features/datasources/
labels:
  products:
    - cloud
    - enterprise
    - oss
title: Data sources
weight: 60
---

# Grafana data sources

Grafana comes with built-in support for many _data sources_.
If you need other data sources, you can also install one of the many data source plugins.
If the plugin you need doesn't exist, you can develop a custom plugin.

{{< youtube id="cqHO0oYW6Ic" >}}

Each data source comes with a _query editor_,
which formulates custom queries according to the source's structure.
After you add and configure a data source, you can use it as an input for many operations, including:

- Query the data with [Explore][explore].
- Visualize it in [panels][panels].
- Create rules for [alerts][alerts].

This documentation describes how to manage data sources in general,
and how to configure or query the built-in data sources.
For other data sources, refer to the list of [datasource plugins](/grafana/plugins/).

To develop a custom plugin, refer to [Build a plugin](/developers/plugin-tools).

## Add a data source

Before you can create your first dashboard, you need to add your data source.

{{% admonition type="note" %}}
Only users with the [organization administrator role][organization-roles] can add or remove data sources.
To access data source management tools in Grafana as an administrator, navigate to **Configuration > Data Sources** in the Grafana sidebar.
{{% /admonition %}}

**To add a data source:**

1. Click **Connections** in the left-side menu.
1. Enter the name of a specific data source in the search dialog. You can filter by **Data source** to only see data sources.
1. Click the data source you want to add.
1. Configure the data source following instructions specific to that data source.

## Data source permissions

You can configure data source permissions to allow or deny certain users the ability to query, edit, or administrate a data source. Each data source’s configuration includes a Permissions tab where you can restrict data source permissions to specific users, service accounts, teams, or roles.

- Query permission allows users to query the data source.
- Edit permission allows users to query the data source, edit the data source’s configuration and delete the data source.
- Admin permission allows users to query and edit the data source, change permissions on the data source and enable or disable query caching for the data source.

{{% admonition type="note" %}}
Available in [Grafana Enterprise]({{< relref "../../introduction/grafana-enterprise/" >}}) and [Grafana Cloud](/docs/grafana-cloud).
{{% /admonition %}}

By default, data sources in an organization can be queried by any user in that organization. For example, a user with the `Viewer` role can issue any possible query to a data source, not just queries that exist on dashboards to which they have access. Additionally, by default, data sources can be edited by the user who created the data source, as well as users with the `Admin` role.

<div class="clearfix"></div>

### Assign data source permissions to users, service accounts, teams, or roles

You can assign data source permissions to users, service accounts, teams, and roles which will allow access to query, edit, or administrate the data source.

1. Click **Connections** in the left-side menu.
1. Under Your connections, click **Data sources**.
1. Select the data source to which you want to assign permissions.
1. On the Permissions tab, click **Add a permission**.
1. Select **User**, **Service Account**, **Team**, or **Role**.
1. Select the entity for which you want to modify permissions.
1. Select the **Query**, **Edit**, or **Admin** permission.
1. Click **Save**.

<div class="clearfix"></div>

### Edit data source permissions for users, service accounts, teams, or roles

1. Click **Connections** in the left-side menu.
1. Under Your connections, click **Data sources**.
1. Select the data source for which you want to edit permissions.
1. On the Permissions tab, find the **User**, **Service Account**, **Team**, or **Role** permission you want to update.
1. Select a different option in the **Permission** dropdown.

<div class="clearfix"></div>

### Remove data source permissions for users, service accounts, teams, or roles

1. Click **Connections** in the left-side menu.
1. Under Your connections, click **Data sources**.
1. Select the data source from which you want to remove permissions.
1. On the Permissions tab, find the **User**, **Service Account**, **Team**, or **Role** permission you want to remove.
1. Click the **X** next to the permission.

<div class="clearfix"></div>

## Use query editors

{{< figure src="/static/img/docs/queries/influxdb-query-editor-7-2.png" class="docs-image--no-shadow" max-width="1000px" caption="The InfluxDB query editor" >}}

Each data source's **query editor** provides a customized user interface that helps you write queries that take advantage of its unique capabilities.
You use a data source's query editor when you create queries in [dashboard panels][query-transform-data] or [Explore][explore].

Because of the differences between query languages, each data source query editor looks and functions differently.
Depending on your data source, the query editor might provide auto-completion features, metric names, variable suggestions, or a visual query-building interface.

For example, this video demonstrates the visual Prometheus query builder:

{{< vimeo 720004179 >}}

For general information about querying in Grafana, and common options and user interface elements across all query editors, refer to [Query and transform data][query-transform-data].

## Query and resource caching

When you enable query and resource caching, Grafana temporarily stores the results of data source queries and resource requests. When you or another user submit the same query or resource request again, the results will come back from the cache instead of from the data source.

When using Grafana, a query pertains to a request for data frames to be modified or displayed. A resource relates to any HTTP requests made by a plugin, such as the Amazon Timestream plugin requesting a list of available databases from AWS. For more information on data source queries and resources, please see the developers page on [backend plugins](/developers/plugin-tools/introduction/backend-plugins).

The caching feature works for **all** backend data sources. You can enable the cache globally in Grafana's [configuration]({{< relref "../../setup-grafana/configure-grafana/enterprise-configuration/#caching" >}}), and configure a cache duration (also called Time to Live, or TTL) for each data source individually.

{{% admonition type="note" %}}
Available in [Grafana Enterprise]({{< relref "../../introduction/grafana-enterprise/" >}}) and [Grafana Cloud](/docs/grafana-cloud/).
{{% /admonition %}}

The following cache backend options are available: in-memory, Redis, and Memcached.

{{% admonition type="note" %}}
Storing cached queries in-memory can increase Grafana's memory footprint. In production environments, a Redis or Memcached backend is highly recommended.
{{% /admonition %}}

When a panel queries a data source with cached data, it will either fetch fresh data or use cached data depending on the panel's **interval.** The interval is used to round the query time range to a nearby cached time range, increasing the likelihood of cache hits. Therefore, wider panels and dashboards with shorter time ranges fetch new data more often than narrower panels and dashboards with longer time ranges.

A panel's interval is visible in the [query options]({{< relref "../../panels-visualizations/query-transform-data/" >}}). It is calculated as follows: `time range / max data points`. Max data points are calculated based on the width of the panel. For example, a wide panel with `1000 data points` on a dashboard with a time range of `last 7 days` will retrieve fresh data every 10 minutes: `7d / 1000 = 10m`. In this example, cached data for this panel will be served for up to 10 minutes before Grafana needs to query the data source again for new data.

You can configure a panel to retrieve data more often by increasing the **Max data points** setting in the panel's [query options]({{< relref "../../panels-visualizations/query-transform-data/" >}}).

### Caching benefits

By reducing the number of queries and requests sent to data sources, caching can provide the following benefits:

- Faster dashboard load times, especially for popular dashboards.
- Reduced API costs.
- Reduced likelihood that APIs will rate-limit or throttle requests.

### Data sources that work with query caching

Query caching works for Grafana's [built-in data sources](#built-in-core-data-sources), and [backend data source plugins](https://grafana.com/grafana/plugins/?type=datasource) that extend the `DataSourceWithBackend` class in the plugins SDK.

To verify that a data source works with query caching, follow the [instructions below](#enable-and-configure-query-caching) to **Enable and Configure query caching**. If caching is enabled in Grafana but the Caching tab is not visible for the given data source, then query caching is not available for that data source.

{{% admonition type="note" %}}
Some data sources, such as Elasticsearch, Prometheus, and Loki, cache queries themselves, so Grafana _query_ caching does not significantly improve performance. However, _resource_ caching may help. See the developers page on [plugin resources](/developers/plugin-tools/introduction/backend-plugins) for details.
{{% /admonition %}}

### Enable and configure query caching

You must be an Org admin or Grafana admin to enable query caching for a data source. For more information on Grafana roles and permissions, refer to [About users and permissions]({{< relref "../roles-and-permissions/" >}}).

By default, data source queries are not cached. To enable query caching for a single data source:

1. Click **Connections** in the left-side menu.
1. Under Your Connections, click **Data sources**.
1. In the data source list, click the data source that you want to turn on caching for.
1. Go to the **Cache** tab.
1. Click **Enable**.
1. (Optional) Choose custom TTLs for the data source's queries and resources caching. If you skip this step, then Grafana uses the default TTL.

You can optionally override a data source's configured TTL for individual dashboard panels. This can be useful when you have queries whose results change more or less often than the configured TTL. In the Edit Panel view, select the caching-enabled data source, expand the Query options, and enter your the TTL in milliseconds.

{{< figure max-width="500px" src="/media/docs/grafana/per-panel-cache-ttl-9-4.png" caption="Set Cache TTL for a single panel" >}}

{{% admonition type="note" %}}
If query caching is enabled and the Cache tab is not visible in a data source's settings, then query caching is not available for that data source.
{{% /admonition %}}

To configure global settings for query caching, refer to the `caching` section of [Configure Grafana Enterprise]({{< relref "../../setup-grafana/configure-grafana/enterprise-configuration/#caching" >}}).

### Disable query caching

To disable query caching for a single data source:

1. Click **Connections** in the left-side menu.
1. Under Your Connections, click **Data sources**.
1. In the data source list, click the data source that you want to turn off caching for.
1. On the **Cache** tab, click **Disable**.

To disable query caching for an entire Grafana instance, set the `enabled` flag to `false` in the `caching` section of [Configure Grafana Enterprise]({{< relref "../../setup-grafana/configure-grafana/enterprise-configuration/#caching" >}}). You will no longer see the Cache tab on any data sources, and no data source queries will be cached.

### Clear cache

If you experience performance issues or repeated queries become slower to execute, consider clearing your cache.

{{% admonition type="note" %}}
This action impacts all cache-enabled data sources. If you are using Memcached, the system clears all data from the Memcached instance.
{{% /admonition %}}

1. Click **Connections** in the left-side menu.
1. Under Your Connections, click **Data sources**.
1. In the data source list, click the data source that you want to clear the cache for.
1. In the **Cache** tab, click **Clear cache**.

### Sending a request without cache

If a data source query request contains an `X-Cache-Skip` header, then Grafana skips the caching middleware, and does not search the cache for a response. This can be particularly useful when debugging data source queries using cURL.

## Special data sources

Grafana includes three special data sources:

- **Grafana:** A built-in data source that generates random walk data and can poll the [Testdata]({{< relref "./testdata/" >}}) data source. Additionally, it can list files and get other data from a Grafana installation. This can be helpful for testing visualizations and running experiments.
- **Mixed:** An abstraction that lets you query multiple data sources in the same panel.
  When you select Mixed, you can then select a different data source for each new query that you add.
  - The first query uses the data source that was selected before you selected **Mixed**.
  - You can't change an existing query to use the **Mixed** data source.
  - Grafana Play example: [Mixed data sources](https://play.grafana.org/d/000000100/mixed-datasources?orgId=1)
- **Dashboard:** A data source that uses the result set from another panel in the same dashboard. The dashboard data source can use data either directly from the selected panel or from annotations attached to the selected panel.

## Built-in core data sources

These built-in core data sources are also included in the Grafana documentation:

- [Alertmanager]({{< relref "./alertmanager" >}})
- [AWS CloudWatch]({{< relref "./aws-cloudwatch" >}})
- [Azure Monitor]({{< relref "./azure-monitor" >}})
- [Elasticsearch]({{< relref "./elasticsearch" >}})
- [Google Cloud Monitoring]({{< relref "./google-cloud-monitoring" >}})
- [Graphite]({{< relref "./graphite" >}})
- [InfluxDB]({{< relref "./influxdb" >}})
- [Jaeger]({{< relref "./jaeger" >}})
- [Loki]({{< relref "./loki" >}})
- [Microsoft SQL Server (MSSQL)]({{< relref "./mssql" >}})
- [MySQL]({{< relref "./mysql" >}})
- [OpenTSDB]({{< relref "./opentsdb" >}})
- [PostgreSQL]({{< relref "./postgres" >}})
- [Prometheus]({{< relref "./prometheus" >}})
- [Tempo]({{< relref "./tempo" >}})
- [Testdata]({{< relref "./testdata" >}})
- [Zipkin]({{< relref "./zipkin" >}})

## Add additional data source plugins

You can also add additional data sources as plugins (that are not available in core Grafana), which you can install or create yourself.

### Find data source plugins in the plugin catalog

To view available data source plugins, go to the [plugin catalog](/grafana/plugins/?type=datasource) and select the "Data sources" filter.
For details about the plugin catalog, refer to [Plugin management]({{< relref "../../administration/plugin-management/" >}}).

You can further filter the plugin catalog's results for data sources provided by the Grafana community, Grafana Labs, and partners.
If you use [Grafana Enterprise]({{< relref "../../introduction/grafana-enterprise/" >}}), you can also filter by Enterprise-supported plugins.

For more documentation on a specific data source plugin's features, including its query language and editor, refer to its plugin catalog page.

### Create a data source plugin

To build your own data source plugin, refer to the ["Build a data source plugin"](/developers/plugin-tools/tutorials/build-a-data-source-plugin) tutorial and our documentation about [building a plugin](/developers/plugin-tools).

{{% docs/reference %}}
[alerts]: "/docs/grafana/ -> /docs/grafana/<GRAFANA VERSION>/alerting"
[alerts]: "/docs/grafana-cloud/ -> /docs/grafana/<GRAFANA VERSION>/alerting"

[data-source-management]: "/docs/grafana/ -> /docs/grafana/<GRAFANA VERSION>/administration/data-source-management"
[data-source-management]: "/docs/grafana-cloud/ -> /docs/grafana/<GRAFANA VERSION>/administration/data-source-management"

[explore]: "/docs/grafana/ -> /docs/grafana/<GRAFANA VERSION>/explore"
[explore]: "/docs/grafana-cloud/ -> /docs/grafana/<GRAFANA VERSION>/explore"

[organization-roles]: "/docs/grafana/ -> /docs/grafana/<GRAFANA VERSION>/administration/roles-and-permissions#organization-roles"
[organization-roles]: "/docs/grafana-cloud/ -> /docs/grafana/<GRAFANA VERSION>/administration/roles-and-permissions#organization-roles"

[panels]: "/docs/grafana/ -> /docs/grafana/<GRAFANA VERSION>/panels-visualizations"
[panels]: "/docs/grafana-cloud/ -> /docs/grafana/<GRAFANA VERSION>/panels-visualizations"

[query-transform-data]: "/docs/grafana/ -> /docs/grafana/<GRAFANA VERSION>/panels-visualizations/query-transform-data"
[query-transform-data]: "/docs/grafana-cloud/ -> /docs/grafana/<GRAFANA VERSION>/panels-visualizations/query-transform-data"
{{% /docs/reference %}}
