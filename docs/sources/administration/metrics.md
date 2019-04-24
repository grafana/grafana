+++
title = "Internal metrics"
description = "Internal metrics exposed by Grafana"
keywords = ["grafana", "metrics", "internal metrics"]
type = "docs"
[menu.docs]
parent = "admin"
weight = 8
+++

# Internal metrics

Grafana collects some metrics about itself internally. Currently, Grafana supports pushing metrics to Graphite or exposing them to be scraped by Prometheus.

To emit internal metrics you have to enable the option under the [metrics] section in your [grafana.ini](http://docs.grafana.org/installation/configuration/#enabled-6) config file. If you want to push metrics to Graphite, you must also configure the [metrics.graphite](http://docs.grafana.org/installation/configuration/#metrics-graphite) section.
