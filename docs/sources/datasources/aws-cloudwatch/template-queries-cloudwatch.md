+++
title = "Template variables in CloudWatch query"
description = "Template variables in CloudWatch queryh"
weight = 10
aliases = ["/docs/grafana/latest/datasources/cloudwatch"]
+++

# Using template variables in CloudWatch queries

Instead of hard-coding server, application, and sensor names in your metric queries, you can use variables. The variables are listed as dropdown select boxes at the top of the dashboard. These dropdowns make it easy to change the display of data in your dashboard.

For an introduction to templating and template variables, refer to the [Templating]({{< relref "../../variables/_index.md" >}}) documentation.

## Query variable

The CloudWatch data source provides the following queries that you can specify in the `Query Type` field in the Variable edit view. They enable you to fill a variable's options list with values such as `region`, `namespaces`, `metric names` and `dimension keys/values`.

Read more about the available dimensions in the [CloudWatch Metrics and Dimensions Reference](https://docs.aws.amazon.com/AmazonCloudWatch/latest/monitoring/CW_Support_For_AWS.html).

| Name                      | Description                                                                                                                                                                   |
| ------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Regions`                 | Returns a list of all AWS regions                                                                                                                                             |
| `Namespaces`              | Returns a list of all the namespaces CloudWatch supports.                                                                                                                     |
| `Metrics`                 | Returns a list of metrics in the namespace. (specify region or use "default" for custom metrics)                                                                              |
| `Dimension Keys`          | Returns a list of dimension keys in the namespace.                                                                                                                            |
| `Dimension Values`        | Returns a list of dimension values matching the specified `region`, `namespace`, `metric`, and `dimension_key`. You can use dimension `filters` to get more specific results. |
| `EBS Volume IDs`          | Returns a list of volume ids matching the specified `region` and `instance_id`.                                                                                               |
| `EC2 Instance Attributes` | Returns a list of attributes matching the specified `region`, `attribute_name`, and `filters`.                                                                                |
| `Resource ARNs`           | Returns a list of ARNs matching the specified `region`, `resource_type` and `tags`.                                                                                           |
| `Statistics`              | Returns a list of all the standard statistics.                                                                                                                                |

For details about the metrics CloudWatch provides, please refer to the [CloudWatch documentation](https://docs.aws.amazon.com/AmazonCloudWatch/latest/DeveloperGuide/CW_Support_For_AWS.html).

### Using variables in queries

Variables can be used in the variable form. Refer to the [variable syntax documentation]({{< relref "../../variables/syntax.md" >}}).

## Using JSON format template variables

Some queries accept filters in JSON format and Grafana supports the conversion of template variables to JSON.

For example, if `env = 'production', 'staging'`, a `Resource ARNs` query with the following filter returns ARNs of EC2 instances where the `Environment` tag is equal to `production` or `staging`.

```javascript
{"Environment":${env:json}}
```

## ec2_instance_attribute examples

### JSON filters

The `ec2_instance_attribute` query takes `filters` in JSON format.
You can specify [pre-defined filters of ec2:DescribeInstances](http://docs.aws.amazon.com/AWSEC2/latest/APIReference/API_DescribeInstances.html).
Note that the actual filtering takes place on Amazon's servers, not in Grafana.

Filters syntax:

```javascript
{ "filter_name1": [ "filter_value1" ], "filter_name2": [ "filter_value2" ] }
```

### Selecting attributes

Only 1 attribute per instance can be returned. Any flat attribute can be selected (i.e. if the attribute has a single value and isn't an object or array). Below is a list of available flat attributes:

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

You can select tags by prepending the tag name with `Tags.`. For example, the tag `Name` is selected with `Tags.Name`.
