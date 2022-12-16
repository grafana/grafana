---
title: Limitations
weight: 552
---

# Limitations

## Limited rule sources support

Grafana Alerting can retrieve alerting and recording rules **stored** in most available Prometheus, Loki, Mimir, and Alertmanager compatible data sources.

It does not support reading or writing alerting rules from any other data sources but the ones previously mentioned at this time.

## Prometheus version support

We support the latest two minor versions of both Prometheus and Alertmanager. We cannot guarantee that older versions will work.

As an example, if the current Prometheus version is `2.31.1`, we support >= `2.29.0`.

## Grafana is not an alert receiver

Grafana is not an alert receiver; is it an alert generator. This means that Grafana cannot receive alerts from anything other than its internal alert generator.

Receiving alerts from Prometheus (or anything else) is not supported at the time.

For more information, refer to [this GitHub discussion](https://github.com/grafana/grafana/discussions/45773).
