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
---

# Amazon CloudWatch data source

Grafana ships with built-in support for Amazon CloudWatch.
This topic describes queries, templates, variables, and other configuration specific to the CloudWatch data source.

For instructions on how to add a data source to Grafana, refer to the [administration documentation](ref:data-source-management).
Only users with the organization administrator role can add data sources.
Administrators can also [provision the data source](#provision-the-data-source) with Grafana's provisioning system, and should [control pricing](#control-pricing) and [manage service quotas](#manage-service-quotas) accordingly.

Once you've added the data source, you can [configure it](#configure-the-data-source) so that your Grafana instance's users can create queries in its [query editor](query-editor/) when they [build dashboards](ref:build-dashboards) and use [Explore](ref:explore).

{{< admonition type="note" >}}
To troubleshoot issues while setting up the CloudWatch data source, check the `/var/log/grafana/grafana.log` file.
{{< /admonition >}}

<!-- ## Query the data source

The CloudWatch data source can query data from both CloudWatch metrics and CloudWatch Logs APIs, each with its own specialized query editor.

For details, see the [query editor documentation](query-editor/). -->

## Query caching

When you enable [query and resource caching](/docs/grafana/<GRAFANA_VERSION>/administration/data-source-management/#query-and-resource-caching), Grafana temporarily stores the results of data source queries and resource requests. Query caching is available in CloudWatch Metrics in Grafana Cloud and Grafana Enterprise. It is not available in CloudWatch Logs Insights due to how query results are polled from AWS.

<!-- ## Use template variables

Instead of hard-coding details such as server, application, and sensor names in metric queries, you can use variables.
Grafana lists these variables in dropdown select boxes at the top of the dashboard to help you change the data displayed in your dashboard.
Grafana refers to such variables as template variables.

For details, see the [template variables documentation](template-variables/). -->

## Import pre-configured dashboards

The CloudWatch data source ships with curated and pre-configured dashboards for five of the most popular AWS services:

- **Amazon Elastic Compute Cloud:** `Amazon EC2`
- **Amazon Elastic Block Store:** `Amazon EBS`
- **AWS Lambda:** `AWS Lambda`
- **Amazon CloudWatch Logs:** `Amazon CloudWatch Logs`
- **Amazon Relational Database Service:** `Amazon RDS`

To import curated dashboards:

1. Navigate to the data source's [configuration page](#configure-the-data-source).
1. Select the **Dashboards** tab.

   This displays the curated selection of importable dashboards.

1. Select **Import** for the dashboard to import.

{{< figure src="/static/img/docs/v65/cloudwatch-dashboard-import.png" caption="CloudWatch dashboard import" >}}

To customize one of these dashboards, we recommend that you save it under a different name.
If you don't, upgrading Grafana can overwrite the customized dashboard with the new version.

## Create queries for alerting

Alerting requires queries that return numeric data, which CloudWatch Logs support.
For example, you can enable alerts through the use of the `stats` command.

This is also a valid query for alerting on messages that include the text "Exception":

```
filter @message like /Exception/
    | stats count(*) as exceptionCount by bin(1h)
    | sort exceptionCount desc
```

{{< admonition type="note" >}}
If you receive an error like `input data must be a wide series but got ...` when trying to alert on a query, make sure that your query returns valid numeric data that can be output to a Time series panel.
{{< /admonition >}}

For more information on Grafana alerts, refer to [Alerting](ref:alerting).

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

## CloudWatch Logs data protection

CloudWatch Logs can safeguard data by using log group data protection policies. If you have data protection enabled for a log group, then any sensitive data that matches the data identifiers you've selected will be masked. In order to view masked data you will need to have the `logs:Unmask` IAM permission enabled. See the AWS documentation on how to [help protect sensitive log data with masking](https://docs.aws.amazon.com/AmazonCloudWatch/latest/logs/mask-sensitive-log-data.html) to learn more about this.
