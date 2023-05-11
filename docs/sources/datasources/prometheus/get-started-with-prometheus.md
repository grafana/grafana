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

| Option         | Description                                                                                                                      |
| -------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| Name           | The data source name. This is how you refer to the data source in panels and queries.                                            |
| Default toggle | Switch the toggle to select the default in panels. (then when you go to a panel and this will be the first selected data source) |

### Auth section
