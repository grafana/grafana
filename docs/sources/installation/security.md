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

If you run non-Grafana web services on your Grafana server or within its local network, then they might be vulnerable to exploitation through the Grafana data source proxy or other methods.

To prevent this type of exploitation from happening, we recommend that you apply one or more of the precautions listed below.

## Limit IP addresses/hostnames for data source URL

You can configure Grafana to only allow certain IP addresses or hostnames to be used as data source URLs and proxied through the Grafana data source proxy. Refer to [data_source_proxy_whitelist]({{< relref "configuration/#data-source-proxy-whitelist" >}}) for usage instructions.

## Firewall rules

Configure a firewall to restrict Grafana from making network requests to sensitive internal web services. 

There are many firewall tools available, refer to the documentation for your specific security tool. For example, Linux users can use [iptables](https://en.wikipedia.org/wiki/Iptables).

## Proxy server

Require all network requests being made by Grafana to go through a proxy server.

## Limit Viewer query permissions

Users with the Viewer role can enter *any possible query* in *any* of the data sources available in the **organization**, not just the queries that are defined on the dashboards for which the user has Viewer permissions.

**For example:** In a Grafana instance with one data source, one dashboard, and one panel that has one query defined, you might assume that a Viewer can only see the result of the query defined in that panel. Actually, the Viewer has access to send any query to the data source. With a command-line tool like curl (there are lots of tools for this), the Viewer can make their own query to the data source and potentially access sensitive data.

To address this vulnerability, you can restrict data source query access in the following ways:

- Create multiple data sources with some restrictions added in data source config that restrict access (like database name or credentials). Then use the [Data Source Permissions]({{< relref "../permissions/datasource_permissions.md" >}}) Enterprise feature to restrict user access to the data source in Grafana.
- Create a separate Grafana organization, and in that organization, create a separate data source. Make sure the data source has some option/user/credentials setting that limits access to a subset of the data. Not all data sources have an option to limit access.
