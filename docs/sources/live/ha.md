+++
title = "Live HA setup"
description = "Grafana Live HA setup guide"
keywords = ["Grafana", "live", "guide", "ha"]
weight = 130
+++

# Grafana Live HA setup guide

Live features in Grafana v8 designed to work with a single Grafana server instance. We aim to introduce an option for HA setup in future Grafana releases to eliminate current limitations described below.

For Grafana v8, if you have several Grafana server instances behind a load balancer, you may come across the following limitations:

* Built-in features like dashboard change notifications will only be broadcasted to users connected to the same Grafana server process instance
* Streaming from Telegraf will deliver data only to clients connected to the same instance which received Telegraf data
* A separate unidirectional streams between Grafana and backend datasource may be opened on different Grafana servers for the same channel
