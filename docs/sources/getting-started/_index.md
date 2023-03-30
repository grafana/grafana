---
aliases:
  - guides/what-is-grafana/
title: Get started
weight: 9
---

# Get started

To get started with Grafana you must perform the following tasks:

1. Set up Grafana
1. Connect your first data source
1. Create your first dashboard

## Set up Grafana

Choose one of the following methods to set up Grafana:

- [Set up Grafana on Grafana Cloud](/docs/grafana-cloud/quickstart/) without having to install it or run it yourself.
  This is the fastest way to get started and the easiest way to use Grafana.
- [Set up Grafana on your own infrastructure]({{< relref "../setup-grafana/installation/" >}}) such as an operating system, Kubernetes cluster, or Docker container.

## Connect your first data source

Grafana dashboards work by querying [data sources]({{< relref "../datasources/" >}}) that you connect to Grafana.
You must [set up a data source]({{< relref "../administration/data-source-management/" >}}) connection before you can visualize data.
You set up a data source by [installing a data source plugin]({{< relref "../administration/plugin-management/#install-grafana-plugins" >}})).
From the plugin catalog, you can also [browse data source plugins](https://grafana.com/grafana/plugins/?type=datasource).

1. Decide which data source you want to visualize. Browse the (data source plugin catalog](https://grafana.com/grafana/plugins/?type=datasource)) to see what you can connect with Grafana.
1. Ensure the data source plugin is installed.
   See ([how to install data source plugins]({{< relref "../administration/data-source-management/" >}})).
1. Connect the data source to Grafana.
   See [how to set up a data source]({< relref "../administration/data-source-management/" >}}), which configures an instance of a connection from Grafana to that data source.

## Create your first dashboard

Once you have connected Grafana with one or more data sources, you can create a dashboard to visualize data from those data sources.
This section provides guidance on how build your first dashboard after you have installed Grafana.
It also provides step-by-step instructions on how to add a Prometheus, InfluxDB, or an MS SQL Server data source.
Refer to [Data sources]({{< relref "../administration/data-source-management/" >}}) for a list of all supported data sources.

{{< section >}}
