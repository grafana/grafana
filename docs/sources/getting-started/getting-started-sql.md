+++
title = "With Grafana and MS SQL"
description = "Guide for getting started with Grafana"
keywords = ["grafana", "intro", "guide", "started"]
aliases = ["/docs/grafana/latest/guides/gettingstarted","/docs/grafana/latest/guides/getting_started"]
weight = 400
+++

# Getting started with Grafana and MS SQL Server

Microsoft SQL Server is a popular relational database management system that is widely used in development and production environments. Grafana ships with a built-in Microsoft SQL Server (MSSQL) data source plugin that allows you to query and visualize data from any Microsoft SQL Server 2005 or newer, including Microsoft Azure SQL Database. This topic walks you through the steps to create a series of dashboards in Grafana to display metrics from a MS SQL Server database.

> **Note:** The plugin is available in Grafana v5.1+.

You can also configure the MS SQL Server data source on a [Grafana Cloud](https://grafana.com/docs/grafana-cloud/) instance without having to host Grafana yourself.

## Step 1: Install Grafana and build your first dashboard

Use the instructions in [Getting started with Grafana]({{< relref "getting-started.md" >}}) to:
- Install Grafana.
- Log in to Grafana.
- Create your first dashboard.

## Step 2: Download MS SQL Server

MS SQL Server can be installed on many different operating systems. Refer to the [MS SQL Server downloads page](https://www.microsoft.com/en-us/sql-server/sql-server-downloads), for a complete list of all available options.

Alternately, install MS SQL Server using the resources available in [grafana/grafana](https://github.com/grafana/grafana) GitHub repository (recommended). Here you will find a collection of supported data sources, including MS SQL Server, along with test data and pre-configured dashboards for use.

> **Note:** Installing MS SQL Server on Windows from the [grafana/grafana](https://github.com/grafana/grafana/tree/master/devenv) GitHub repository is not supported at this time.

## Step 3: Install MS SQL Server

You can install MS SQL Server on the host running Grafana or on a remote server. To install the software from the [downloads page](https://www.microsoft.com/en-us/sql-server/sql-server-downloads), follow their setup prompts.

Otherwise, follow the instructions below to install and configure MS SQL Server from the [grafana/grafana](https://github.com/grafana/grafana/tree/master) repository.

1. Clone the [grafana/grafana](https://github.com/grafana/grafana/tree/master) repository to your local system.

1. Install Docker or verify that it is installed on your machine.

1. Within your local `grafana` repository, change directory to [devenv](https://github.com/grafana/grafana/tree/master/devenv).

1. Run the bash command to setup datasources and dashboards in your Grafana.
   ```
    ./setup.sh
   ```

1. Restart the Grafana server.

1. Change directory back to [master](https://github.com/grafana/grafana/tree/master/devenv).

1. Run the make command to create the MS SQL Server database.
   ```
    make devenv sources=mssql
   ```
This creates an image of the SQL Server database and runs it as a Docker container.

## Step 4: Adding the MS SQL data source

When you add the MS SQL data source, you will find recommended dashboards for use.

To add MS SQL Server data source:

1. In the Grafana side menu, go to  **Configuration** and click **Data Sources** option.
2. Filter by `mssql` and select the **Microsoft SQL Server** option.
3. Click **Add data source** button in the top right header to open the configuration page.
4. Enter the information specified in the table below, then click **Save & Test** at the bottom of the page.
   
 Name           | Description
------------   | -------------
`Name`         | The data source name. This is how you refer to the data source in panels and queries.
`Host`         | The IP address/hostname and optional port of your MS SQL instance. If port is omitted, the default 1433 will be used.
`Database`     | Name of your MS SQL database.
`User`         | Database user's login/username.
`Password`     | Database user's password. 

> **Note:** If you installed MS SQL Server database from [grafana/grafana](https://github.com/grafana/grafana/tree/master) GitHub repository, the `gdev-mssql` data source is created during installation. Check the data source settings, and search for available dashboards for use.


The following image shows a dashboard with three panels showing some metrics generated from test data.

## Step 5: Start building dashboards

In your Grafana instance, go to the [Explore]({{< relref "../explore/index.md" >}}) view and build queries to experiment with the metrics you want to monitor. Once you have a curated list of queries, create [dashboards]({{< relref "../dashboards/_index.md" >}}) to render system metrics monitored by Prometheus. When you install Prometheus and node_exporter or windows_exporter, you will find recommended dashboards for use.

The following image shows a dashboard with three panels showing some system metrics.

{{< imgbox align="center" max-width="800px" img="/img/docs/getting-started/simple_grafana_prom_dashboard.png" caption="SQL Server dashboards" >}}
