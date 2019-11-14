+++
title = "Security"
description = "Security Docs"
keywords = ["grafana", "security", "documentation"]
type = "docs"
[menu.docs]
name = "Security"
identifier = "security"
parent = "admin"
weight = 2
+++

# Security

## Data source proxy and protecting internal services

If you have non-Grafana web services running on your Grafana server or within its local network, these may be vulnerable to exploitation via the Grafana data source proxy.

To prevent this type of exploitation from happening we explain a couple of different solutions  below.

### Configure Grafana to only allow certain IP addresses/hostnames to be used as data source url

You can configure Grafana to only allow certain IP addresses/hostnames to be used as data source url and by that proxied through the Grafana data source proxy. See [data_source_proxy_whitelist](/installation/configuration/#data-source-proxy-whitelist) for usage instructions.

### Firewall rules

You should be able to configure a firewall, for example using iptables, to restrict Grafana from making network requests to certain internal web services.

### Proxy server

You should be able to require all network requests being made by Grafana to go through a proxy server.

## Viewer query permissions

Important to understand that users with Viewer role can still issue any possible query to all data sources available in the **organization**. Not just the queries that are defined on the dashboards the user with Viewer role has permissions to view.

There are a couple of ways you can restrict data source query access:

- Create multiple data sources with some restrictions added in data source config that restrict access (like database name or credentials). Then use the [Data Source Permissions]({{< relref "permissions/datasource_permissions.md" >}}) Enterprise feature to restrict user access to the data source in Grafana.
- Create a separate Grafana organization and in that organization create a separate data source. Make sure the data source has some option/user/credentials setting that limits access to a subset of the data. Not all data sources have an option to limit access.
