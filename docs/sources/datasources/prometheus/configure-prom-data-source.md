---
aliases:
  - ../data-sources/prometheus/
  - ../features/datasources/prometheus/
description: Guide for using Prometheus in Grafana
keywords:
  - grafana
  - prometheus
  - guide
menuTitle: Configure the Prometheus data source
title: Configure the Prometheus data source
weight: 1305
---

# Configure the Prometheus data source

To configure the Prometheus data source, complete the following steps:

1. Under the left-side menu, click **Connections**.
1. Click **Add new connection**.
1. In the search bar, type `prometheus`.
1. Select **Prometheus**.
1. Click **Create a Prometheus data source** in the upper right to start configuring the connection.
1. In the first section, give your connection a name. This is how you refer to the data source in dashboard panels and queries.
1. Toggle **Default** on if you want this as the default selected data source in your dashboard panels.
1. In the HTTP section, add your server URL. If you are running Prometheus locally, use <http://localhost:9090>. If you are running Prometheus on a server within a network, use the url of this server.
1. Grafana deletes forwarded cookies by default. If you want to allow cookies, you can add the cookie file name in **Allowed cookies**.
1. Set an HTTP request in the HTTP timeout section. Examples: `15s`, `60s`.
1. Select an authorization method in the Authentication section.
