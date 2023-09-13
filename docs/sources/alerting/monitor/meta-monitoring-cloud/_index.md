---
canonical: https://grafana.com/docs/grafana/latest/alerting/monitor/meta-monitoring-cloud/
description: Meta monitoring for Cloud
keywords:
  - grafana
  - alerting
  - meta-monitoring
  - Cloud
labels:
  products:
    - cloud
menuTitle: Monitor
title: Meta monitoring for Cloud
weight: 190
---

# Meta monitoring for Cloud

Monitor your alerting metrics to ensure you identify potential issues before they become critical.

Meta monitoring is the process of monitoring your monitoring system and alerting when your monitoring is not working as it should.

In order to enable you to meta monitor, Grafana provides predefined metrics.

Identify which metrics are critical to your monitoring system (i.e. Grafana) and then set up how you want to monitor them.

You can use meta-monitoring metrics to understand the health of your alerting system in the following ways:

1. [Optional] Create a dashboard in Grafana that uses this metric in a panel (just like you would for any other kind of metric).
1. [Optional] Create an alert rule in Grafana that checks this metric regularly (just like you would do for any other kind of alert rule).
1. [Optional] Use the Explore module in Grafana.

## Metrics for Mimir-managed alerts

To meta monitor Grafana Mimir-managed alerts, open source and on-premise users need a Prometheus/Mimir server, or another metrics database to collect and store metrics exported by the Mimir ruler.

#### rule_evaluation_failures_total

This metric is a counter that shows you the total number of rule evaluation failures.

## Metrics for Alertmanager

{{% admonition type="note" %}}
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

## Use logs for Mimir-managed alerts

Use insights logs to help you determine which Mimir-managed alerting and recording rules are failing to evaluate and why. These logs contain helpful information on specific alert rules that are failing, provide you with the actual error message, and help you evaluate what is going wrong.

### Before you begin

To view your insights logs, you must have the following:

- A Grafana Cloud account
- Admin or Editor user permissions for the managed Grafana Cloud instance

### Procedure

To explore logs pertaining to failing alerting and recording rules, complete the following steps.

1. Log on to your instance and click the **Explore** (compass) icon in the menu sidebar.
1. Use the data sources dropdown located at the top of the page to select the data source.
   The data source name should be similar to `grafanacloud-<yourstackname>-usage-insights`.
1. To find the logs you want to see, use the **Label filters** and **Line contains** options in the query editor.

To look at a particular stack, you can filter by **instance_id** instead of **org_id**.

The following is an example query that would surface insights logs:

```
{org_id="<your-org-id>"} | logfmt | component = `ruler` | msg = `Evaluating rule failed`
```

4. Click **Run query**.

5. In the **Logs** section, view specific information on which alert rule is failing and why.

6. You can see the rule contents (in the `rule` field), the rule name (in the `name` field), the name of the group it’s in (in the `group` field), and the error message (in the `err` field).
