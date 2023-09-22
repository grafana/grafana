---
canonical: https://grafana.com/docs/grafana/latest/alerting/fundamentals/alert-rules/recording-rules/
description: Learn about recording rules
keywords:
  - grafana
  - alerting
  - recording rules
labels:
  products:
    - cloud
    - enterprise
    - oss
title: Recording rules
weight: 103
---

# Recording rules

_Recording rules are only available for compatible Prometheus or Loki data sources._

A recording rule allows you to pre-compute frequently needed or computationally expensive expressions and save their result as a new set of time series. This is useful if you want to run alerts on aggregated data or if you have dashboards that query computationally expensive expressions repeatedly.

Querying this new time series is faster, especially for dashboards since they query the same expression every time the dashboards refresh.

Grafana Enterprise offers an alternative to recorded rules in the form of recorded queries that can be executed against any data source.

For more information on recording rules in Prometheus, refer to [recording rules](https://prometheus.io/docs/prometheus/latest/configuration/recording_rules/).
