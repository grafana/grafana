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

Grafana provides support for proxying a data source connections through a Socks5 server with TLS. This enables you to securely connect to data sources living in a different network than Grafana.

## Known Limitations

- Only one socks5 server can be configured per Grafana instance
- All built-in core data sources are compatible, but not all external data sources are. For an external data source to be compatible, it must use the grafana-plugin-sdk-go to wrap the connection.

## Configure the proxy

### Pre-requisite

You will need to set up a socks5 server that:

- Supports TLS
- Can connect to your data source
- Is reachable by Grafana

### Configuring Grafana

In order for Grafana to send data sources connections to the socks5 server, you will need to configure the `secure_socks_datasource_proxy` section of your config.ini with the following information:

| Key             | Description                                | Example                         |
| --------------- | ------------------------------------------ | ------------------------------- |
| `enabled`       | Enable this feature in Grafana             | true                            |
| `root_ca_cert`  | The file path of the root ca cert          | /etc/ca.crt                     |
| `client_key`    | The file path of the client private key    | /etc/client.key                 |
| `client_cert`   | The file path of the client public key     | /etc/client.crt                 |
| `server_name`   | The domain name of the proxy, used for SNI | proxy.grafana.svc.cluster.local |
| `proxy_address` | the address of the proxy                   | localhost:9090                  |

### Configuring data sources

To configure your data sources to send connections through the proxy, `enableSecureSocksProxy=true` must be specified in the data source json. This can be toggled in the Grafana UI when `secure_socks_datasource_proxy.enabled` is set to true in your config.ini.

Additionally, socks5 username and password can be set by adding `secureSocksProxyUsername` in the data source json and `secureSocksProxyPassword` in the secure data source json.
