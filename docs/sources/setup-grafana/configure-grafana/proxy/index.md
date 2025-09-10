---
description: Learn about proxy datasource connections through a secure socks proxy.
keywords:
  - proxy
  - guide
  - Grafana
labels:
  products:
    - enterprise
    - oss
menuTitle: Configure data source proxy
title: Configure a data source SOCKS5 connection proxy
weight: 1110
---

# Configure a data source SOCKS5 connection proxy

Grafana provides support for proxying data source connections through a secure SOCKS5 proxy. This enables you to securely connect to data sources hosted in a different network than Grafana.

To make use of this functionality, you need to deploy a SOCKS5 proxy server that supports TLS on a machine accessible from where your Grafana instance is running, and within the same network as your data source. From there, Grafana establishes a mutually trusted connection from Grafana to the proxy. Then the SOCKS5 proxy can proxy the Grafana data source connection to your private data source instance without exposing your data source to the public internet.

## Known limitations

- You can configure only one SOCKS5 proxy per Grafana instance. This is because the SOCKS5 proxy address and TLS configuration is set at the Grafana instance level.
- All built-in core data sources are compatible, but not all external data sources are. For a list of supported data sources, refer to [private data source connect](/docs/grafana-cloud/data-configuration/configure-private-datasource-connect/#known-limitations).

## Before you begin

To complete this task, you must first have a SOCKS5 proxy server running, using host certificates signed by a Certificate Authority (CA) that you can get the public certificate for. You must also have a TLS client key pair for Grafana, with the client certificate signed by the same CA used to sign the proxy server certificate.

## Steps

1. For Grafana to send data source connections to the socks5 server, use the following table to configure the `secure_socks_datasource_proxy` section of the `config.ini`:

   | Key              | Description                                                                 | Example                         |
   | ---------------- | --------------------------------------------------------------------------- | ------------------------------- |
   | `enabled`        | Enable this feature in Grafana                                              | true                            |
   | `root_ca_cert`   | The file path of the root ca cert used to sign the proxy server certificate | /etc/ca.crt                     |
   | `client_key`     | The file path of the client private key                                     | /etc/client.key                 |
   | `client_cert`    | The file path of the client public key                                      | /etc/client.crt                 |
   | `server_name`    | The domain name of the proxy, used for SNI                                  | proxy.grafana.svc.cluster.local |
   | `proxy_address`  | The address of the proxy                                                    | localhost:9090                  |
   | `allow_insecure` | Disable TLS in the socks proxy                                              | false                           |

1. Set up a data source and configure it to send data source connections through the proxy.

   To configure your data sources to send connections through the proxy, `enableSecureSocksProxy=true` must be specified in the data source json. You can do this in the [API](../../../developers/http_api/data_source/) or use [file based provisioning](../../../administration/provisioning/#data-sources).

   Additionally, if using SOCKS5 authentication, you can set the SOCKS5 username and password by adding `secureSocksProxyUsername` in the data source's `jsonData` field and `secureSocksProxyPassword` in the data source's `secureJsonData` field.
