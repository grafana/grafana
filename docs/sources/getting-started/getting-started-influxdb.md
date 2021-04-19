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

If you downloaded and installed InfluxDB on your local machine, then use the [Quick Start][https://docs.influxdata.com/influxdb/v2.0/write-data/#quick-start-for-influxdb-oss] feature to visualize InfluxDB metrics.

If you are using the cloud account, then the wizards will guide you through the initial process. For more information, refer to [Configure Telegraf](https://docs.influxdata.com/influxdb/cloud/write-data/no-code/use-telegraf/#configure-telegraf).

> **Note:** Windows users might need to make additional adjustments. Look for special instructions in the InfluxData documentation and [Using Telegraf on Windows](https://www.influxdata.com/blog/using-telegraf-on-windows/) blog post.

> **Note:** The regular system monitoring template in InfluxDB Cloud is not compatible with Windows. Windows users who use InfluxDB Cloud to monitor their system will need to use the [Windows System Monitoring Template](https://github.com/influxdata/community-templates/tree/master/windows_system).

## Step 4. Add your InfluxDB data source to Grafana

You can have more than one InfluxDB data source defined in Grafana.

1. Follow the general instructions to [add a data source]({{< relref "../datasources/add-a-data-source.md" >}}).
1. Decide if you will use InfluxQL or Flux as your query language.
   - For InfluxQL, refer to [InfluxDB data source]({{< relref "../datasources/influxdb/_index.md" >}}) for information about specific data source fields.
   - For Flux, refer to [Flux query language in Grafana]({{< relref "../datasources/influxdb/influxdb-flux.md" >}}) for information about specific data source fields.

### InfluxDB guides

InfluxDB publishes guidance for connecting different versions of their product to Grafana.

- **InfluxDB OSS or Enterprise 1.8+.** To turn on Flux, refer to [Configure InfluxDB](https://docs.influxdata.com/influxdb/v1.8/administration/config/#flux-enabled-false.). Select your InfluxDB version in the upper right corner.
- **InfluxDB OSS or Enterprise 2.x.** Refer to [Use Grafana with InfluxDB](https://docs.influxdata.com/influxdb/v2.0/tools/grafana/). Select your InfluxDB version in the upper right corner.
-  **InfluxDB Cloud.** Refer to [Use Grafana with InfluxDB Cloud](https://docs.influxdata.com/influxdb/cloud/tools/grafana/).

### Important tips

- Make sure your Grafana token has read access. If it doesn't, then you'll get an authentication error and be unable to connect Grafana to InfluxDB.
- Avoid apostrophes and other non-standard characters in bucket and token names.
- If the text name of the organization or bucket doesn't work, then try the ID number.

## Step 5. Add a query

InfluxQL query

In the query editor, click **select measurement**.

INSERT SCREENSHOT

Grafana displays a list of possible series. Click one to select it, and Grafana graphs any available data. If there is no data to display, then try another selection or check your data source.

### Flux query

Create a simple Flux query.

1. [Add a panel](../panels/add-a-panel.md).
1. In the query editor, select your InfluxDB-Flux data source. For more information, refer to [Queries](../panels/queries.md).
1. Select the **Table** visualization.
1. In the query editor text field, enter `buckets()` and then click outside of the query editor.

This generic query returns a list of buckets.

ADD SCREENSHOT

You can also create Flux queries in the InfluxDB Explore view.

ADD INSTRUCTIONS

## Step 6. Check InfluxDB metrics in Grafana Explore view

In your Grafana instance, go to the [Explore]({{< relref "../explore/_index.md" >}}) view and build queries to experiment with the metrics you want to monitor. Here you can also debug issues related to collecting metrics.

## Step 7. Start building dashboards


DFP note - copied this from Prometheus, not sure it makes sense.




When you install Prometheus and node_exporter or windows_exporter, you will find recommended dashboards for use.

The following image shows a dashboard with three panels showing some system metrics.

<img width="850px" src="/img/docs/getting-started/simple_grafana_prom_dashboard.png" caption="Prometheus dashboards" >
