---
description: Learn about proxy datasource connections through a secure socks proxy.
keywords:
  - proxy
  - guide
  - Grafana
title: Configure a data source connection proxy
menuTitle: Configure data source proxy
weight: 1110
---

# Configure a data source connection proxy

Grafana provides support for proxying data source connections through a Secure Socks5 Tunnel. This enables you to securely connect to data sources hosted in a different network than Grafana.

To make use of this functionality, you need to deploy a socks5 proxy server that supports TLS on a machine exposed to the public internet within the same network as your data source. From there, Grafana establishes a mutually trusted connection from Grafana to the Proxy. Then the Proxy can proxy the Grafana connection to your private server without exposing your data sources to the public internet.

## Known limitations

- You can configure only one socks5 proxy per Grafana instance
- All built-in core data sources are compatible, but not all external data sources are. For a list of supported data sources, refer to [private data source connect](/docs/grafana-cloud/data-configuration/configure-private-datasource-connect/#known-limitations).

## Before you begin

To complete this task, you must first deploy a socks proxy server that supports TLS, is publicly accessible, and is hosted within the same network as the data source.

## Steps

1. For Grafana to send data source connections to the socks5 server, use the following table to configure the `secure_socks_datasource_proxy` section of the `config.ini`:

   | Key             | Description                                | Example                         |
   | --------------- | ------------------------------------------ | ------------------------------- |
   | `enabled`       | Enable this feature in Grafana             | true                            |
   | `root_ca_cert`  | The file path of the root ca cert          | /etc/ca.crt                     |
   | `client_key`    | The file path of the client private key    | /etc/client.key                 |
   | `client_cert`   | The file path of the client public key     | /etc/client.crt                 |
   | `server_name`   | The domain name of the proxy, used for SNI | proxy.grafana.svc.cluster.local |
   | `proxy_address` | the address of the proxy                   | localhost:9090                  |

1. Set up a data source and configure it to send data source connections through the proxy.

   To configure your data sources to send connections through the proxy, `enableSecureSocksProxy=true` must be specified in the data source json. You can do this in the [API]({{< relref "../../../developers/http_api/data_source" >}}) or use [file based provisioning]({{< relref "../../../administration/provisioning#data-sources" >}}).

   Additionally, you can set the socks5 username and password by adding `secureSocksProxyUsername` in the data source json and `secureSocksProxyPassword` in the secure data source json.
