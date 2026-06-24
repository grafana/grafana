---
aliases:
  - ../../data-sources/aws-cloudwatch/template-variables/
  - template-queries-cloudwatch/
description: Guide on using template variables in CloudWatch queries
keywords:
  - grafana
  - aws
  - cloudwatch
  - templates
  - variables
labels:
  products:
    - cloud
    - enterprise
    - oss
menuTitle: Template variables
title: CloudWatch template variables
weight: 300
review_date: 2026-06-23
---

# CloudWatch template variables

Instead of hard-coding details such as server, application, and sensor names in metric queries, you can use variables.
Grafana lists these variables in drop-down select boxes at the top of the dashboard to help you change the data displayed in your dashboard. Grafana refers to such variables as template variables.

For an introduction to templating and template variables, refer to [Templating](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/dashboards/variables/) and [Add and manage variables](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/dashboards/variables/add-template-variables/).

## Use query variables

You can specify these CloudWatch data source queries in the Variable edit view's **Query type** field.
Use them to fill a variable's options list with values like `regions`, `namespaces`, `metric names`, and `dimension keys/values`.

| Name                        | List returned                                                                                                                                    |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Regions**                 | All AWS regions.                                                                                                                                 |
| **Namespaces**              | All namespaces CloudWatch supports.                                                                                                              |
| **Metrics**                 | Metrics in the namespace. (Specify region or use "default" for custom metrics.)                                                                  |
| **Dimension Keys**          | Dimension keys in the namespace.                                                                                                                 |
| **Dimension Values**        | Dimension values matching the specified `region`, `namespace`, `metric`, and `dimension key`. Use dimension `filters` for more specific results. |
| **EBS Volume IDs**          | Volume IDs matching the specified `region` and `instance ID`.                                                                                    |
| **EC2 Instance Attributes** | Attributes matching the specified `region`, `attribute name`, and `filters`.                                                                     |
| **Resource ARNs**           | ARNs matching the specified `region`, `resource type`, and `tags`.                                                                               |
| **Statistics**              | All standard statistics.                                                                                                                         |
| **Log Groups**              | Log groups matching the specified `region` and optional log group `prefix`. The variable value is the log group ARN.                             |
| **Accounts**                | The IDs of linked monitoring accounts for the specified `region`. Available only when cross-account observability is enabled.                     |

When cross-account observability is enabled, the **Metrics**, **Dimension Keys**, **Dimension Values**, and **Log Groups** query types also show an optional **Account** field. Use it to target a specific linked monitoring account, or leave it unset to query all linked accounts. For more information, refer to [Cross-account observability](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/datasources/aws-cloudwatch/query-editor/#cross-account-observability).

For details on the available dimensions, refer to the [CloudWatch Metrics and Dimensions Reference](https://docs.aws.amazon.com/AmazonCloudWatch/latest/monitoring/CW_Support_For_AWS.html).

For details about the metrics CloudWatch provides, refer to the [CloudWatch documentation](https://docs.aws.amazon.com/AmazonCloudWatch/latest/DeveloperGuide/CW_Support_For_AWS.html).

### Use variables in queries

Use the Grafana variable syntax to include variables in queries. A query variable dynamically retrieves values from your data source using a query.
For details, refer to the [variable syntax documentation](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/dashboards/variables/variable-syntax/).

CloudWatch metric queries support variables in the **Region**, **Namespace**, **Metric name**, dimension key, and dimension value fields.

For example, if you create a variable named `region` with the **Regions** query type and a variable named `instance` with the **EC2 Instance Attributes** query type, you can reference them in a metric query by setting the query editor **Region** to `$region` and a dimension value to `$instance`. The dashboard then updates as you change the selected region and instance.

## Query EC2 instance attributes

The **EC2 Instance Attributes** query type retrieves instance metadata using the AWS [`ec2:DescribeInstances`](http://docs.aws.amazon.com/AWSEC2/latest/APIReference/API_DescribeInstances.html) API. Configure it with the following fields in the variable editor:

- **Region:** The AWS region to query.
- **Attribute name:** The instance attribute to return for each matching instance.
- **Filters:** _Optional._ Filters that limit which instances are returned.

{{< admonition type="note" >}}
The earlier `ec2_instance_attribute(region, attributeName, filters)` query syntax is still supported. Grafana automatically migrates existing variables that use it to the EC2 Instance Attributes query type.
{{< /admonition >}}

### Filters

Each filter has a key and a comma-separated list of matching values. Use the [filters supported by `ec2:DescribeInstances`](http://docs.aws.amazon.com/AWSEC2/latest/APIReference/API_DescribeInstances.html), such as instance properties. To filter by tag, use a key in the form `tag:<name>`, for example `tag:Environment`.

### Select attributes

A query returns one attribute per instance. You can select any attribute that has a single value and isn't an object or array, also known as a flat attribute:

- `AmiLaunchIndex`
- `Architecture`
- `ClientToken`
- `EbsOptimized`
- `EnaSupport`
- `Hypervisor`
- `ImageId`
- `InstanceId`
- `InstanceLifecycle`
- `InstanceType`
- `KernelId`
- `KeyName`
- `LaunchTime`
- `Platform`
- `PrivateDnsName`
- `PrivateIpAddress`
- `PublicDnsName`
- `PublicIpAddress`
- `RamdiskId`
- `RootDeviceName`
- `RootDeviceType`
- `SourceDestCheck`
- `SpotInstanceRequestId`
- `SriovNetSupport`
- `SubnetId`
- `VirtualizationType`
- `VpcId`

Some attributes are objects rather than flat values. To select a nested value, use dot notation, for example `IamInstanceProfile.Arn`.

To select a tag value, prepend the tag name with `Tags.`. For example, select the `Name` tag by using `Tags.Name`.
