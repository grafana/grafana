---
aliases:
  - ../guides/getting_started/
  - ../guides/gettingstarted/
  - getting-started-prometheus/
description: Learn how to build your first Prometheus dashboard in Grafana.
title: Get started with Grafana and Prometheus
weight: 300
---

# Get started with Grafana and Prometheus

Prometheus is an open source monitoring system for which Grafana provides out-of-the-box support. This topic walks you through the steps to create a series of dashboards in Grafana to display system metrics for a server monitored by Prometheus.

> **Note:** You can configure a [Grafana Cloud](https://grafana.com/docs/grafana-cloud/) instance to display system metrics without having to host Grafana yourself. A [free forever plan](https://grafana.com/signup/cloud/connect-account?pg=gsdocs) provides 10,000 active series for metrics.

#### Download Prometheus and node_exporter

Prometheus, like Grafana, can be installed on many different operating systems. Refer to the [Prometheus download page](https://prometheus.io/download/), which lists all stable versions of Prometheus components. Download the following components:

- [Prometheus](https://prometheus.io/download/#prometheus)
- [node_exporter](https://prometheus.io/download/#node_exporter)

#### Install Prometheus node_exporter

Prometheus node_exporter is a widely used tool that exposes system metrics. Install node_exporter on all hosts you want to monitor. For instructions on how to install node_exporter, refer to the [Installing and running the node_exporter](https://prometheus.io/docs/guides/node-exporter/#installing-and-running-the-node-exporter) section in Prometheus documentation.

> **Note**: The instructions in the referenced topic are intended for Linux users. You may have to alter the instructions slightly depending on your operating system. For example, if you are on Windows, use the [windows_exporter](https://github.com/prometheus-community/windows_exporter) instead.

#### Install and configure Prometheus

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

#### Check Prometheus metrics in Grafana Explore view

In your Grafana instance, go to the [Explore]({{< relref "../explore/" >}}) view and build queries to experiment with the metrics you want to monitor. Here you can also debug issues related to collecting metrics from Prometheus. Pay special attention to the [Prometheus-specific features]({{< relref "../explore/#prometheus-specific-features" >}}) to avail custom querying experience for Prometheus.

#### Start building dashboards

Now that you have a curated list of queries, create [dashboards]({{< relref "../dashboards/" >}}) to render system metrics monitored by Prometheus. When you install Prometheus and node_exporter or windows_exporter, you will find recommended dashboards for use.

The following image shows a dashboard with three panels showing some system metrics.

![Prometheus dashboards](/static/img/docs/getting-started/simple_grafana_prom_dashboard.png)

To learn more:

- Grafana documentation: [Prometheus data source]({{< relref "../datasources/prometheus/" >}})
- Prometheus documentation: [What is Prometheus?](https://prometheus.io/docs/introduction/overview/)
