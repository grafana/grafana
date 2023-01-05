---
aliases:
  - live-feature-overview/
title: Grafana Live
weight: 115
---

# Grafana Live overview

Grafana Live is a real-time messaging engine introduced in Grafana v8.0.

With Grafana Live, you can push event data to a frontend as soon as an event occurs.

This could be notifications about dashboard changes, new frames for rendered data, and so on. Live features can help eliminate a page reload or polling in many places, it can stream Internet of things (IOT) sensors or any other real-time data to panels.

> **Note:** By `real-time`, we indicate a soft real-time. Due to network latencies, garbage collection cycles, and so on, the delay of a delivered message can be up to several hundred milliseconds or higher.

## Concepts

Grafana Live sends data to clients over persistent WebSocket connection. Grafana frontend subscribes on channels to receive data which was published into that channel – in other words PUB/SUB mechanics is used. All subscriptions on a page multiplexed inside a single WebSocket connection. There are some rules regarding Live channel names – see [Live channel]({{< relref "./live-channel.md" >}}).

Handling persistent connections like WebSocket in scale may require operating system and infrastructure tuning. That's why by default Grafana Live supports 100 simultaneous connections max. For more details on how to tune this limit, refer to [Live configuration section]({{< relref "configure-grafana-live.md" >}}).

## Features

Having a way to send data to clients in real-time opens a road for new ways of data interaction and visualization. Below we describe Grafana Live features supported at the moment.

### Dashboard change notifications

As soon as there is a change to the dashboard layout, it is automatically reflected on other devices connected to Grafana Live.

### Data streaming from plugins

With Grafana Live, backend data source plugins can stream updates to frontend panels.

For data source plugin channels, Grafana uses `ds` scope. Namespace in the case of data source channels is a data source unique ID (UID) which is issued by Grafana at the moment of data source creation. The path is a custom string that plugin authors free to choose themselves (just make sure it consists of allowed symbols).

For example, a data source channel looks like this: `ds/<DATASOURCE_UID>/<CUSTOM_PATH>`.

Refer to the tutorial about [building a streaming data source backend plugin](https://grafana.com/tutorials/build-a-streaming-data-source-plugin/) for more details.

The basic streaming example included in Grafana core streams frames with some generated data to a panel. To look at it create a new panel and point it to the `-- Grafana --` data source. Next, choose `Live Measurements` and select the `plugin/testdata/random-20Hz-stream` channel.

### Data streaming from Telegraf

A new API endpoint `/api/live/push/:streamId` allows accepting metrics data in Influx format from Telegraf. These metrics are transformed into Grafana data frames and published to channels.

Refer to the tutorial about [streaming metrics from Telegraf to Grafana](https://grafana.com/tutorials/stream-metrics-from-telegraf-to-grafana/) for more information.
