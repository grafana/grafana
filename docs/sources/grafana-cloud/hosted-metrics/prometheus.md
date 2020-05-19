+++
title = "Prometheus"

[menu.grafana-cloud]
identifier = "prometheus"
parent = "hosted-metrics"
+++

# Hosted Metrics — Prometheus


## Sending data from Prometheus

To send data using Prometheus you need the following:

* A running instance of Prometheus.
* In your Prometheus configuration, add a `remote_write` section.

Here is the code you should add to your Prometheus config:

```yaml
remote_write:
- url: https://prometheus-us-central1.grafana.net/api/prom/push
  basic_auth:
    username: <Your Hosted Metrics instance ID>
    password: <Your Grafana.com API Key>
```

When sending metrics from multiple Prometheis, you may label data points with an `external_labels` config in the global section:

```yaml
global:
  external_labels:
    origin_prometheus: prometheus01
remote_write:
- url: https://prometheus-us-central1.grafana.net/api/prom/push
  basic_auth:
    username: <Your Hosted Metrics instance ID>
    password: <Your Grafana.com API Key>
```

For more information on Prometheus configuration, see the
[Prometheus.io Configuration Docs](https://prometheus.io/docs/operating/configuration/#%3Cremote_write%3E).


## Data flow diagram

{{< figure src="/static/img/hosted-metrics/hosted_metrics_prom_diagram.svg" caption="Prometheus API Hosted Metrics data flow diagram" >}}


### Prometheus Query Endpoint

This is the URL you use get the data, for example, in the data source config in Grafana.

    https://prometheus-us-central1.grafana.net/api/prom

### Prometheus Remote Write Endpoint

This is the URL you use to send the data to us.

    https://prometheus-us-central1.grafana.net/api/prom/push
