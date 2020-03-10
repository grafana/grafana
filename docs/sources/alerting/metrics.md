+++
title = "Alerting Metrics"
description = "Alerting Metrics Guide"
keywords = ["Grafana", "alerting", "guide", "metrics"]
type = "docs"
[menu.docs]
name = "Metrics"
parent = "alerting"
weight = 2
+++

# Metrics from the alert engine

The alert engine publishes some internal metrics about itself. You can read more about how Grafana publishes [internal metrics]({{< relref "../administration/metrics/" >}}).

Description | Type | Metric name
---------- | ----------- | ----------
Total number of alerts | counter | `alerting.active_alerts`
Alert execution result | counter | `alerting.result`
Notifications sent counter | counter | `alerting.notifications_sent`
Alert execution timer | timer | `alerting.execution_time`
