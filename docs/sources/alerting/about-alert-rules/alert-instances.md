+++
title = "Alert instances"
weight = 102
+++

# Alert instances

Grafana managed alerts support multi-dimensional alerting. Each alert rule can create multiple alert instances. This is exceptionally powerful if you are observing multiple series in a single expression.

Consider the following PromQL expression:

```promql
sum by(cpu) (
  rate(node_cpu_seconds_total{mode!="idle"}[1m])
)
```

A rule using this expression will create as many alert instances as the amount of CPUs we are observing after the first evaluation, allowing a single rule to report the status of each CPU.

![@TODO: SCREENSHOT HERE]()
