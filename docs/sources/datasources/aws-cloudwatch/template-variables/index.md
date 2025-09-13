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
refs:
  variable-syntax:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/dashboards/variables/variable-syntax/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana/<GRAFANA_VERSION>/dashboards/variables/variable-syntax/
  add-template-variables:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/dashboards/variables/add-template-variables/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana/<GRAFANA_VERSION>/dashboards/variables/add-template-variables/
  variables:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/dashboards/variables/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana/<GRAFANA_VERSION>/dashboards/variables/
---

# CloudWatch template variables

Instead of hard-coding details such as server, application, and sensor names in metric queries, you can use variables.
Grafana lists these variables in drop-down select boxes at the top of the dashboard to help you change the data displayed in your dashboard, and they are called template variables

<!-- Grafana refers to such variables as template variables. -->

For an introduction to templating and template variables, refer to [Templating](ref:variables) and [Add and manage variables](ref:add-template-variables).

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

Use the Grafana variable syntax to include variables in queries. A query variable in dynamically retrieves values from your data source using a query.
For details, refer to the [variable syntax documentation](ref:variable-syntax).

## Use ec2_instance_attribute

The `ec2_instance_attribute` function in template variables allows Grafana to retrieve certain instance metadata from the EC2 metadata service, including `Instance ID` and `region`.

### Filters

The `ec2_instance_attribute` query takes `filters` as a filter name and a comma-separated list of values.

The `ec2_instance_attribute` query takes a `filters` parameter, where each key is a filter name (such as a tag or instance property), and each value is a comma-separated list of matching values.

You can specify [pre-defined filters of ec2:DescribeInstances](http://docs.aws.amazon.com/AWSEC2/latest/APIReference/API_DescribeInstances.html).

### Select attributes

A query returns only one attribute per instance.
You can select any attribute that has a single value and isn't an object or array, also known as a `flat attribute`:

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
