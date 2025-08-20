---
aliases:
  - ../data-sources/aws-cloudwatch/
  - ../data-sources/aws-cloudwatch/preconfig-cloudwatch-dashboards/
  - ../data-sources/aws-cloudwatch/provision-cloudwatch/
  - cloudwatch/
  - preconfig-cloudwatch-dashboards/
  - provision-cloudwatch/
description: This document provides configuration instructions for the CloudWatch data source.
keywords:
  - grafana
  - cloudwatch
  - guide
labels:
  products:
    - cloud
    - enterprise
    - oss
menuTitle: Configure
title: Configure CloudWatch
weight: 100
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
  cloudwatch-aws-authentication:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/datasources/aws-cloudwatch/aws-authentication/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana/<GRAFANA_VERSION>/datasources/aws-cloudwatch/aws-authentication/
  private-data-source-connect:
    - pattern: /docs/grafana/
      destination:  docs/grafana-cloud/connect-externally-hosted/private-data-source-connect/
    - pattern: /docs/grafana-cloud/
      destination:  docs/grafana-cloud/connect-externally-hosted/private-data-source-connect/
  configure-pdc:
    - pattern: /docs/grafana/
      destination:  /docs/grafana-cloud/connect-externally-hosted/private-data-source-connect/configure-pdc/#configure-grafana-private-data-source-connect-pdc
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/connect-externally-hosted/private-data-source-connect/configure-pdc/#configure-grafana-private-data-source-connect-pdc

---

# Configure the Amazon CloudWatch data source

This document provides instructions for configuring the Amazon CloudWatch data source and explains available configuration options. For general information on adding and managing data sources, refer to [Data source management](ref:data-source-management).

## Before you begin

