---
aliases:
  - ../data-sources/prometheus/
  - ../features/datasources/prometheus/
description: Guide for using Prometheus in Grafana
keywords:
  - grafana
  - prometheus
  - guide
menuTitle: Get started with Prometheus
title: Get started with the Prometheus data source
weight: 1301
---

# Get started with Prometheus

Grafana ships with built-in support for Prometheus. If you are new to working with Prometheus the following documentation will help you get started working with Prometheus and Grafana:

- [What is Prometheus?](https://grafana.com/docs/grafana/latest/fundamentals/intro-to-prometheus/)
- [Prometheus data model](https://prometheus.io/docs/concepts/data_model/)
- [Getting started](https://prometheus.io/docs/prometheus/latest/getting_started/)

## Add the Prometheus data source

For instructions on how to add a data source to Grafana, see [Add a data source](https://grafana.com/docs/grafana/latest/administration/data-source-management/#add-a-data-source). Only users with the organization administrator role can add data sources.
Administrators can also [configure the data source via YAML]({{< relref "#provision-the-data-source" >}}) with Grafana's provisioning system.

## Prometheus API

The Prometheus data source also works with other projects that implement the [Prometheus querying API](https://prometheus.io/docs/prometheus/latest/querying/api/).

For more information on how to query other Prometheus-compatible projects from Grafana, refer to the specific project's documentation:

- [Grafana Mimir](/docs/mimir/latest/)
- [Thanos](https://thanos.io/tip/components/query.md/)

## Configuration option reference

Following is a list of configuration options for Prometheus. For step-by-step instructions on how to configure the Prometheus data source see [Configure the Prometheus data source]().

### Connection

Add your Prometheus server URL in the **Connection** section.

**Name** - The data source name. This is how you refer to the data source in panels and queries.

**Default** - Toggle to select as the default name in dashboard panels. When you go to a dashboard panel this will be the first selected data source.

<!-- | Option         | Description                                                                                                                      |
| -------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| Name           | The data source name. This is how you refer to the data source in panels and queries.                                            |
| Default toggle | Switch the toggle to select the default in panels. | -->

### Auth section

Choose an authentication method in the Authentication section.

**Basic authentication** - The most common authentication method. Use your `data source` username and `data source` password to connect.

### HTTP section

**URL** - The URL of your Prometheus server. If your Prometheus server is local, use <http://localhost90>. If it is on a server within a network, this is the port exposed where you are running prometheus. Example: <http://prometheus.example.org:9090>.

**Allowed cookies** - Specify cookies by name that should be forwarded to the data source. The Grafana proxy deletes all forwarded cookies by default.

**Timeout** - The HTTP request timeout in seconds.

## Additional settings

Following are additional configuration options.

### Alerting

**Manage alerts via Alerting UI** - Toggle to enable `Alertmanager` integration for this data source.

### Interval Behavior

**Scrape interval** - Set this to the typical scrape and evaluation interval configured in Prometheus. The default is 15s.

**Query timeout** - The default is 60s.

### Query editor

**Default editor** - Sets a default editor. Options are `Builder` or `Code`.

**Disable metrics lookup** - Toggle on to disable the metrics chooser and metric/label support in the query field's autocomplete. This helps if you have performance issues with large Prometheus instances.

### Performance

**Prometheus type** - The type of your Prometheus server; `Prometheus`, `Cortex`, `Thanos`, `Mimir`. When selected, the **Version** field attempts to populate automatically using the Prometheus [buildinfo](https://semver.org/) API. Some Prometheus types, such as Cortex, don't support this API and must be manually populated.

**Incremental querying** - Beta. Changes the default behavior of relative queries to always request fresh data from the Prometheus instance. Enable this option to decrease database and network load.

### Other

**Custom query parameters** - Add custom parameters to the Prometheus query URL. For example `timeout`, `partial_response`, `dedup`, or `max_source_resolution`. Multiple parameters should be concatenated together with an '&amp;'.

**HTTP method** - Use either `POST` or `GET` HTTP method to query your data source. `POST` is the recommended and pre-selected method as it allows bigger queries. Change to `GET` if you have a Prometheus version older than 2.1 or if `POST` requests are restricted in your network.

### Exemplars

Support for exemplars is available only for the Prometheus data source. If this is your first time working with exemplars see [Introduction to exemplars](https://grafana.com/docs/grafana/latest/fundamentals/exemplars/). An exemplar is a specific trace representative of measurement taken in a given time interval.

**Internal link** - Toggle on to if you have an internal link. When enabled, reveals the data source selector. Select the backend tracing data store for your exemplar data.

**URL** - _(Visible only if you disable `Internal link`)_ Defines the external link's full URL. You can interpolate the value from the field by using the [`${__value.raw}` macro]({{< relref "../..//panels-visualizations/configure-data-links/#value-variables" >}}).

**URL label** - _(Optional)_ Adds a custom display label to override the value of the `Label name` field.

**Label name** - Adds a name for the exemplar traceID property

**Remove exemplar link** - Click to remove existing internal links.
