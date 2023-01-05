---
aliases:
  - ../cloudwatch/
description: Guide for using AWS CloudWatch in Grafana
keywords:
  - grafana
  - stackdriver
  - google
  - guide
  - cloud
  - monitoring
title: Curated CloudWatch dashboards
weight: 15
---

# Curated CloudWatch dashboards

The updated CloudWatch data source ships with pre-configured dashboards for five of the most popular AWS services:

- Amazon Elastic Compute Cloud `Amazon EC2`,
- Amazon Elastic Block Store `Amazon EBS`,
- AWS Lambda `AWS Lambda`,
- Amazon CloudWatch Logs `Amazon CloudWatch Logs`, and
- Amazon Relational Database Service `Amazon RDS`.

To import curatedd dashboards:

1. On the configuration page of your CloudWatch data source, click the **Dashboards** tab.

1. Click **Import** for the dashboard you would like to use.

In case you want to customize a dashboard, we recommend that you save it under a different name. Otherwise the dashboard will be overwritten when a new version of the dashboard is released.

{{< figure src="/static/img/docs/v65/cloudwatch-dashboard-import.png" caption="CloudWatch dashboard import" >}}