- You must have the `Organization administrator` role to configure the CloudWatch data source. Organization administrators can also [configure the data source via YAML](#provision-the-data-source) with the Grafana provisioning system.

- Grafana comes with a built-in CloudWatch data source plugin, so you do not need to install a plugin.

- Familiarize yourself with your CloudWatch security configuration and gather any necessary security certificates, client certificates, and client keys.

## Add the CloudWatch data source

Complete the following steps to set up a new CloudWatch data source:

1. Click **Connections** in the left-side menu.
1. Click **Add new connection**
1. Type `CloudWatch` in the search bar.
1. Select the **CloudWatch data source**.
1. Click **Add new data source** in the upper right.

Grafana takes you to the **Settings** tab, where you will set up your CloudWatch configuration.

## Configure the data source in the UI

The following are configuration options for the CloudWatch data source.

| **Setting** | **Description**                                                                                                                            |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| **Name**    | The data source name. Sets the name you use to refer to the data source in panels and queries.                                             |
| **Default** | Toggle to select as the default name in dashboard panels. When you go to a dashboard panel, this will be the default selected data source. |

Grafana plugin requests to AWS are made on behalf of an AWS Identity and Access Management (IAM) role or IAM user.
The IAM user or IAM role must have the associated policies to perform certain API actions.

For authentication options and configuration details, refer to [AWS authentication](aws-authentication/).


| Setting         | Description                                                                                                                                     |
|-----------------|-------------------------------------------------------------------------------------------------------------------------------------------------|
| **Authentication** | Specify which AWS credentials chain to use. A Grafana plugin's requests to AWS are made on behalf of an IAM role or IAM user. The IAM user or IAM role must have the necessary policies to perform the required API actions. |

**Access & secret key:**

You must use both an access key ID and a secret access key to authenticate.

| Setting               | Description                  |
| --------------------- | ---------------------------- |
| **Access Key ID**     | Enter your key ID.           |
| **Secret Access Key** | Enter the secret access key. |


**Assume Role**:

| Setting             | Description                                                                                                                                          |
| ------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Assume Role ARN** | _Optional._ Specify the ARN of an IAM role to assume. This ensures the selected authentication method is used to assume the role, not used directly. |
| **External ID**     | If you're assuming a role in another AWS account that requires an external ID, specify it here.                                                      |

**Additional Settings:**

| Setting                          | Description                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| -------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Endpoint**                     | _Optional_. Specify a custom endpoint for the AWS service.                                                                                                                                                                                                                                                                                                                                                                                                     |
| **Default Region**               | Specify the AWS region. Example: If the region is US West (Oregon), use `us-west-2`.                                                                                                                                                                                                                                                                                                                                                                           |
| **Namespaces of Custom Metrics** | Add one or more custom metric namespaces, separated by commas (for example,`Namespace1,Namespace2`). Grafana can't automatically load custom namespaces using the [CloudWatch GetMetricData API](https://docs.aws.amazon.com/AmazonCloudWatch/latest/APIReference/API_GetMetricData.html). To make custom metrics available in the query editor, manually specify the namespaces in the `Namespaces of Custom Metrics` field in the data source configuration. |

**CloudWatch Logs**:

| Setting                  | Description                                                                                                                                                                                                                                                                                                                   |
| ------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Query timeout result** | Grafana polls Cloudwatch Logs every second until AWS returns a `Done` status or the timeout is reached. An error is returned if the timeout is exceeded. For alerting, the timeout defined in the Grafana config file takes precedence. Enter a valid duration string, such as `30m`, `30s` or `200ms`. The default is `30m`. |
| **Default Log Groups**   | _Optional_. Specify the default log groups for CloudWatch Logs queries.                                                                                                                                                                                                                                                       |

**X-Ray trace link:** 

| Setting         | Description                                     |
| --------------- | ----------------------------------------------- |
| **Data source** | Select the X-ray data source from the drop-down menu. |

Grafana automatically creates a link to a trace in X-ray data source if logs contain the `@xrayTraceId` field. To use this feature, you must already have an X-Ray data source configured. For details, see the [X-Ray data source docs](/grafana/plugins/grafana-x-ray-datasource/). To view the X-Ray link, select the log row in either the Explore view or dashboard [Logs panel](ref:logs) to view the log details section.

To log the `@xrayTraceId`, refer to the [AWS X-Ray documentation](https://docs.amazonaws.cn/en_us/xray/latest/devguide/xray-services.html). To provide the field to Grafana, your log queries must also contain the `@xrayTraceId` field, for example by using the query `fields @message, @xrayTraceId`.

**Private data source connect** - _Only for Grafana Cloud users._

| Setting                  | Description |
|---------------------------|-------------|
| **Private data source connect** | Establishes a private, secured connection between a Grafana Cloud stack and data sources within a private network. Use the drop-down to locate the PDC URL. For setup instructions, refer to [Private data source connect (PDC)](ref:private-data-source-connect) and [Configure PDC](ref:configure-pdc). Click **Manage private data source connect** to open your PDC connection page and view your configuration details. |

After configuring your Amazon CloudWatch data source options, click **Save & test** at the bottom to test the connection. You should see a confirmation dialog box that says:



{{< admonition type="note" >}}
To troubleshoot issues while setting up the CloudWatch data source, check the `/var/log/grafana/grafana.log` file.
{{< /admonition >}}

### IAM policy examples

To read CloudWatch metrics and EC2 tags, instances, regions, and alarms, you must grant Grafana permissions via IAM.
You can attach these permissions to the IAM role or IAM user you configured in [AWS authentication](aws-authentication/).

**Metrics-only permissions:**

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "AllowReadingMetricsFromCloudWatch",
      "Effect": "Allow",
      "Action": [
        "cloudwatch:DescribeAlarmsForMetric",
        "cloudwatch:DescribeAlarmHistory",
        "cloudwatch:DescribeAlarms",
        "cloudwatch:ListMetrics",
        "cloudwatch:GetMetricData",
        "cloudwatch:GetInsightRuleReport"
      ],
      "Resource": "*"
    },
    {
      "Sid": "AllowReadingTagsInstancesRegionsFromEC2",
      "Effect": "Allow",
      "Action": ["ec2:DescribeTags", "ec2:DescribeInstances", "ec2:DescribeRegions"],
      "Resource": "*"
    },
    {
      "Sid": "AllowReadingResourcesForTags",
      "Effect": "Allow",
      "Action": "tag:GetResources",
      "Resource": "*"
    },
    {
      "Sid": "AllowReadingResourceMetricsFromPerformanceInsights",
      "Effect": "Allow",
      "Action": "pi:GetResourceMetrics",
      "Resource": "*"
    }
  ]
}
```

**Logs-only permissions:**

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "AllowReadingLogsFromCloudWatch",
      "Effect": "Allow",
      "Action": [
        "logs:DescribeLogGroups",
        "logs:GetLogGroupFields",
        "logs:StartQuery",
        "logs:StopQuery",
        "logs:GetQueryResults",
        "logs:GetLogEvents"
      ],
      "Resource": "*"
    },
    {
      "Sid": "AllowReadingTagsInstancesRegionsFromEC2",
      "Effect": "Allow",
      "Action": ["ec2:DescribeTags", "ec2:DescribeInstances", "ec2:DescribeRegions"],
      "Resource": "*"
    },
    {
      "Sid": "AllowReadingResourcesForTags",
      "Effect": "Allow",
      "Action": "tag:GetResources",
      "Resource": "*"
    }
  ]
}
```

