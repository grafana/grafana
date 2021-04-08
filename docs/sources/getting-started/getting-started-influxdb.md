+++
title = "With Grafana and InfluxDB"
description = "Guide for getting started with Grafana and InfluxDB"
keywords = ["grafana", "intro", "guide", "started"]
weight = 250
+++

# Getting started with Grafana and InfluxDB

{{< docs/shared "influxdb/intro.md" >}}

{{< docs/shared "getting-started/first-step.md" >}}

## Step 2. Get InfluxDB

You can [download InfluxDB](https://portal.influxdata.com/downloads/) and install it locally or you can sign up for [InfluxDB Cloud](https://www.influxdata.com/products/influxdb-cloud/).

> **Note:** Windows installers are not available for some versions of InfluxDB.

## Step 3. Install other InfluxDB software

[Install Telegraf](https://docs.influxdata.com/telegraf/v1.18/introduction/installation/). This tool is an agent that helps you get metrics into InfluxDB. For more information, refer to [Telegraf documentation](https://docs.influxdata.com/telegraf/v1.18/).

If you chose to use InfluxDB Cloud, then you should [download and install the InfluxDB Cloud CLI](https://portal.influxdata.com/downloads/). This tool allows you to send command line instructions to your cloud account. For more information, refer to [Influx CLI documentation](https://docs.influxdata.com/influxdb/cloud/write-data/developer-tools/influx-cli/).

## Step 4. Get data into InfluxDB

DFP NOTE - STILL TESTING THIS

If you downloaded and installed InfluxDB on your local machine, then use the [Quick Start][https://docs.influxdata.com/influxdb/v2.0/write-data/#quick-start-for-influxdb-oss] feature to visualize InfluxDB metrics.

If you are using the cloud account, then the wizards will guide you through the initial process. For more information, refer to [Configure Telegraf](https://docs.influxdata.com/influxdb/cloud/write-data/no-code/use-telegraf/#configure-telegraf).

> **Note:** Windows users might need to make additional adjustments. Look for special instructions in the InfluxDB documentation.

## Step 4. Connect InfluxDB to Grafana



## Step 5. Add a query



## Step 6. Check InfluxDB metrics in Grafana Explore view

In your Grafana instance, go to the [Explore]({{< relref "../explore/_index.md" >}}) view and build queries to experiment with the metrics you want to monitor. Here you can also debug issues related to collecting metrics.

## Step 7. Start building dashboards

Now that you have a curated list of queries, create [dashboards]({{< relref "../dashboards/_index.md" >}}) to render system metrics monitored by InfluxDB.






When you install Prometheus and node_exporter or windows_exporter, you will find recommended dashboards for use.

The following image shows a dashboard with three panels showing some system metrics.

<img width="850px" src="/img/docs/getting-started/simple_grafana_prom_dashboard.png" caption="Prometheus dashboards" >
