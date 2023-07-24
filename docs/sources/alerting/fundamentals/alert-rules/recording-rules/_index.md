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

**Note:**

Recording rules are run as instant rules, which means that they run every 10s. To overwrite this configuration, update the min_interval in your custom configuration file.

[min_interval][configure-grafana] sets the minimum interval to enforce between rule evaluations. The default value is 10s which equals the scheduler interval. Rules will be adjusted if they are less than this value or if they are not multiple of the scheduler interval (10s). Higher values can help with resource management as fewer evaluations are scheduled over time.

This setting has precedence over each individual rule frequency. If a rule frequency is lower than this value, then this value is enforced.
