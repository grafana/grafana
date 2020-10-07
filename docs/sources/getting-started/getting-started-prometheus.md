+++
title = "Getting started with Grafana and Prometheus"
description = "Guide for getting started with Grafana"
keywords = ["grafana", "intro", "guide", "started"]
type = "docs"
aliases = ["/docs/grafana/latest/guides/gettingstarted","/docs/grafana/latest/guides/getting_started"]
[menu.docs]
identifier = "getting_started-grafana-prometheus"
parent = "guides"
weight = 300
+++

# Getting Started with Grafana and Prometheus

Prometheus is an open-source systems monitoring and alerting toolkit for which Grafana includes built-in support. This topic walks you through the steps to create a series of dashboards in Grafana displaying system metrics of a host monitored by Prometheus.

You can also configure your Grafana instance in the cloud to display system metrics. For more information, refer to the [Grafana Cloud](https://grafana.com/docs/grafana-cloud/) documentation.

## Step 1: Install Grafana and build your first dashboard

Use the instructions in [Getting started with Grafana]({{< relref "getting-started.md" >}}) to:
- Install Grafana
- Login to Grafana
- Create your first dashboard

## Step 2: Download Prometheus and node exporter

Prometheus, like Grafana, can be installed on many different operating systems. Refer to the [Prometheus download page](https://prometheus.io/download/) which lists all stable versions of Prometheus components. Download the following components:
 - [prometheus](https://prometheus.io/download/#prometheus)
 - [node_exporter](https://prometheus.io/download/#node_exporter)

## Step 3: Install Prometheus node_exporter

Prometheus Node Exporter is a widely used tool that exposes system metrics. Install node_exporter on all hosts you want to monitor. For instructions on how to install node_exporter, refer to the [Installing and running the Node Exporter](https://prometheus.io/docs/guides/node-exporter/#installing-and-running-the-node-exporter) section in Prometheus documentation.

>Note: The instructions in the referenced topic is intended for Linux users. You may have to alter the instructions slightly depending on your operating system.

## Step 4: Install and configure Prometheus

1. Install Prometheus following instructions in the [Installation](https://prometheus.io/docs/prometheus/latest/installation/) topic in Prometheus documentation.

1. Next, configure Prometheus to monitor the hosts where you installed node_exporter. In order to do this, configure prometheus.yaml file located in Prometheus's home directory. Here is an example of the code you will need to add.
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

In your Grafana instance, go to the [explore]({{< relref "../explore/index.md" >}}) view and build queries to experiment with the metrics you want to monitor. Here you can also debug issues related to collecting metrics from Prometheus. Pay special attention to the [Prometheus-specific Features]({{< relref "../explore/_index.md#prometheus-specific-features" >}}) to avail custom querying experience for Prometheus.

## Step 6: Start building dashboards

Now that you have a curated list of queries, create [dashboards]({{< relref "../dashboards/_index.md" >}}) to render system metrics monitored by Prometheus. The following image shows a simple dashboard with three panels showing some system metrics.

<img class="no-shadow" src="/static/img/docs/getting-started/simple_grafana_prom_dashboard.png" width="580px">
