---
aliases:
  - /docs/grafana/latest/features/datasources/alertmanager/
  - /docs/grafana/latest/datasources/alertmanager/
  - /docs/grafana/latest/data-sources/alertmanager/
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

Grafana includes built-in support for Prometheus Alertmanager. Once you add it as a data source, you can use the [Grafana Alerting UI](/docs/grafana/latest/alerting/) to manage silences, contact points as well as notification policies. A drop-down option in these pages allows you to switch between Grafana and any configured Alertmanager data sources.

## Alertmanager implementations

[Prometheus](https://prometheus.io/) and [Grafana Mimir](/docs/mimir/latest/) (default) implementations of Alertmanager are supported. You can specify implementation in the data source settings page. In case of Prometheus contact points and notification policies are read-only in the Grafana Alerting UI, as it does not support updating configuration via HTTP API.

## Provision the data source

Configure the Alertmanager data sources by updating Grafana's configuration files. For more information on how it works and the settings available, refer to the [provisioning docs page]({{< relref "../../administration/provisioning#data-sources" >}}).

For example, this YAML provisions an Alertmanager data source running on port 9093, with proxy access and basic authentication:

```yaml
apiVersion: 1

datasources:
  - name: Alertmanager
    type: alertmanager
    url: http://localhost:9093
    access: proxy
    jsonData:
    # optionally
    basicAuth: true
    basicAuthUser: my_user
    secureJsonData:
      basicAuthPassword: test_password
```
