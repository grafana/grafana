---
aliases:
  - ../data-sources/aws-cloudwatch/
  - ../data-sources/aws-cloudwatch/preconfig-cloudwatch-dashboards/
  - ../data-sources/aws-cloudwatch/provision-cloudwatch/
  - cloudwatch/
  - preconfig-cloudwatch-dashboards/
  - provision-cloudwatch/
description: Guide for using Amazon CloudWatch in Grafana
keywords:
  - grafana
  - cloudwatch
  - guide
labels:
  products:
    - cloud
    - enterprise
    - oss
menuTitle: Amazon CloudWatch
title: Amazon CloudWatch data source
weight: 200
refs:
  logs:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/panels-visualizations/visualizations/logs/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana/<GRAFANA_VERSION>/panels-visualizations/visualizations/logs/
  explore:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/explore/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana/<GRAFANA_VERSION>/explore/
  provisioning-data-sources:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/administration/provisioning/#data-sources
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana/<GRAFANA_VERSION>/administration/provisioning/#data-sources
  configure-grafana-aws:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/setup-grafana/configure-grafana/#aws
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana/<GRAFANA_VERSION>/setup-grafana/configure-grafana/#aws
  alerting:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/alerting/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/alerting-and-irm/alerting/
  build-dashboards:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/dashboards/build-dashboards/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana/<GRAFANA_VERSION>/dashboards/build-dashboards/
  data-source-management:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/administration/data-source-management/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana/<GRAFANA_VERSION>/administration/data-source-management/
  configure-cloudwatch:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/datasources/aws-cloudwatch/configure/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana/<GRAFANA_VERSION>/datasources/aws-cloudwatch/configure/
  cloudwatch-query-editor:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/datasources/aws-cloudwatch/query-editor/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana/<GRAFANA_VERSION>/datasources/aws-cloudwatch/query-editor/
  cloudwatch-template-variables:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/datasources/aws-cloudwatch/template-variables/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana/<GRAFANA_VERSION>/datasources/aws-cloudwatch/template-variables/
  cloudwatch-aws-authentication:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/datasources/aws-cloudwatch/aws-authentication/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana/<GRAFANA_VERSION>/datasources/aws-cloudwatch/aws-authentication/

---

# Amazon CloudWatch data source

Amazon CloudWatch is the AWS native monitoring and observability service. It collects, aggregates, and stores metrics, logs, and events from AWS resources, applications, and services. CloudWatch enables you to visualize performance data, track system health, and set up automated alerts based on defined thresholds.


The AWS CloudWatch data source in Grafana allows you to query, visualize, and correlate with data from other systems—all in a single dashboard.  transforms AWS monitoring data into rich, interactive visualizations.

Grafana includes native support for the AWS CloudWatch plugin, so no additional installation is required.

For general information on how to add a data source to Grafana, refer to the [administration documentation](ref:data-source-management).
Only users with the organization administrator role can add data sources.
Administrators can also [provision the data source](#provision-the-data-source) with Grafana's provisioning system, and should [control pricing](#control-pricing) and [manage service quotas](#manage-service-quotas) accordingly.

Once you've added the data source, you can [configure it](#configure-the-data-source) so that your Grafana instance's users can create queries in its [query editor](query-editor/) when they [build dashboards](ref:build-dashboards) and use [Explore](ref:explore).

{{< admonition type="note" >}}
To troubleshoot issues while setting up the CloudWatch data source, check the `/var/log/grafana/grafana.log` file.
{{< /admonition >}}

The following documents will help you get started working with the CloudWatch data source:

- [Configure the CloudWatch data source](ref:configure-cloudwatch)
- [CloudWatch query editor](ref:cloudwatch-query-editor)
- [Templates and variables](ref:cloudwatch-template-variables)
- [Configure AWS authentication](ref:cloudwatch-aws-authentication)

Once you have configured the CloudWatch data source you can

- 

## Import pre-configured dashboards

The CloudWatch data source includes curated, pre-configured dashboards for five popular AWS services:

- **Amazon Elastic Compute Cloud:** `Amazon EC2`
- **Amazon Elastic Block Store:** `Amazon EBS`
- **AWS Lambda:** `AWS Lambda`
- **Amazon CloudWatch Logs:** `Amazon CloudWatch Logs`
- **Amazon Relational Database Service:** `Amazon RDS`

To import curated dashboards:

1. Navigate to the data source's [configuration page](#configure-the-data-source).
1. Click the **Dashboards** tab.

   This displays the curated selection of importable dashboards.

1. Click **Import** for the each dashboard you want to import.

![Cloudwatch pre-configured dashboards Grafana v12.1](/media//docs/cloudwatch/preconfigured-dashbaords-cloudwatch-v12.1.png) CloudWatch pre-configured dashboards

To customize one of these dashboards, Grafana recommends saving it under a different name.
Otherwise, Grafana upgrades will overwrite your customizations with the new version.

## Control pricing

The Amazon CloudWatch data source for Grafana uses [`ListMetrics`](https://docs.aws.amazon.com/AmazonCloudWatch/latest/APIReference/API_ListMetrics.html) and [`GetMetricData`](https://docs.aws.amazon.com/AmazonCloudWatch/latest/APIReference/API_GetMetricData.html) CloudWatch API calls to list and retrieve metrics.
Pricing for CloudWatch Logs is based on the amount of data ingested, archived, and analyzed via CloudWatch Logs Insights queries.
Each time you select a dimension in the query editor, Grafana issues a `ListMetrics` API request.
Each time you change queries in the query editor, Grafana issues a new request to the `GetMetricData` API.

{{< admonition type="note" >}}
Grafana replaced all `GetMetricStatistics` API requests with calls to GetMetricData to provide better support for CloudWatch metric math, and enables the automatic generation of search expressions when using wildcards or disabling the `Match Exact` option.
The `GetMetricStatistics` API qualified for the CloudWatch API free tier, but `GetMetricData` calls don't.
{{< /admonition >}}

For more information, refer to the [CloudWatch pricing page](https://aws.amazon.com/cloudwatch/pricing/).

## Manage service quotas

AWS defines quotas, or limits, for resources, actions, and items in your AWS account.
Depending on the number of queries in your dashboard and the number of users accessing the dashboard, you might reach the usage limits for various CloudWatch and CloudWatch Logs resources.
Quotas are defined per account and per region.

If you use multiple regions or configured more than one CloudWatch data source to query against multiple accounts, you must request a quota increase for each account and region in which you reach the limit.

To request a quota increase, visit the [AWS Service Quotas console](https://console.aws.amazon.com/servicequotas/home?r#!/services/monitoring/quotas/L-5E141212).
For more information, refer to the AWS documentation for [Service Quotas](https://docs.aws.amazon.com/servicequotas/latest/userguide/intro.html) and [CloudWatch limits](https://docs.aws.amazon.com/AmazonCloudWatch/latest/monitoring/cloudwatch_limits.html).

## Cross-account observability

The CloudWatch plugin enables you to monitor and troubleshoot applications across multiple regional accounts. Using cross-account observability, you can seamlessly search, visualize and analyze metrics and logs without worrying about account boundaries.

To use this feature, configure in the [AWS console under CloudWatch Settings](https://aws.amazon.com/blogs/aws/new-amazon-cloudwatch-cross-account-observability/), a monitoring and source account, and then add the necessary IAM permissions as described above.


