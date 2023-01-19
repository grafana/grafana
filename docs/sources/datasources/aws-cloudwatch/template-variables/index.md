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
menuTitle: Template variables
title: CloudWatch template variables
weight: 400
---

# CloudWatch template variables

Instead of hard-coding details such as server, application, and sensor names in metric queries, you can use variables.
Grafana lists these variables in dropdown select boxes at the top of the dashboard to help you change the data displayed in your dashboard.
Grafana refers to such variables as template variables.

For an introduction to templating and template variables, refer to the [Templating]({{< relref "../../../dashboards/variables" >}}) and [Add and manage variables]({{< relref "../../../dashboards/variables/add-template-variables" >}}) documentation.

## Use query variables

You can specify these CloudWatch data source queries in the Variable edit view's **Query Type** field.
Use them to fill a variable's options list with values like `regions`, `namespaces`, `metric names`, and `dimension keys/values`.

| Name                        | List returned                                                                                                                                    |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Regions**                 | All AWS regions.                                                                                                                                 |
| **Namespaces**              | All namespaces CloudWatch supports.                                                                                                              |
| **Metrics**                 | Metrics in the namespace. (Specify region or use "default" for custom metrics.)                                                                  |
| **Dimension Keys**          | Dimension keys in the namespace.                                                                                                                 |
| **Dimension Values**        | Dimension values matching the specified `region`, `namespace`, `metric`, and `dimension_key`. Use dimension `filters` for more specific results. |
| **EBS Volume IDs**          | Volume ids matching the specified `region` and `instance_id`.                                                                                    |
| **EC2 Instance Attributes** | Attributes matching the specified `region`, `attribute_name`, and `filters`.                                                                     |
| **Resource ARNs**           | ARNs matching the specified `region`, `resource_type`, and `tags`.                                                                               |
| **Statistics**              | All standard statistics.                                                                                                                         |
| **LogGroups**               | All log groups matching the specified `region`.                                                                                                  |

For details on the available dimensions, refer to the [CloudWatch Metrics and Dimensions Reference](https://docs.aws.amazon.com/AmazonCloudWatch/latest/monitoring/CW_Support_For_AWS.html).

For details about the metrics CloudWatch provides, refer to the [CloudWatch documentation](https://docs.aws.amazon.com/AmazonCloudWatch/latest/DeveloperGuide/CW_Support_For_AWS.html).

### Use variables in queries

Use Grafana's variable syntax to include variables in queries.
For details, refer to the [variable syntax documentation]({{< relref "../../../dashboards/variables/variable-syntax" >}}).

## Use ec2_instance_attribute

### Filters

The `ec2_instance_attribute` query takes `filters` as a filter name and a comma-separated list of values.
You can specify [pre-defined filters of ec2:DescribeInstances](http://docs.aws.amazon.com/AWSEC2/latest/APIReference/API_DescribeInstances.html).

### Select attributes

A query returns only one attribute per instance.
You can select any attribute that has a single value and isn't an object or array, also known as a flat attribute:

- `AmiLaunchIndex`
- `Architecture`
- `ClientToken`
- `EbsOptimized`
- `EnaSupport`
- `Hypervisor`
- `IamInstanceProfile`
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

You can select tags by prepending the tag name with `Tags.`.
For example, select the tag `Name` by using `Tags.Name`.
