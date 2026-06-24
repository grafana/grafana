---
aliases:
  - ../../data-sources/aws-cloudwatch/configure/
  - ../../data-sources/aws-cloudwatch/
  - ../../data-sources/aws-cloudwatch/preconfig-cloudwatch-dashboards/
  - ../../data-sources/aws-cloudwatch/provision-cloudwatch/
  - ../cloudwatch/
  - ../preconfig-cloudwatch-dashboards/
  - ../provision-cloudwatch/
description: This document provides configuration instructions for the CloudWatch data source.
keywords:
  - grafana
  - CloudWatch
  - guide
labels:
  products:
    - cloud
    - enterprise
    - oss
menuTitle: Configure
title: Configure CloudWatch
weight: 100
review_date: 2026-06-23
---

# Configure the Amazon CloudWatch data source

This document provides instructions for configuring the Amazon CloudWatch data source and explains available configuration options. For general information on adding and managing data sources, refer to [Data source management](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/administration/data-source-management/).

## Before you begin

- You must have the `Organization administrator` role to configure the CloudWatch data source. Organization administrators can also [configure the data source via YAML](#provision-the-data-source) with the Grafana provisioning system.

- Grafana comes with a built-in CloudWatch data source plugin, so you do not need to install a plugin.

- Familiarize yourself with your CloudWatch security configuration and gather any necessary security certificates, client certificates, and client keys.

## Key concepts

If you're new to AWS, these terms are used throughout the configuration:

| Term | Description |
| --- | --- |
| **IAM policy** | A JSON document attached to an identity that grants permissions to AWS API actions. |
| **IAM role** | An identity with permissions that trusted entities can assume temporarily, instead of using long-lived keys. |
| **Assume role** | An AWS mechanism that lets one identity take on the temporary permissions of an IAM role, often used for cross-account access. |
| **External ID** | A shared secret in a role's trust policy that prevents another party from assuming the role on your behalf. |
| **STS (Security Token Service)** | The AWS service that issues the short-lived temporary credentials used when assuming a role. |
| **Cross-account observability (OAM)** | An AWS feature, managed through Observability Access Manager, that links monitoring and source accounts so you can query metrics and logs across accounts. |

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

For authentication options and configuration details, refer to [AWS authentication](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/datasources/aws-cloudwatch/aws-authentication/).

| Setting                     | Description                                                                                                                                                                                                                  |
| --------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Authentication Provider** | Specify which AWS credentials chain to use. A Grafana plugin's requests to AWS are made on behalf of an IAM role or IAM user. The IAM user or IAM role must have the necessary policies to perform the required API actions. |

**Access & secret key:**

You must use both an access key ID and a secret access key to authenticate.

| Setting               | Description                  |
| --------------------- | ---------------------------- |
| **Access Key ID**     | Enter your key ID.           |
| **Secret Access Key** | Enter the secret access key. |

**Credentials file:**

When you select the **Credentials file** authentication provider, you can specify which profile to read from the AWS shared credentials file.

| Setting                      | Description                                                                                          |
| ---------------------------- | --------------------------------------------------------------------------------------------------- |
| **Credentials Profile Name** | The profile name in `~/.aws/credentials`, as specified in the credentials file. Leave blank to use the `default` profile. |

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

**Proxy configuration:**

The **Proxy Configuration** settings appear only when per-data source HTTP proxy support is enabled with the `per_datasource_http_proxy_enabled` option in the Grafana configuration file. They let each CloudWatch data source use its own outbound HTTP proxy for AWS requests.

| Setting            | Description                                                                                                                                                                       |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Proxy Type**     | Select how the proxy is configured: `Environment (default)` uses the `HTTP_PROXY` and `HTTPS_PROXY` environment variables, `None` disables the proxy, and `URL` lets you specify a proxy URL. Don't set this when Secure Socks Proxy is enabled. |
| **Proxy URL**      | _Only when Proxy Type is `URL`._ The proxy URL, for example `https://localhost:3004`. Don't include the username or password in the URL.                                          |
| **Proxy Username** | _Only when Proxy Type is `URL`._ _Optional._ The proxy username.                                                                                                                  |
| **Proxy Password** | _Only when Proxy Type is `URL`._ _Optional._ The proxy password.                                                                                                                  |

**CloudWatch Logs**:

| Setting                  | Description                                                                                                                                                                                                                                                                                                                          |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Query Result Timeout** | Grafana polls CloudWatch Logs every second until AWS returns a `Done` status or the timeout is reached. An error is returned if the timeout is exceeded. For alerting, the timeout defined in the Grafana configuration file takes precedence. Enter a valid duration string, such as `30m`, `30s` or `200ms`. The default is `30m`. |
| **Default Log Groups**   | _Optional_. Specify the default log groups for CloudWatch Logs queries.                                                                                                                                                                                                                                                              |

**Application Signals trace link:**

| Setting         | Description                                                         |
| --------------- | ------------------------------------------------------------------- |
| **Data source** | Select the Application Signals data source from the drop-down menu. |

Grafana automatically creates a link to a trace in Application Signals data source if logs contain the `@xrayTraceId` field. To use this feature, you must already have an Application Signals data source configured. For details, refer to the [Application Signals data source docs](https://grafana.com/docs/plugins/grafana-x-ray-datasource/latest/). To view the Application Signals link, select the log row in either the Explore view or dashboard [Logs panel](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/panels-visualizations/visualizations/logs/) to view the log details section.

To log the `@xrayTraceId`, refer to the [AWS Application Signals documentation](https://docs.aws.amazon.com/AmazonCloudWatch/latest/monitoring/CloudWatch-Application-Monitoring-Sections.html). To provide the field to Grafana, your log queries must also contain the `@xrayTraceId` field, for example by using the query `fields @message, @xrayTraceId`.

**Private data source connect** - _Only for Grafana Cloud users._

| Setting                         | Description                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| ------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Private data source connect** | Establishes a private, secured connection between a Grafana Cloud stack and data sources within a private network. Use the drop-down to locate the PDC URL. For setup instructions, refer to [Private data source connect (PDC)](https://grafana.com/docs/grafana-cloud/connect-externally-hosted/private-data-source-connect/) and [Configure PDC](https://grafana.com/docs/grafana-cloud/connect-externally-hosted/private-data-source-connect/configure-pdc/#configure-grafana-private-data-source-connect-pdc). Click **Manage private data source connect** to open your PDC connection page and view your configuration details. |

After configuring your Amazon CloudWatch data source options, click **Save & test** at the bottom to test the connection. When the test succeeds, Grafana confirms that it reached both CloudWatch APIs:

```
1. Successfully queried the CloudWatch metrics API.
2. Successfully queried the CloudWatch logs API.
```

{{< figure src="/media/docs/CloudWatch/CloudWatch-config-success-message.png" >}}

{{< admonition type="note" >}}
To troubleshoot issues while setting up the CloudWatch data source, check the `/var/log/grafana/grafana.log` file. Common issues include invalid credentials, missing regions and metrics-only credentials.
{{< /admonition >}}

### IAM policy examples

To read CloudWatch metrics and EC2 tags, instances, regions, and alarms, you must grant Grafana permissions via IAM.
You can attach these permissions to the IAM role or IAM user you configured in [AWS authentication](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/datasources/aws-cloudwatch/aws-authentication/).

**Metrics-only permissions:**

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "AllowReadingMetricsFromCloudWatch",
      "Effect": "Allow",
      "Action": [
        "CloudWatch:DescribeAlarmsForMetric",
        "CloudWatch:DescribeAlarmHistory",
        "CloudWatch:DescribeAlarms",
        "CloudWatch:ListMetrics",
        "CloudWatch:GetMetricData",
        "CloudWatch:GetInsightRuleReport"
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
        "CloudWatch:DescribeAlarmsForMetric",
        "CloudWatch:DescribeAlarmHistory",
        "CloudWatch:DescribeAlarms",
        "CloudWatch:ListMetrics",
        "CloudWatch:GetMetricData",
        "CloudWatch:GetInsightRuleReport"
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

For more information on configuring authentication, refer to [Configure AWS authentication](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/datasources/aws-cloudwatch/aws-authentication/).

### Permissions reference

The following table explains why each permission is needed and whether it's required, so you can scope a policy to only the features you use. Grant `cloudwatch:GetMetricData` only for metrics, the `logs:` actions only for logs, and the EC2 and tag actions only if you use the related template variables. Granting a permission that you don't use has no effect on functionality.

| Permission | Purpose | Required |
| --- | --- | --- |
| `cloudwatch:ListMetrics` | Lists available metrics and populates the namespace, metric, and dimension fields in the query editor. | Required for metrics queries and metrics template variables. |
| `cloudwatch:GetMetricData` | Retrieves metric data points for queries and metric math expressions. | Required for metrics queries. |
| `cloudwatch:GetInsightRuleReport` | Retrieves data from CloudWatch Contributor Insights rules. | Optional. Only needed if you query Contributor Insights rules. |
| `cloudwatch:DescribeAlarms`, `cloudwatch:DescribeAlarmsForMetric`, `cloudwatch:DescribeAlarmHistory` | Reads CloudWatch alarm configuration and history. | Optional. Only needed if you display alarm data. |
| `pi:GetResourceMetrics` | Retrieves Performance Insights metrics for supported resources, such as RDS databases. | Optional. Only needed if you query Performance Insights metrics. |
| `logs:DescribeLogGroups` | Lists log groups and populates the log group selector. | Required for logs queries and the Log Groups template variable. |
| `logs:StartQuery`, `logs:StopQuery`, `logs:GetQueryResults` | Runs CloudWatch Logs Insights queries and retrieves their results. | Required for logs queries. |
| `logs:GetLogGroupFields` | Retrieves the fields available in a log group for autocomplete. | Optional. Improves the logs query editor experience. |
| `logs:GetLogEvents` | Retrieves individual log events. | Optional. Only needed for queries that read raw log events. |
| `logs:Unmask` | Reveals data masked by a CloudWatch Logs data protection policy. | Optional. Only needed to view masked sensitive data. |
| `ec2:DescribeRegions` | Lists available AWS regions. | Optional. Only needed if you rely on dynamic region discovery. |
| `ec2:DescribeInstances`, `ec2:DescribeTags` | Resolves EC2 instance attributes and tags for dimension and EC2 template variables. | Optional. Only needed for EC2 Instance Attributes template variables. |
| `ec2:DescribeVolumes` | Resolves EBS volume IDs for the EBS Volume IDs template variable. | Optional. Only needed for EBS Volume IDs template variables. |
| `tag:GetResources` | Resolves resource ARNs for the Resource ARNs template variable. | Optional. Only needed for Resource ARNs template variables. |
| `oam:ListSinks`, `oam:ListAttachedLinks` | Discovers linked accounts for CloudWatch cross-account observability. | Optional. Only needed for cross-account observability. |

When you use an **Assume Role ARN**, attach these query permissions to the assumed role. The primary credentials only need permission to perform `sts:AssumeRole`. For details, refer to [Assume a role](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/datasources/aws-cloudwatch/aws-authentication/#assume-a-role).

### CloudWatch Logs data protection

CloudWatch Logs can protect data by applying log group data protection policies. When data protection is enabled for a log group, any sensitive data that matches the identifiers you select is automatically masked. To view masked data, your IAM role or user must have the `logs:Unmask` permission. For more details, refer to [the AWS guide](https://docs.aws.amazon.com/AmazonCloudWatch/latest/logs/mask-sensitive-log-data.html) on masking sensitive log data.

### Configure the data source with grafana.ini

The Grafana [configuration file](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/setup-grafana/configure-grafana/#aws) includes an `AWS` section where you can configure data source options:

| Configuration option      | Description                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| ------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `allowed_auth_providers`  | Specifies which authentication providers are allowed for the CloudWatch data source as a comma-separated list. The default is `default,keys,credentials`: `default` (AWS SDK Default), `keys` (Access and secret key), and `credentials` (Credentials file). The `ec2_iam_role` (EC2 IAM role) provider is also available but isn't enabled by default.                                                                                                |
| `assume_role_enabled`     | Allows you to disable `assume role (ARN)` in the CloudWatch data source. The assume role (ARN) is enabled by default in open source Grafana.                                                                                                                                                                                                                                                                                                    |
| `per_datasource_http_proxy_enabled` | Allows each CloudWatch data source instance to use its own HTTP proxy configuration for requests to AWS, instead of a shared proxy. Disabled by default. Set to `true` to enable.                                                                                                                                                                                                                                                          |
| `list_metrics_page_limit` | Sets the limit of List Metrics API pages. When a custom namespace is specified in the query editor, the [List Metrics API](https://docs.aws.amazon.com/AmazonCloudWatch/latest/APIReference/API_ListMetrics.html) populates the _Metrics_ field and _Dimension_ fields. The API is paginated and returns up to 500 results per page, and the data source also limits the number of pages to 500 by default. This setting customizes that limit. |

### Provision the data source

You can define and configure the data source in YAML files as part of the Grafana provisioning system.
For more information about provisioning and available configuration options, refer to [Provision Grafana](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/administration/provisioning/#data-sources).

**Using AWS SDK (default)**:

```yaml
apiVersion: 1
datasources:
  - name: CloudWatch
    type: CloudWatch
    jsonData:
      authType: default
      defaultRegion: eu-west-2
```

**Using credentials' profile name (non-default)**:

```yaml
apiVersion: 1

datasources:
  - name: CloudWatch
    type: CloudWatch
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
    type: CloudWatch
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
    type: CloudWatch
    jsonData:
      authType: default
      assumeRoleArn: arn:aws:iam::123456789012:root
      defaultRegion: eu-west-2
```

### Configure with Terraform

You can configure the CloudWatch data source using [Terraform](https://www.terraform.io/) with the [Grafana Terraform provider](https://registry.terraform.io/providers/grafana/grafana/latest/docs).

For more information about provisioning resources with Terraform, refer to [Grafana as code using Terraform](https://grafana.com/docs/grafana-cloud/developer-resources/infrastructure-as-code/terraform/).

The following example uses the **Access and secret key** authentication method:

```hcl
resource "grafana_data_source" "cloudwatch" {
  name = "CloudWatch"
  type = "cloudwatch"

  json_data_encoded = jsonencode({
    authType      = "keys"
    defaultRegion = "eu-west-2"
  })

  secure_json_data_encoded = jsonencode({
    accessKey = "<YOUR_ACCESS_KEY>"
    secretKey = "<YOUR_SECRET_KEY>"
  })
}
```

The following example uses the **AWS SDK Default** authentication method with an assumed role:

```hcl
resource "grafana_data_source" "cloudwatch" {
  name = "CloudWatch"
  type = "cloudwatch"

  json_data_encoded = jsonencode({
    authType      = "default"
    assumeRoleArn = "arn:aws:iam::123456789012:role/<ROLE_NAME>"
    defaultRegion = "eu-west-2"
  })
}
```

Replace the placeholders with your own values:

- `<YOUR_ACCESS_KEY>` and `<YOUR_SECRET_KEY>`: The AWS access key ID and secret access key for the **Access and secret key** method.
- `<ROLE_NAME>`: The name of the IAM role to assume.

For all available configuration options, refer to the [Grafana provider data source resource documentation](https://registry.terraform.io/providers/grafana/grafana/latest/docs/resources/data_source).
