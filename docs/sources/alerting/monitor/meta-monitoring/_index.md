---
aliases:
  - alerting/meta-monitoring/
  - ../set-up/meta-monitoring/
canonical: https://grafana.com/docs/grafana/latest/alerting/monitor/meta-monitoring/
description: Meta monitoring
keywords:
  - grafana
  - alerting
  - meta-monitoring
labels:
  products:
    - enterprise
    - oss
    - cloud
title: Meta monitoring
weight: 100
---

# Meta monitoring

Meta monitoring is the process of monitoring your monitoring system and alerting when your monitoring is not working as it should.

Whether you use Grafana-managed alerts or Grafana Mimir-managed alerts, meta monitoring is possible both on-premise and in Grafana Cloud.

In order to enable you to meta monitor, Grafana provides predefined metrics for both on-premise and Cloud.

Identify which metrics are critical to your monitoring system (i.e. Grafana) and then set up how you want to monitor them.

## Metrics for Grafana-managed alerts

{{% admonition type="note" %}}
These metrics are not available for Grafana Cloud.
There are no metrics in the `grafanacloud-usage` data source that can be used to meta monitor Grafana-managed alerts.
{{% /admonition %}}

To meta monitor Grafana-managed alerts, you need a Prometheus server, or other metrics database to collect and store metrics exported by Grafana.

For example, if you are using Prometheus, add a `scrape_config` to Prometheus to scrape metrics from Grafana, Alertmanager, or your data sources.

### Example

```yaml
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

### List of available metrics

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

## Metrics for Mimir-managed alerts

{{% admonition type="note" %}}
This metric is available in OSS, on-premise, and Grafana Cloud.
{{% /admonition %}}

To meta monitor Grafana Mimir-managed alerts, open source and on-premise users need a Prometheus/Mimir server, or another metrics database to collect and store metrics exported by the Mimir ruler.

#### rule_evaluation_failures_total

This metric is a counter that shows you the total number of rule evaluation failures.

## Metrics for Alertmanager

{{% admonition type="note" %}}
These metrics are available for OSS, on-premise, and some are available in Grafana Cloud.

Use the data source and Metrics browser in Grafana Cloud called `grafanacloud-usage` that is provisioned for all Grafana Cloud customers to view all available meta monitoring and usage metrics that are available in Grafana Cloud.
{{% /admonition %}}

To meta monitor the Alertmanager, you need a Prometheus/Mimir server, or another metrics database to collect and store metrics exported by Alertmanager.

For example, if you are using Prometheus you should add a `scrape_config` to Prometheus to scrape metrics from your Alertmanager.

### Example

```yaml
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

### List of available metrics

#### alertmanager_alerts

This metric is a counter that shows you the number of active, suppressed, and unprocessed alerts in Alertmanager. Suppressed alerts are silenced alerts, and unprocessed alerts are alerts that have been sent to the Alertmanager but have not been processed.

#### alertmanager_alerts_invalid_total

This metric is a counter that shows you the number of invalid alerts that were sent to Alertmanager. This counter should not exceed 0, and so in most cases you will want to create an alert that fires if whenever this metric increases.

#### alertmanager_notifications_total

This metric is a counter that shows you how many notifications have been sent by Alertmanager. The metric uses a label "integration" to show the number of notifications sent by integration, such as email.

#### alertmanager_notifications_failed_total

This metric is a counter that shows you how many notifications have failed in total. This metric also uses a label "integration" to show the number of failed notifications by integration, such as failed emails. In most cases you will want to use the `rate` function to understand how often notifications are failing to be sent.

#### alertmanager_notification_latency_seconds_bucket

This metric is a histogram that shows you the amount of time it takes Alertmanager to send notifications and for those notifications to be accepted by the receiving service. This metric uses a label "integration" to show the amount of time by integration. For example, you can use this metric to show the 95th percentile latency of sending emails.

> In Grafana Cloud some of these metrics are available via the Prometheus usage datasource that is provisioned for all Grafana Cloud customers.

## Metrics for Alertmanager in high availability mode

{{% admonition type="note" %}}
These metrics are not available in Grafana Cloud as it uses a different high availability strategy than on-premise Alertmanagers.
{{% /admonition %}}

If you are using Alertmanager in high availability mode there are a number of additional metrics that you might want to create alerts for.

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

## Monitor your metrics

To monitor your metrics, you can:

1. [Optional] Create a dashboard in Grafana that uses this metric in a panel (just like you would for any other kind of metric).
1. [Optional] Create an alert rule in Grafana that checks this metric regularly (just like you would do for any other kind of alert rule).
1. [Optional] Use the Explore module in Grafana.

## Use insights logs

{{% admonition type="note" %}}
For Grafana Cloud only.
{{% /admonition %}}

Use insights logs to help you determine which alerting and recording rules are failing to evaluate and why. These logs contain helpful information on specific alert rules that are failing, provide you with the actual error message, and help you evaluate what is going wrong.

### Before you begin

To view your insights logs, you must have the following:

 - A Grafana Cloud account
 - Admin or Editor user permissions for the managed Grafana Cloud instance

### Procedure

To explore logs pertaining to failing alerting and recording rules, complete the following steps.

1. Log on to your instance and click the      **Explore** (compass) icon in the menu sidebar.
1. Use the data sources dropdown located at the top of the page to select the data source.
The data source name should be similar to `grafanacloud-<yourstackname>-usage-insights`.
1. To find the logs you want to see, use the **Label filters** and **Line contains** options in the query editor.

To look at a particular stack, you can filter by **instance_id** instead of **org_id**.

The following is an example query that would surface insights logs:
{org_id="<your-org-id>"} | logfmt | component = `ruler` | msg = `Evaluating rule failed`

1. Click **Run query**.

   In the **Logs** section, view specific information on which alert rule is failing and why.

   You can see the rule contents (in the `rule` field), the rule name (in the `name` field), the name of the group it’s in (in the `group` field), and the error message (in the `err` field).

