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

## Add the Prometheus data source

For instructions on how to add a data source to Grafana, see [Add a data source](https://grafana.com/docs/grafana/latest/administration/data-source-management/#add-a-data-source). Only users with the organization administrator role can add data sources.
Administrators can also [configure the data source via YAML]({{< relref "#provision-the-data-source" >}}) with Grafana's provisioning system.

## Prometheus API

The Prometheus data source also works with other projects that implement the [Prometheus querying API](https://prometheus.io/docs/prometheus/latest/querying/api/).

For more information on how to query other Prometheus-compatible projects from Grafana, refer to the specific project's documentation:

- [Grafana Mimir](/docs/mimir/latest/)
- [Thanos](https://thanos.io/tip/components/query.md/)

## Configuration option reference

Following is a list of configuration options for Prometheus. For step by step instructions on how to configure the Prometheus data source see [Configure the Prometheus data source]().

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

**URL** - The URL of your Prometheus server. If your Prometheus server is local, use http://localhost90. If it is on a server within a network, this is the port exposed where you are running prometheus. Example: http://prometheus.example.org:9090.

**Allowed cookies** - Specify cookies by name that should be forwarded to the data source. The Grafana proxy deletes all forwarded cookies by default.

**Timeout** - The HTTP request timeout in seconds.

### Additional settings

Following are additional configuration options.

**Manage alerts via Alerting UI** - Toggle on to enable managing alerts.

#### Interval Behavior

**Scrape interval** -

**Query timeout** -
