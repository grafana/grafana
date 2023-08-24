+++
title = "Alertmanager"
description = "Guide for using Alertmanager in Grafana"
keywords = ["grafana", "prometheus", "guide"]
aliases = ["/docs/grafana/v8.0/features/datasources/alertmanager"]
weight = 1300
+++

# Alertmanager data source

Grafana includes built-in support for Prometheus Alertmanager. It is presently in alpha and not accessible unless [alpha plugins are enabled in Grafana settings](https://grafana.com/docs/grafana/v8.0/administration/configuration/#enable_alpha). Once you add it as a data source, you can use the [Grafana alerting UI](https://grafana.com/docs/grafana/v8.0/alerting/) to manage silences, contact points as well as notification policies. A drop down option in these pages allows you to switch between Grafana and any configured Alertmanager data sources .

>**Note:** New in Grafana 8.0.

>**Note:** Currently only the [Cortex implementation of Prometheus alertmanager](https://cortexmetrics.io/docs/proposals/scalable-alertmanager/) is supported. 

## Provision the Alertmanager data source

Configure the Alertmanager data sources by updating Grafana's configuration files. For more information on how it works and the settings available, refer to the [provisioning docs page]({{< relref "../administration/provisioning/#datasources" >}}).

Here is an example for provisioning the Alertmanager data source:

```yaml
apiVersion: 1

datasources:
  - name: Alertmanager
    type: alertmanager
    url: http://localhost:9090
    access: proxy
    # optionally
    basicAuth: true
    basicAuthUser: my_user
    basicAuthPassword: test_password
```
