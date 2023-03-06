---
aliases:
  - ../data-sources/alertmanager/
  - ../features/datasources/alertmanager/
description: Guide for using Alertmanager as a data source in Grafana
keywords:
  - grafana
  - prometheus
  - alertmanager
  - guide
  - queries
menuTitle: Alertmanager
title: Alertmanager data source
weight: 150
---

# Alertmanager data source

Grafana includes built-in support for Alertmanager implementations in Prometheus and Mimir.
Once you add it as a data source, you can use the [Grafana Alerting UI](/docs/grafana/latest/alerting/) to manage silences, contact points, and notification policies.
To switch between Grafana and any configured Alertmanager data sources, you can select your preference from a drop-down option in those databases' data source settings pages.

## Alertmanager implementations

The data source supports [Prometheus](https://prometheus.io/) and [Grafana Mimir](https://grafana.com/docs/mimir/latest/) (default) implementations of Alertmanager.
You can specify the implementation in the data source's Settings page.
When using Prometheus, contact points and notification policies are read-only in the Grafana Alerting UI, because it doesn't support updates to the configuration using HTTP API.

## Configure the data source

**To access the data source configuration page:**

1. Select the **Data sources** section from the **Administration** menu
2. Select the **Alertmanager** data source

Set the data source's basic configuration options carefully:

| Name                       | Description                                                                                                                                                                                                   |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Name**                   | Sets the name you use to refer to the data source                                                                                                                                                             |
| **Default**                | Sets whether the data source is pre-selected for new panels and queries                                                                                                                                       |
| **Alertmanager**           |                                                                                                                                                                                                               |
| **Implementation**         | Alertmanager implementation. **Mimir**, **Cortex,** and **Prometheus** are supported                                                                                                                          |
| **Receive Grafana Alerts** | When enabled the Alertmanager receives alert instances from Grafana-managed alert rules. **Important:** It works only if Grafana alerting is configured to send its alert instances to external Alertmanagers |
| **HTTP**                   |                                                                                                                                                                                                               |
| **URL**                    | Sets the HTTP protocol, IP, and port of your Alertmanager instance, such as `https://alertmanager.example.org:9093`                                                                                           |
| **Access**                 | Only **Server** access mode is functional                                                                                                                                                                     |
|                            |                                                                                                                                                                                                               |

## Provision the Alertmanager data source

You can provision Alertmanager data sources by updating Grafana's configuration files.
For more information on provisioning, and common settings available, refer to the [provisioning docs page]({{< relref "../../administration/provisioning/#datasources" >}}).

Here is an example for provisioning the Alertmanager data source:

```yaml
apiVersion: 1

datasources:
  - name: Alertmanager
    type: alertmanager
    url: http://localhost:9093
    access: proxy
    jsonData:
      # Valid options for implementation include mimir, cortex and prometheus
      implementation: prometheus
      # Whether or not Grafana should send alert instances to this Alertmanager
      handleGrafanaManagedAlerts: false
    # optionally
    basicAuth: true
    basicAuthUser: my_user
    secureJsonData:
      basicAuthPassword: test_password
```
