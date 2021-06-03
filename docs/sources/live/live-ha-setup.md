+++
title = "Live HA setup"
description = "Grafana Live HA setup guide"
keywords = ["Grafana", "live", "guide", "ha"]
weight = 130
+++

# Configure Grafana Live HA setup

Live features in Grafana v8.0 are designed to work with a single Grafana server instance only. We will add the option for HA configuration in future Grafana releases to eliminate the current limitations.

Currently, if you have several Grafana server instances behind a load balancer, you may come across the following limitations:

- Built-in features like dashboard change notifications will only be broadcasted to users connected to the same Grafana server process instance.
- Streaming from Telegraf will deliver data only to clients connected to the same instance which received Telegraf data, active stream cache is not shared between different Grafana instances.
- A separate unidirectional stream between Grafana and backend data source may be opened on different Grafana servers for the same channel.
