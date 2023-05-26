---
title: Stream metrics from Telegraf to Grafana
summary: Use Telegraf to stream live metrics to Grafana.
description: Use Telegraf to stream live metrics to Grafana.
id: stream-metrics-from-telegraf-to-grafana
categories: ['administration']
tags: ['beginner']
status: Published
authors: ['grafana_labs']
Feedback Link: https://github.com/grafana/tutorials/issues/new
weight: 75
---

## Introduction

Grafana v8 introduced streaming capabilities – a way to push data to UI panels in near real-time. In this tutorial we show how Grafana real-time streaming capabilities can be used together with Telegraf to instantly display system measurements.

In this tutorial, you'll:

- Setup Telegraf and output measurements directly to Grafana time-series panel in near real-time

{{% class "prerequisite-section" %}}

#### Prerequisites

- Grafana 8.0+
- Telegraf
  {{% /class %}}

## Run Grafana and create admin token

1. Run Grafana following [installation instructions](/docs/grafana/latest/installation/) for your operating system
1. Log in and go to Configuration -> API Keys
1. Press "Add API key" button and create a new API token with **Admin** role

## Configure and run Telegraf

Telegraf is a plugin-driven server agent for collecting and sending metrics and events from databases, systems, and IoT sensors.

You can install it following [official installation instructions](https://docs.influxdata.com/telegraf/latest/introduction/installation/).

In this tutorial we will be using Telegraf HTTP output plugin to send metrics in Influx format to Grafana. We can use a configuration like this:

```
[agent]
  interval = "1s"
  flush_interval = "1s"

[[inputs.cpu]]
  percpu = false
  totalcpu = true

[[outputs.http]]
  url = "http://localhost:3000/api/live/push/custom_stream_id"
  data_format = "influx"
  [outputs.http.headers]
    Authorization = "Bearer <Your API Key>"
```

Make sure to replace `<Your API Key>` placeholder with your actual API key created in the previous step. Save this config into `telegraf.conf` file and run Telegraf pointing to this config file. Telegraf will periodically (once in a second) report the state of total CPU usage on a host to Grafana (which is supposed to be running on `http://localhost:3000`). Of course you can replace `custom_stream_id` to something more meaningful for your use case.

Inside Grafana Influx data is converted to Grafana data frames and then frames are published to Grafana Live channels. In this case, the channel where CPU data will be published is `stream/custom_stream_id/cpu`. The `stream` scope is constant, the `custom_stream_id` namespace is the last part of API URL set in Telegraf configuration (`http://localhost:3000/api/live/push/telegraf`) and the path is `cpu` - the name of a measurement.

The only thing left here is to create a dashboard with streaming data.

## Create dashboard with streaming data

1. Create new dashboard
1. Press Add empty panel
1. Select `-- Grafana --` datasource
1. Select `Live Measurements` query type
1. Find and select `stream/custom_stream_id/cpu` measurement for Channel field
1. Save dashboard changes

After making these steps Grafana UI should subscribe to the channel `stream/custom_stream_id/cpu` and you should see CPU data updates coming from Telegraf in near real-time.

## Stream using WebSocket endpoint

If you aim for a high-frequency update sending then you may want to use the WebSocket output plugin of Telegraf (introduced in Telegraf v1.19.0) instead of the HTTP output plugin we used above. Configure WebSocket output plugin like this:

```
[agent]
  interval = "500ms"
  flush_interval = "500ms"

[[inputs.cpu]]
  percpu = false
  totalcpu = true

[[outputs.websocket]]
  url = "ws://localhost:3000/api/live/push/custom_stream_id"
  data_format = "influx"
  [outputs.websocket.headers]
    Authorization = "Bearer <Your API Key>"
```

WebSocket avoids running all Grafana HTTP middleware on each request from Telegraf thus reducing Grafana backend CPU usage significantly.

## Summary

In this tutorial you learned how to use Telegraf to stream live metrics to Grafana.
