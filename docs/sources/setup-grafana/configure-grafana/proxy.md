---
aliases:
  - ../features/datasources/proxy/
description: Proxy datasource connections through a secure socks proxy.
keywords:
  - proxy
  - guide
title: Proxying data source connections
weight: 1110
---

# Proxying data source connections

Grafana provides support for proxying data source connections through a Secure Socks5 Tunnel. This enables you to securely connect to data sources living in a different network than Grafana.

In order to make use of this functionality, you will need to deploy a socks5 proxy server that supports TLS on a machine exposed to the public internet within the same network as your data source. From there, Grafana will set up a mutually trusted connection from Grafana to the Proxy, and then the Proxy can proxy the Grafana connection to your private server, without exposing your data sources to the public internet.

## Known limitations

- Only one socks5 proxy can be configured per Grafana instance
- All built-in core data sources are compatible, but not all external data sources are. See the [private datasource connect docs](https://grafana.com/docs/grafana-cloud/data-configuration/configure-private-datasource-connect/#known-limitations) for an updated list of supported data sources.

## Configuring Grafana to use the proxy

### Configuring Grafana

In order for Grafana to send data source connections to the socks5 server, you will need to configure the `secure_socks_datasource_proxy` section of your config.ini with the following information:

| Key             | Description                                | Example                         |
| --------------- | ------------------------------------------ | ------------------------------- |
| `enabled`       | Enable this feature in Grafana             | true                            |
| `root_ca_cert`  | The file path of the root ca cert          | /etc/ca.crt                     |
| `client_key`    | The file path of the client private key    | /etc/client.key                 |
| `client_cert`   | The file path of the client public key     | /etc/client.crt                 |
| `server_name`   | The domain name of the proxy, used for SNI | proxy.grafana.svc.cluster.local |
| `proxy_address` | the address of the proxy                   | localhost:9090                  |

### Configuring data sources

1. Toggle on `secure_socks_datasource_proxy.enabled` in your config.ini.
2. Set up a data source and configure it to send data source connections through the proxy. To configure your data sources to send connections through the proxy, `enableSecureSocksProxy=true` must be specified in the data source json. You can do this in the [API]({{< relref "../developers/http_api/data_source" >}}) or using [file based provisioning]({{< relref "../administration/provisioning/#data-sources" >}}).

Additionally, socks5 username and password can be set by adding `secureSocksProxyUsername` in the data source json and `secureSocksProxyPassword` in the secure data source json.
