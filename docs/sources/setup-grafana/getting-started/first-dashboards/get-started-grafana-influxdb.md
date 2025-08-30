---
aliases:
  - ../../../getting-started/getting-started-influxdb/ # /docs/grafana/latest/getting-started/getting-started-influxdb
  - ../../../getting-started/get-started-grafana-influxdb/ # /docs/grafana/latest/getting-started/get-started-grafana-influxdb
description: Learn how to build your first InfluxDB dashboard in Grafana.
labels:
  products:
    - enterprise
    - oss
title: Get started with Grafana and InfluxDB
weight: 400
---

# Get started with Grafana and InfluxDB

{{< docs/shared lookup="influxdb/intro.md" source="grafana" version="<GRAFANA VERSION>" >}}

#### Get InfluxDB

You can [download InfluxDB](https://portal.influxdata.com/downloads/) and install it locally or you can sign up for [InfluxDB Cloud](https://www.influxdata.com/products/influxdb-cloud/). Windows installers are not available for some versions of InfluxDB.

#### Install other InfluxDB software

[Install Telegraf](https://docs.influxdata.com/telegraf/v1.18/introduction/installation/). This tool is an agent that helps you get metrics into InfluxDB. For more information, refer to [Telegraf documentation](https://docs.influxdata.com/telegraf/v1.18/).

If you chose to use InfluxDB Cloud, then you should [download and install the InfluxDB Cloud CLI](https://portal.influxdata.com/downloads/). This tool allows you to send command line instructions to your cloud account. For more information, refer to [Influx CLI documentation](https://docs.influxdata.com/influxdb/cloud/write-data/developer-tools/influx-cli/).

#### Get data into InfluxDB

If you downloaded and installed InfluxDB on your local machine, then use the [Quick Start](https://docs.influxdata.com/influxdb/v2.0/write-data/#quick-start-for-influxdb-oss) feature to visualize InfluxDB metrics.

If you are using the cloud account, then the wizards will guide you through the initial process. For more information, refer to [Configure Telegraf](https://docs.influxdata.com/influxdb/cloud/write-data/no-code/use-telegraf/#configure-telegraf).

##### Note for Windows users:

Windows users might need to make additional adjustments. Look for special instructions in the InfluxData documentation and [Using Telegraf on Windows](https://www.influxdata.com/blog/using-telegraf-on-windows/) blog post. The regular system monitoring template in InfluxDB Cloud is not compatible with Windows. Windows users who use InfluxDB Cloud to monitor their system will need to use the [Windows System Monitoring Template](https://github.com/influxdata/community-templates/tree/master/windows_system).

#### Add your InfluxDB data source to Grafana

You can have more than one InfluxDB data source defined in Grafana.

1. Follow the general instructions to [add a data source](../../datasources/#add-a-data-source).
1. Decide if you will use InfluxQL or Flux as your query language.
   - [Configure the data source](../../datasources/influxdb/#configure-the-data-source) for your chosen query language.
     Each query language has its own unique data source settings.
   - For querying features specific to each language, see the data source's [query editor documentation](../../datasources/influxdb/query-editor/).

##### InfluxDB guides

InfluxDB publishes guidance for connecting different versions of their product to Grafana.

- **InfluxDB OSS or Enterprise 1.8+.** To turn on Flux, refer to [Configure InfluxDB](https://docs.influxdata.com/influxdb/v1.8/administration/config/#flux-enabled-false.). Select your InfluxDB version in the upper right corner.
- **InfluxDB OSS or Enterprise 2.x.** Refer to [Use Grafana with InfluxDB](https://docs.influxdata.com/influxdb/v2.0/tools/grafana/). Select your InfluxDB version in the upper right corner.
- **InfluxDB Cloud.** Refer to [Use Grafana with InfluxDB Cloud](https://docs.influxdata.com/influxdb/cloud/tools/grafana/).

##### Important tips

- Make sure your Grafana token has read access. If it doesn't, then you'll get an authentication error and be unable to connect Grafana to InfluxDB.
- Avoid apostrophes and other non-standard characters in bucket and token names.
- If the text name of the organization or bucket doesn't work, then try the ID number.
- If you change your bucket name in InfluxDB, then you must also change it in Grafana and your Telegraf .conf file as well.

#### Add a query

This step varies depending on the query language that you selected when you set up your data source in Grafana.

##### InfluxQL query language

In the query editor, click **select measurement**.

![InfluxQL query](/static/img/docs/influxdb/influxql-query-7-5.png)

Grafana displays a list of possible series. Click one to select it, and Grafana graphs any available data. If there is no data to display, then try another selection or check your data source.

##### Flux query language

Create a simple Flux query.

1. [Add a panel](../../dashboards/build-dashboards/create-dashboard/).
1. In the query editor, select your InfluxDB-Flux data source. For more information, refer to [Queries](../../panels-visualizations/query-transform-data/).
1. Select the **Table** visualization.
1. In the query editor text field, enter `buckets()` and then click outside of the query editor.

This generic query returns a list of buckets.

![Flux query](/static/img/docs/influxdb/flux-query-7-5.png)

You can also create Flux queries in the InfluxDB Explore view.

1. In your browser, log in to the InfluxDB native UI (OSS is typically something like http://localhost:8086 or for InfluxDB Cloud use: https://cloud2.influxdata.com).
1. Click **Explore** to open the Data Explorer.
1. The InfluxDB Data Explorer provides two mechanisms for creating Flux queries: a graphical query editor and a script editor. Using the graphical query editor, [create a query](https://docs.influxdata.com/influxdb/cloud/query-data/execute-queries/data-explorer/). It will look something like this:

   ![InfluxDB Explore query](/static/img/docs/influxdb/influx-explore-query-7-5.png)

1. Click **Script Editor** to view the text of the query, and then copy all the lines of your Flux code, which will look something like this:

   ![InfluxDB Explore Script Editor](/static/img/docs/influxdb/explore-query-text-7-5.png)

1. In Grafana, [add a panel](../../dashboards/build-dashboards/create-dashboard/) and then paste your Flux code into the query editor.
1. Click **Apply**. Your new panel should be visible with data from your Flux query.

#### Check InfluxDB metrics in Grafana Explore

In your Grafana instance, go to the [Explore](../../explore/) view and build queries to experiment with the metrics you want to monitor. Here you can also debug issues related to collecting metrics.

#### Start building dashboards

There you go! Use Explore and Data Explorer to experiment with your data, and add the queries that you like to your dashboard as panels. Have fun!

Here are some resources to learn more:

- Grafana documentation: [InfluxDB data source](../../datasources/influxdb/)
- InfluxDB documentation: [Comparison of Flux vs InfluxQL](https://docs.influxdata.com/influxdb/v1.8/flux/flux-vs-influxql/)
