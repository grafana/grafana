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

_Grafana and Prometheus_:

1. Download Prometheus and node_exporter
1. Install Prometheus node_exporter
1. Install and configure Prometheus
1. Configure Prometheus for Grafana
1. Check Prometheus metrics in Grafana Explore view
1. Start building dashboards

#### Download Prometheus and node_exporter

Download the following components:

- [Prometheus](https://prometheus.io/download/#prometheus)
- [node_exporter](https://prometheus.io/download/#node_exporter)

Like Grafana, you can install Prometheus on many different operating systems. Refer to the [Prometheus download page](https://prometheus.io/download/) to see a list of stable versions of Prometheus components.

#### Install Prometheus node_exporter

Install node_exporter on all hosts you want to monitor. This guide shows you how to install it locally.

Prometheus node_exporter is a widely used tool that exposes system metrics. For instructions on installing node_exporter, refer to the [Installing and running the node_exporter](https://prometheus.io/docs/guides/node-exporter/#installing-and-running-the-node-exporter) section in the Prometheus documentation.

When you run node_exporter locally, navigate to `http://localhost:9100/metrics` to check that it is exporting metrics.

{{% admonition type="note" %}}
The instructions in the referenced topic are intended for Linux users. You may have to alter the instructions slightly depending on your operating system. For example, if you are on Windows, use the [windows_exporter](https://github.com/prometheus-community/windows_exporter) instead.
{{% /admonition %}}

#### Install and configure Prometheus

1. After [downloading Prometheus](https://prometheus.io/download/#prometheus), extract it and navigate to the directory.

   ```
   tar xvfz prometheus-*.tar.gz
   cd prometheus-*
   ```

1. Locate the `prometheus.yml` file in the directory.

1. Modify Prometheus's configuration file to monitor the hosts where you installed node_exporter.

By default, Prometheus looks for the file `prometheus.yml` in the current working directory. This behavior can be changed via the `--config.file` command line flag. For example, some Prometheus installers use it to set the configuration file to `/etc/prometheus/prometheus.yml`.

The following example shows you the code you should add. Notice that static configs targets are set to `['localhost:9100']` to target node-explorer when running it locally.

```
 # A scrape configuration containing exactly one endpoint to scrape from node_exporter running on a host:
 scrape_configs:
     # The job name is added as a label `job=<job_name>` to any timeseries scraped from this config.
     - job_name: 'node'

     # metrics_path defaults to '/metrics'
     # scheme defaults to 'http'.

       static_configs:
       - targets: ['localhost:9100']
```

1. Start the Prometheus service:

   ```
    ./prometheus --config.file=./prometheus.yml
   ```

1. Confirm that Prometheus is running by navigating to `http://localhost:9090`.

You can see that the node_exporter metrics have been delivered to Prometheus. Next, the metrics will be sent to Grafana.

#### Configure Prometheus for Grafana

When running Prometheus locally, there are two ways to configure Prometheus for Grafana. You can use a hosted Grafana instance at [Grafana Cloud](/) or run Grafana locally.

This guide describes configuring Prometheus in a hosted Grafana instance on Grafana Cloud.

1. Sign up for [https://grafana.com/](/auth/sign-up/create-user). Grafana gives you a Prometheus instance out of the box.

![Prometheus details in Grafana.com](/static/img/docs/getting-started/screenshot-grafana-prometheus-details.png)

1. Because you are running your own Prometheus instance locally, you must `remote_write` your metrics to the Grafana.com Prometheus instance. Grafana provides code to add to your `prometheus.yml` config file. This includes a remote write endpoint, your user name and password.

Add the following code to your prometheus.yml file to begin sending metrics to your hosted Grafana instance.

```
remote_write:
- url: <https://your-remote-write-endpoint>
  basic_auth:
    username: <your user name>
    password: <Your Grafana.com API Key>
```

{{% admonition type="note" %}}
To configure your Prometheus instance to work with Grafana locally instead of Grafana Cloud, install Grafana [here](/grafana/download) and follow the configuration steps listed [here](/docs/grafana/latest/datasources/prometheus/#configure-the-data-source).
{{% /admonition %}}

#### Check Prometheus metrics in Grafana Explore view

In your Grafana instance, go to the [Explore]({{< relref "../explore" >}}) view and build queries to experiment with the metrics you want to monitor. Here you can also debug issues related to collecting metrics from Prometheus.

#### Start building dashboards

Now that you have a curated list of queries, create [dashboards]({{< relref "../dashboards" >}}) to render system metrics monitored by Prometheus. When you install Prometheus and node_exporter or windows_exporter, you will find recommended dashboards for use.

The following image shows a dashboard with three panels showing some system metrics.

![Prometheus dashboards](/static/img/docs/getting-started/simple_grafana_prom_dashboard.png)

To learn more:

- Grafana documentation: [Prometheus data source]({{< relref "../datasources/prometheus" >}})
- Prometheus documentation: [What is Prometheus?](https://prometheus.io/docs/introduction/overview/)
