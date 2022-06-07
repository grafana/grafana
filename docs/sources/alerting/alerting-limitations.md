---
aliases:
  - /docs/grafana/latest/alerting/alerting-limitations/
title: Limitations
weight: 552
---

# Limitations

## Limited rule sources support

Grafana alerting system can retrieve rules from all available Prometheus, Loki, Mimir and Alertmanager data sources.

It might not be able to fetch alerting rules from all other supported data sources at this time.

## Prometheus version support

We aim to support the latest two minor versions of both Prometheus and Alertmanager. We cannot guarantee that older versions will work.

As an example, if the current Prometheus version is `2.31.1`, we support >= `2.29.0`.

## Grafana is not an alert receiver

Grafana is not an alert receiver, is it an alert generator. This means that Grafana cannot receive alerts from anything other than its internal alert generator.

Receiving alerts from Prometheus (or anything else) is not supported at the time.

Please see [this GitHub discussion](https://github.com/grafana/grafana/discussions/45773) for additional details.
