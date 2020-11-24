+++
title = "With Grafana and MS SQL"
description = "Guide for getting started with Grafana"
keywords = ["grafana", "intro", "guide", "started"]
aliases = ["/docs/grafana/latest/guides/gettingstarted","/docs/grafana/latest/guides/getting_started"]
weight = 400
+++

# Getting started with Grafana and MS SQL Server

Microsoft SQL Server is a popular relational database management system that is used by ??. Grafana ships with a built-in Microsoft SQL Server (MSSQL) data source plugin that allows you to query and visualize data from any Microsoft SQL Server 2005 or newer, including Microsoft Azure SQL Database.

> **Note:** The plugin is available in Grafana v5.1+.

You can also configure a [Grafana Cloud](https://grafana.com/docs/grafana-cloud/) instance to display system metrics without having to host Grafana yourself.

## Step 1: Install Grafana and build your first dashboard

Use the instructions in [Getting started with Grafana]({{< relref "getting-started.md" >}}) to:
- Install Grafana.
- Log in to Grafana.
- Create your first dashboard.

## Step 2: Download MS SQL Server

MS SQL Server can be installed on many operating systems. Refer to the [MS SQL Server download page](https://www.microsoft.com/en-us/sql-server/sql-server-downloads), which lists all stable versions of Prometheus components. 

Alternately, you can install the MS SQL  data source along with test data from Grafana devenv. 

## Step 3: Install MS SQL Server

Prometheus node_exporter is a widely used tool that exposes system metrics. Install node_exporter on all hosts you want to monitor. For instructions on how to install node_exporter, refer to the [Installing and running the node_exporter](https://prometheus.io/docs/guides/node-exporter/#installing-and-running-the-node-exporter) section in Prometheus documentation.

> **Note**: The instructions in the referenced topic are intended for Linux users. You may have to alter the instructions slightly depending on your operating system. For example, if you are on Windows, use the [windows_exporter](https://github.com/prometheus-community/windows_exporter) instead.

## Step 4: Install and configure Prometheus

1. Install Prometheus following instructions in the [Installation](https://prometheus.io/docs/prometheus/latest/installation/) topic in the Prometheus documentation.

1. Configure Prometheus to monitor the hosts where you installed node_exporter. In order to do this, modify Prometheus's configuration file. By default, Prometheus looks for the file `prometheus.yml` in the current working directory. This behavior can be changed via the `--config.file` command line flag. For example, some Prometheus installers use it to set the configuration file to `/etc/prometheus/prometheus.yml`. Here is an example of the code you will need to add.

   ```
    # A scrape configuration containing exactly one endpoint to scrape from node_exporter running on a host:
    scrape_configs:
        # The job name is added as a label `job=<job_name>` to any timeseries scraped from this config.
        - job_name: 'node'

        # metrics_path defaults to '/metrics'
        # scheme defaults to 'http'.

        static_configs:
        - targets: ['<hostname>:9100']
   ```

1. Start the Prometheus service:
   ```
    ./prometheus --config.file=./prometheus.yml
   ```

## Step 5: Check Prometheus metrics in Grafana Explore view

In your Grafana instance, go to the [Explore]({{< relref "../explore/index.md" >}}) view and build queries to experiment with the metrics you want to monitor. Here you can also debug issues related to collecting metrics from Prometheus. Pay special attention to the [Prometheus-specific features]({{< relref "../explore/_index.md#prometheus-specific-features" >}}) to avail custom querying experience for Prometheus.

## Step 6: Start building dashboards

Now that you have a curated list of queries, create [dashboards]({{< relref "../dashboards/_index.md" >}}) to render system metrics monitored by Prometheus. When you install Prometheus and node_exporter or windows_exporter, you will find recommended dashboards for use.

The following image shows a dashboard with three panels showing some system metrics.

{{< imgbox max-width="800px" img="/img/docs/getting-started/simple_grafana_prom_dashboard.png" caption="Alerting overview" >}}
