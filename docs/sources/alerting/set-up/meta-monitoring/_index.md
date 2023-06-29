---
aliases:
  - meta-monitoring/
  - alerting/meta-monitoring/
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

Meta monitoring in Grafana Mimir requires having a Prometheus/Mimir server, or other metrics database, collecting and storing metrics exported by the Mimir ruler.

#### cortex_prometheus_rule_evaluation_failures_total

This metric is a counter that shows you the total number of rule evaluation failures.

## Alertmanager

Meta monitoring in Alertmanager also requires having a Prometheus/Mimir server, or other metrics database, collecting and storing metrics exported by Alertmanager. For example, if using Prometheus you should add a `scrape_config` to Prometheus to scrape metrics from your Alertmanager.

Here is an example of how this might look:

```
- job_name: alertmanager
  honor_timestamps: true
  scrape_interval: 15s
  scrape_timeout: 10s
  metrics_path: /metrics
  scheme: http
  follow_redirects: true
  static_configs:
  - targets:
    - alertmanager:9093
```

#### alertmanager_alerts

This metric is a counter that shows you the number of active, suppressed and unprocessed alerts in Alertmanager. Suppressed alerts are silenced alerts, and unprocessed alerts are alerts that have been sent to the Alertmanager but have not been processed.

#### alertmanager_alerts_invalid_total

This metric is a counter that shows you the number of invalid alerts that were sent to Alertmanager. This counter should not exceed 0, and so in most cases you will want to create an alert that fires if whenever this metric increases.

#### alertmanager_notifications_total

This metric is a counter that shows you how many notifications have been sent by Alertmanager. The metric uses a label "integration" to show the number of notifications sent by integration, such as email.

#### alertmanager_notifications_failed_total

This metric is a counter that shows you how many notifications have failed in total. This metric also uses a label "integration" to show the number of failed notifications by integration, such as failed emails. In most cases you will want to use the `rate` function to understand how often notifications are failing to be sent.

#### alertmanager_notification_latency_seconds_bucket

This metric is a histogram that shows you the amount of time it takes Alertmanager to send notifications and for those notifications to be accepted by the receiving service. This metric uses a label "integration" to show the amount of time by integration. For example, you can use this metric to show the 95th percentile latency of sending emails.

> In Grafana Cloud some of these metrics are available via the Prometheus usage datasource that is provisioned for all Grafana Cloud customers.

## Alertmanager in high availability mode

If using Alertmanager in high availability mode there are a number of additional metrics that you might want to create alerts for.

#### alertmanager_cluster_members

This metric is a gauge that shows you the current number of members in the cluster. The value of this gauge should be the same across all Alertmanagers. If different Alertmanagers are showing different numbers of members then this is indicative of an issue with your Alertmanager cluster. You should look at the metrics and logs from your Alertmanagers to better understand what might be going wrong.

#### alertmanager_cluster_failed_peers

This metric is a gauge that shows you the current number of failed peers.

#### alertmanager_cluster_health_score

This metric is a gauge showing the health score of the Alertmanager. Lower values are better, and zero means the Alertmanager is healthy.

#### alertmanager_cluster_peer_info

This metric is a gauge. It has a constant value `1`, and contains a label called "peer" containing the Peer ID of each known peer.

#### alertmanager_cluster_reconnections_failed_total

This metric is a counter that shows you the number of failed peer connection attempts. In most cases you will want to use the `rate` function to understand how often reconnections fail as this may be indicative of an issue or instability in your network.

> These metrics are not available in Grafana Cloud as it uses a different high availability strategy than on-premise Alertmanagers.

<!---
#### cortex_prometheus_rule_group_last_evaluation_timestamp_seconds

#### cortex_prometheus_rule_group_rules

This metric is a counter that shows

> In Grafana Cloud these metrics are available via the Prometheus usage datasource that is provisioned for all Grafana Cloud customers.
-->
