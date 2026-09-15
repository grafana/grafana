---
aliases:
  - ../../data-sources/aws-cloudwatch/annotations/
description: Use annotations with the Amazon CloudWatch data source in Grafana
keywords:
  - grafana
  - aws
  - cloudwatch
  - annotations
  - alarms
  - events
labels:
  products:
    - cloud
    - enterprise
    - oss
menuTitle: Annotations
title: Amazon CloudWatch annotations
weight: 450
review_date: 2026-06-23
---

# Amazon CloudWatch annotations

[Annotations](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/dashboards/build-dashboards/annotate-visualizations/) overlay rich event information on top of graphs. With the Amazon CloudWatch data source, annotations are based on [CloudWatch alarm history](https://docs.aws.amazon.com/AmazonCloudWatch/latest/monitoring/AlarmThatSendsEmail.html). Each alarm history item within the dashboard time range—such as a state change, configuration update, or action—becomes an annotation, so you can correlate alarm activity with the rest of your dashboard data.

## Before you begin

Before you create CloudWatch annotations, ensure you have:

- A [configured Amazon CloudWatch data source](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/datasources/aws-cloudwatch/configure/).
- One or more CloudWatch alarms in the AWS account and region you want to query.
- IAM permissions to describe alarms and alarm history. Refer to [Required permissions](#required-permissions).

## How CloudWatch annotations work

Unlike data sources that build annotations from free-form queries, CloudWatch annotations query existing CloudWatch alarms and return their state-change history. Grafana finds the matching alarms using one of two methods, retrieves each alarm's history with `cloudwatch:DescribeAlarmHistory`, and renders every history item as an annotation:

- **Match alarms by metric:** Grafana calls `cloudwatch:DescribeAlarmsForMetric` to find alarms attached to a specific metric.
- **Match alarms by prefix:** Grafana calls `cloudwatch:DescribeAlarms` with your alarm name and action prefixes, so AWS returns only alarms whose names and actions start with those prefixes. Grafana then filters the returned alarms by the namespace, metric name, dimensions, statistic, and period you specify.

Each annotation includes the alarm name as its title, the alarm history item type as a tag (for example, `StateUpdate`, `ConfigurationUpdate`, or `Action`), and the history summary as its text.

## Create an annotation query

To add a CloudWatch annotation to a dashboard:

1. Open the dashboard where you want to add annotations.
1. Click **Edit**, then click **Settings** in the top navigation.
1. Select the **Annotations** tab.
1. Click **Add annotation query**.
1. Enter a **Name** for the annotation, for example, `CloudWatch alarms`.
1. Select your **Amazon CloudWatch** data source.
1. Configure the query fields described in the following sections.
1. Click **Save dashboard**.

The annotation query editor provides the following fields:

| Field                      | Description                                                                                                                           |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| **Region**                 | The AWS region to query for alarms.                                                                                                   |
| **Namespace**              | The metric namespace, for example, `AWS/EC2`.                                                                                         |
| **Metric name**            | The name of the metric the alarm watches, for example, `CPUUtilization`.                                                              |
| **Statistic**              | The statistic the alarm uses, for example, `Average`.                                                                                 |
| **Dimensions**             | The dimensions that identify the resource, for example, `InstanceId`.                                                                 |
| **Period**                 | _Optional._ The minimum interval between data points, in seconds. Defaults to `300` when prefix matching is disabled.                 |
| **Enable Prefix Matching** | _Optional._ Match alarms by name and action prefix instead of by metric.                                                              |
| **Action**                 | Match only alarms whose actions start with this prefix. Available when prefix matching is enabled, and required for the query to run. |
| **Alarm Name**             | Match only alarms whose names start with this prefix. Available when prefix matching is enabled, and required for the query to run.   |

### Match alarms by metric

This is the default behavior, used when **Enable Prefix Matching** is off. Grafana returns annotations for any alarm attached to the metric you specify.

When you match by metric, **Region**, **Namespace**, **Metric name**, and **Statistic** are all required. If any of them are missing, the query returns an `invalid annotations query` error. Dimensions are optional, but adding them narrows the results to alarms on a specific resource.

For example, to annotate the history of the CPU utilization alarm on a single EC2 instance, set:

- **Region:** `us-east-1`
- **Namespace:** `AWS/EC2`
- **Metric name:** `CPUUtilization`
- **Statistic:** `Average`
- **Dimensions:** `InstanceId = i-0123456789abcdef0`

### Match alarms by prefix

Enable **Enable Prefix Matching** to find alarms by name and action prefix rather than by a specific metric. Grafana requests up to 100 alarms from `cloudwatch:DescribeAlarms` using the **Alarm Name** and **Action** prefixes, then filters the returned alarms by the namespace, metric name, dimensions, statistic, and period you specify. You must provide both an **Alarm Name** prefix and an **Action** prefix for the query to run.

Use prefix matching when you want to surface a group of related alarms, for example, all production alarms that trigger a specific SNS action. To do this, set **Enable Prefix Matching** on, then set **Alarm Name** to `prod-` and **Action** to the ARN prefix of your SNS topic, such as `arn:aws:sns:us-east-1:123456789012:prod-`.

## Required permissions

Annotation queries require the following CloudWatch API actions in the IAM policy attached to the role or user running the data source:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "AllowReadingAlarmsFromCloudWatch",
      "Effect": "Allow",
      "Action": ["cloudwatch:DescribeAlarms", "cloudwatch:DescribeAlarmsForMetric", "cloudwatch:DescribeAlarmHistory"],
      "Resource": "*"
    }
  ]
}
```

The metrics IAM policy on the [configure page](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/datasources/aws-cloudwatch/configure/#iam-policy-examples) already includes these actions.

## Troubleshoot annotations

If annotations don't appear as expected, try the following solutions.

### Annotations don't appear

- Verify the alarm has state changes within the dashboard time range. Annotations come from alarm history, so an alarm that never changed state produces no annotations.
- Confirm the **Region**, **Namespace**, **Metric name**, **Statistic**, and **Dimensions** exactly match an existing alarm.
- Check that the IAM role or user has the `cloudwatch:DescribeAlarms`, `cloudwatch:DescribeAlarmsForMetric`, and `cloudwatch:DescribeAlarmHistory` permissions.

### `invalid annotations query` error

- This error appears when prefix matching is disabled and the query reaches the backend with an empty **Region**, **Namespace**, **Metric name**, or **Statistic**. Provide all four fields, or enable **Enable Prefix Matching**.
- In the dashboard annotation editor, an incomplete metric query is often skipped silently and produces no annotations rather than returning this error. If you see no annotations, confirm that all required fields are set.

## Related resources

- [Annotate visualizations](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/dashboards/build-dashboards/annotate-visualizations/)
- [Amazon CloudWatch query editor](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/datasources/aws-cloudwatch/query-editor/)
- [Configure the Amazon CloudWatch data source](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/datasources/aws-cloudwatch/configure/)
