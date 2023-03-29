---
aliases:
  - guides/what-is-grafana/
title: Get started
weight: 9
---

# Get started

Getting started with Grafana involves three steps:

1. Set up Grafana
1. Connect your first data source
1. Create your first dashboard

## Step 1. Setup Grafana

You have two ways to set up Grafana:

* [Setup Grafana on Grafana Cloud]("https://grafana.com/docs/grafana-cloud/quickstart/") without having to install it or run it yourself. This is the fastest way to get started and the easiest way to use Grafana.
* [Setup Grafana on your own infrastructure]({{< relref "../setup-grafana/installation/" >}}) such as an operating system, Kubernetes cluster, or Docker container.

## Step 2. Connect your first data source

Grafana dashboards work by querying [data sources]({{< relref "../datasources/" >}}) that you connect to Grafana. You will need to [setup a data source]({{< relref "../administration/data-source-management/" >}}) connection before you can visualize data. Data sources are setup by [installing data source plugins]({{< relref "../administration/plugin-management/#install-grafana-plugins" >}})). You can [browse data source plugins](https://grafana.com/grafana/plugins/?type=datasource) from the plugin catalog.

1. Decide which data source you want to visualize. Browse the (data source plugin catalog](https://grafana.com/grafana/plugins/?type=datasource)) to see what you can connect with Grafana.
2. Ensure the data source plugin is installed. See ([how to install data source plugins]({{< relref "../administration/data-source-management/" >}})).
3. Connect the data source to Grafana. See ([how to setup a data source]({{< relref "../administration/data-source-management/" >}})), which configures an instance of a connection from Grafana to that data source.

## Step 3. Create your first dashboard

Once you have connected Grafana with one or more data sources, you can create a dashboard to visualize data from those data sources. This section provides guidance on how build your first dashboard after you have installed Grafana. It also provides step-by-step instructions on how to add a Prometheus, InfluxDB, or an MS SQL Server data source. Refer to [Data sources]({{< relref "../administration/data-source-management/" >}}) for a list of all supported data sources.

{{< section >}}
