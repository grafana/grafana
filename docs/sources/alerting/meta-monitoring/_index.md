---
aliases:
  - meta-monitoring/
description: Meta monitoring
keywords:
  - grafana
  - alerting
  - meta-monitoring
title: Meta monitoring
weight: 500
---

# Meta monitoring

Meta monitoring is the process of monitoring your monitoring, and alerting when your monitoring is not working as it should. Whether you use Grafana Managed Alerts or Mimir, meta monitoring is possible both on-premise and in Grafana Cloud.

## Grafana Managed Alerts

Meta monitoring of Grafana Managed Alerts requires having a Prometheus server, or other metrics database, collecting and storing metrics exported by Grafana. For example, if using Prometheus you should add a `scrape_config` to Prometheus to scrape metrics from your Grafana server.

Here is an example of how this might look:

```
- job_name: grafana
  honor_timestamps: true
  scrape_interval: 15s
  scrape_timeout: 10s
  metrics_path: /metrics
  scheme: http
  follow_redirects: true
  static_configs:
  - targets:
    - grafana:3000
```

### Metrics

The Grafana ruler, which is responsible for evaluating alert rules, and the Grafana Alertmanager, which is responsible for sending notifications of firing and resolved alerts, provide a number of metrics that let you observe them.

#### grafana_alerting_alerts

This metric is a counter that shows you the number of `normal`, `pending`, `alerting`, `nodata` and `error` alerts. For example, you might want to create an alert that fires when `grafana_alerting_alerts{state="error"}` is greater than 0.

#### grafana_alerting_schedule_alert_rules

This metric is a gauge that shows you the number of alert rules scheduled. An alert rule is scheduled unless it is paused, and the value of this metric should match the total number of non-paused alert rules in Grafana.

#### grafana_alerting_schedule_periodic_duration_seconds_bucket

This metric is a histogram that shows you the time it takes to process an individual tick in the scheduler that evaluates alert rules. If the scheduler takes longer than 10 seconds to process a tick then pending evaluations will start to accumulate such that alert rules might later than expected.

#### grafana_alerting_schedule_query_alert_rules_duration_seconds_bucket

This metric is a histogram that shows you how long it takes the scheduler to fetch the latest rules from the database. If this metric is elevated then so will `schedule_periodic_duration_seconds`.

#### grafana_alerting_scheduler_behind_seconds

This metric is a gauge that shows you the number of seconds that the scheduler is behind where it should be. This number will increase if `schedule_periodic_duration_seconds` is longer than 10 seconds, and decrease when it is less than 10 seconds. The smallest possible value of this metric is 0.

#### grafana_alerting_notification_latency_seconds_bucket

This metric is a histogram that shows you the number of seconds taken to send notifications for firing and resolved alerts. This metric will let you observe slow or over-utilized integrations, such as an SMTP server that is being given emails faster than it can send them.

> These metrics are not available at present in Grafana Cloud.

## Grafana Mimir

Meta monitoring in Grafana Mimir requires having a Prometheus/Mimir server, or other metrics database, collecting and storing metrics exported by the Mimir ruler and the Alertmanager.

### Metrics

#### grafanacloud_instance_rule_evaluation_failures_total:rate5m

#### grafanacloud_instance_rule_group_interval_seconds

#### grafanacloud_instance_rule_group_iterations_missed_total:rate5m

#### grafanacloud_instance_rule_group_last_evaluation_timestamp_seconds

#### grafanacloud_instance_rule_group_rules

#### alertmanager_alerts

This metric is a counter that shows you the number of active, suppressed and unprocessed alerts from the Grafana Alertmanager.

#### alertmanager_notifications_total

This metric is a counter that shows you how many notifications have been sent since the Grafana server started.

#### alertmanager_notifications_failed_total

This metric is a counter that shows you how many notifications have failed in total since the Grafana server started. In most cases you will want to use the `rate` function to understand how often notifications are failing to be sent.

#### alertmanager_invalid_config

This metric is a counter that shows you the number of times the Alertmanager.

> In Grafana Cloud these metrics are available via the Prometheus usage datasource that is provisioned for all Grafana Cloud customers.
