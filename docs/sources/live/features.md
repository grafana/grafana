+++
title = "Feature overview"
description = "Grafana Live feature overview"
keywords = ["Grafana", "live", "guide"]
weight = 100
+++

# Grafana Live Feature Overview

Let's look at current Grafana Live capabilities.

## Dashboard change notifications 

???

## Data streaming from plugins

With Grafana Live datasource plugins can stream data updates if form of Grafana dataframes to a frontend.

For datasource plugin channels Grafana uses `ds` scope. Namespace in the case of datasource channels is a datasource unique ID (UID) which is issued by Grafana at the moment of datasource creation. The path is a custom string that plugin authors free to choose themselves (just make sure it consists of allowed symbols).

I.e. datasource channel looks like `ds/<DATASOURCE_UID>/<CUSTOM_PATH>`.

See a tutorial about building a streaming datasource backend plugin for more details.

## Data streaming from Telegraf

A new API endpoint `/api/live/push/:streamId` allows accepting metrics data in Influx format from Telegraf. These metrics will be transformed into Grafana dataframes and published to channels.

See a tutorial about streaming data from Telegraf for more details.