**Metrics and logs permissions:**

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "AllowReadingMetricsFromCloudWatch",
      "Effect": "Allow",
      "Action": [
        "cloudwatch:DescribeAlarmsForMetric",
        "cloudwatch:DescribeAlarmHistory",
        "cloudwatch:DescribeAlarms",
        "cloudwatch:ListMetrics",
        "cloudwatch:GetMetricData",
        "cloudwatch:GetInsightRuleReport"
      ],
      "Resource": "*"
    },
    {
      "Sid": "AllowReadingResourceMetricsFromPerformanceInsights",
      "Effect": "Allow",
      "Action": "pi:GetResourceMetrics",
      "Resource": "*"
    },
    {
      "Sid": "AllowReadingLogsFromCloudWatch",
      "Effect": "Allow",
      "Action": [
        "logs:DescribeLogGroups",
        "logs:GetLogGroupFields",
        "logs:StartQuery",
        "logs:StopQuery",
        "logs:GetQueryResults",
        "logs:GetLogEvents"
      ],
      "Resource": "*"
    },
    {
      "Sid": "AllowReadingTagsInstancesRegionsFromEC2",
      "Effect": "Allow",
      "Action": ["ec2:DescribeTags", "ec2:DescribeInstances", "ec2:DescribeRegions"],
      "Resource": "*"
    },
    {
      "Sid": "AllowReadingResourcesForTags",
      "Effect": "Allow",
      "Action": "tag:GetResources",
      "Resource": "*"
    }
  ]
}
```

#### Cross-account observability permissions

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Action": ["oam:ListSinks", "oam:ListAttachedLinks"],
      "Effect": "Allow",
      "Resource": "*"
    }
  ]
}
```

{{< admonition type="note" >}}
Cross-account observability lets you retrieve metrics and logs across different accounts in a single region, but you can't query EC2 Instance Attributes across accounts because those come from the EC2 API and not the CloudWatch API.
{{< /admonition >}}

For more information on configuring authentication, refer to [Configure AWS authentication](ref:cloudwatch-aws-authentication).

### Configure the data source with grafana.ini

The Grafana [configuration file](ref:configure-grafana-aws) includes an `AWS` section where you can configure data source options:

| Configuration option      | Description                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| ------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `allowed_auth_providers`  | Specifies which authentication providers are allowed for the CloudWatch data source. The following providers are enabled by default in open-source Grafana: `default` (AWS SDK default), `keys` (Access and secret key), `credentials` (Credentials file), `ec2_IAM_role` (EC2 IAM role).                                                                                                                                                             |
| `assume_role_enabled`     | Allows you to disable `assume role (ARN)` in the CloudWatch data source. The assume role (ARN) is enabled by default in open-source Grafana.                                                                                                                                                                                                                                                                                                    |
| `list_metrics_page_limit` | Sets the limit of List Metrics API pages. When a custom namespace is specified in the query editor, the [List Metrics API](https://docs.aws.amazon.com/AmazonCloudWatch/latest/APIReference/API_ListMetrics.html) populates the _Metrics_ field and _Dimension_ fields. The API is paginated and returns up to 500 results per page, and the data source also limits the number of pages to 500 by default. This setting customizes that limit. |

### Provision the data source

You can define and configure the data source in YAML files as part of the Grafana provisioning system.
For more information about provisioning and available configuration options, refer to [Provision Grafana](ref:provisioning-data-sources).

**Using AWS SDK (default)**:

```yaml
apiVersion: 1
datasources:
  - name: CloudWatch
    type: cloudwatch
    jsonData:
      authType: default
      defaultRegion: eu-west-2
```

**Using credentials' profile name (non-default)**:

```yaml
apiVersion: 1

datasources:
  - name: CloudWatch
    type: cloudwatch
    jsonData:
      authType: credentials
      defaultRegion: eu-west-2
      customMetricsNamespaces: 'CWAgent,CustomNameSpace'
      profile: secondary
```

**Using `accessKey` and `secretKey`**:

```yaml
apiVersion: 1

datasources:
  - name: CloudWatch
    type: cloudwatch
    jsonData:
      authType: keys
      defaultRegion: eu-west-2
    secureJsonData:
      accessKey: '<your access key>'
      secretKey: '<your secret key>'
```

**Using AWS SDK Default and ARN of IAM Role to Assume:**

```yaml
apiVersion: 1
datasources:
  - name: CloudWatch
    type: cloudwatch
    jsonData:
      authType: default
      assumeRoleArn: arn:aws:iam::123456789012:root
      defaultRegion: eu-west-2
```
