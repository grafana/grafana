+++
title = "Live feature overview"
description = "Grafana Live feature overview"
keywords = ["Grafana", "live", "guide"]
weight = 100
+++

# Grafana Live feature overview

This topic explains the current Grafana Live capabilities.

## Dashboard change notifications 

As soon as there is a change to the dashboard layout, it is automatically reflected on other devices connected to Grafana Live.

## Data streaming from plugins

With Grafana Live, backend data source plugins can stream updates to frontend panels.

For data source plugin channels Grafana uses `ds` scope. Namespace in the case of data source channels is a data source unique ID (UID) which is issued by Grafana at the moment of data source creation. The path is a custom string that plugin authors free to choose themselves (just make sure it consists of allowed symbols).

For example, a data source channel looks like this: `ds/<DATASOURCE_UID>/<CUSTOM_PATH>`.

Refer to the tutorial about [building a streaming data source backend plugin](https://grafana.com/tutorials/build-a-streaming-data-source-plugin/) for more details.

The basic streaming example included in Grafana core streams frames with some generated data to a panel. To look at it create a new panel and point it to the `-- Grafana --` data source. Next, choose `Live Measurements` and select the `plugin/testdata/random-20Hz-stream` channel. 

## Data streaming from Telegraf

A new API endpoint `/api/live/push/:streamId` allows accepting metrics data in Influx format from Telegraf. These metrics are transformed into Grafana data frames and published to channels.

Refer to the tutorial about [streaming metrics from Telegraf to Grafana](https://grafana.com/tutorials/stream-metrics-from-telegraf-to-grafana/) for more information.
