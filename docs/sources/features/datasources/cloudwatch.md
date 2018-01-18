+++
title = "AWS CloudWatch"
description = "Guide for using CloudWatch in Grafana"
keywords = ["grafana", "cloudwatch", "guide"]
type = "docs"
aliases = ["/datasources/cloudwatch"]
[menu.docs]
name = "AWS Cloudwatch"
identifier = "cloudwatch"
parent = "datasources"
weight = 10
+++

# Using AWS CloudWatch in Grafana

Grafana ships with built in support for CloudWatch. You just have to add it as a data source and you will be ready to build dashboards for you CloudWatch metrics.

## Adding the data source to Grafana

1. Open the side menu by clicking the Grafana icon in the top header.
2. In the side menu under the `Dashboards` link you should find a link named `Data Sources`.
3. Click the `+ Add data source` button in the top header.
4. Select `Cloudwatch` from the *Type* dropdown.

> NOTE: If at any moment you have issues with getting this datasource to work and Grafana is giving you undescriptive errors then don't
forget to check your log file (try looking in /var/log/grafana/grafana.log).

Name | Description
------------ | -------------
*Name* | The data source name. This is how you refer to the data source in panels & queries.
*Default* | Default data source means that it will be pre-selected for new panels.
*Credentials* profile name | Specify the name of the profile to use (if you use `~/.aws/credentials` file), leave blank for default.
*Default Region* | Used in query editor to set region (can be changed on per query basis)
*Custom Metrics namespace* | Specify the CloudWatch namespace of Custom metrics
*Assume Role Arn* | Specify the ARN of the role to assume

## Authentication

### IAM Roles

Currently all access to CloudWatch is done server side by the Grafana backend using the official AWS SDK. If you grafana
server is running on AWS you can use IAM Roles and authentication will be handled automatically.

Checkout AWS docs on [IAM Roles](http://docs.aws.amazon.com/AWSEC2/latest/UserGuide/iam-roles-for-amazon-ec2.html)

### AWS credentials file

Create a file at `~/.aws/credentials`. That is the `HOME` path for user running grafana-server.
    > NOTE: If you think you have the credentials file in the right place but it is still not working then you might try moving your .aws file to '/usr/share/grafana/' and make sure your credentials file has at most 0644 permissions.

Example content:

```bash
[default]
aws_access_key_id = asdsadasdasdasd
aws_secret_access_key = dasdasdsadasdasdasdsa
region = us-west-2
```

## Metric Query Editor

![](/img/docs/v43/cloudwatch_editor.png)

You need to specify a namespace, metric, at least one stat, and at least one dimension.

## Templated queries

Instead of hard-coding things like server, application and sensor name in you metric queries you can use variables in their place.
Variables are shown as dropdown select boxes at the top of the dashboard. These dropdowns makes it easy to change the data
being displayed in your dashboard.

Checkout the [Templating]({{< relref "reference/templating.md" >}}) documentation for an introduction to the templating feature and the different
types of template variables.

### Query variable

CloudWatch Datasource Plugin provides the following queries you can specify in the `Query` field in the Variable
edit view. They allow you to fill a variable's options list with things like `region`, `namespaces`, `metric names`
and `dimension keys/values`.

In place of `region` you can specify `default` to use the default region configured in the datasource for the query,
e.g. `metrics(AWS/DynamoDB, default)` or `dimension_values(default, ..., ..., ...)`.

Name | Description
------- | --------
*regions()* | Returns a list of regions AWS provides their service.
*namespaces()* | Returns a list of namespaces CloudWatch support.
*metrics(namespace, [region])* | Returns a list of metrics in the namespace. (specify region or use "default" for custom metrics)
*dimension_keys(namespace)* | Returns a list of dimension keys in the namespace.
*dimension_values(region, namespace, metric, dimension_key)* | Returns a list of dimension values matching the specified `region`, `namespace`, `metric` and `dimension_key`.
*ebs_volume_ids(region, instance_id)* | Returns a list of volume ids matching the specified `region`, `instance_id`.
*ec2_instance_attribute(region, attribute_name, filters)* | Returns a list of attributes matching the specified `region`, `attribute_name`, `filters`.

For details about the metrics CloudWatch provides, please refer to the [CloudWatch documentation](https://docs.aws.amazon.com/AmazonCloudWatch/latest/DeveloperGuide/CW_Support_For_AWS.html).

#### Examples templated Queries

Example dimension queries which will return list of resources for individual AWS Services:

Query | Service
------- | -----
*dimension_values(us-east-1,AWS/ELB,RequestCount,LoadBalancerName)* | ELB
*dimension_values(us-east-1,AWS/ElastiCache,CPUUtilization,CacheClusterId)* | ElastiCache
*dimension_values(us-east-1,AWS/Redshift,CPUUtilization,ClusterIdentifier)* | RedShift
*dimension_values(us-east-1,AWS/RDS,CPUUtilization,DBInstanceIdentifier)* | RDS
*dimension_values(us-east-1,AWS/S3,BucketSizeBytes,BucketName)* | S3

## ec2_instance_attribute examples

### JSON filters

The `ec2_instance_attribute` query takes `filters` in JSON format.
You can specify [pre-defined filters of ec2:DescribeInstances](http://docs.aws.amazon.com/AWSEC2/latest/APIReference/API_DescribeInstances.html).
Note that the actual filtering takes place on Amazon's servers, not in Grafana.

Filters syntax:

```javascript
{ filter_name1: [ filter_value1 ], filter_name2: [ filter_value2 ] }
```

Example `ec2_instance_attribute()` query

```javascript
ec2_instance_attribute(us-east-1, InstanceId, { "tag:Environment": [ "production" ] })
```

### Selecting Attributes

Only 1 attribute per instance can be returned. Any flat attribute can be selected (i.e. if the attribute has a single value and isn't an object or array). Below is a list of available flat attributes:

  * `AmiLaunchIndex`
  * `Architecture`
  * `ClientToken`
  * `EbsOptimized`
  * `EnaSupport`
  * `Hypervisor`
  * `IamInstanceProfile`
  * `ImageId`
  * `InstanceId`
  * `InstanceLifecycle`
  * `InstanceType`
  * `KernelId`
  * `KeyName`
  * `LaunchTime`
  * `Platform`
  * `PrivateDnsName`
  * `PrivateIpAddress`
  * `PublicDnsName`
  * `PublicIpAddress`
  * `RamdiskId`
  * `RootDeviceName`
  * `RootDeviceType`
  * `SourceDestCheck`
  * `SpotInstanceRequestId`
  * `SriovNetSupport`
  * `SubnetId`
  * `VirtualizationType`
  * `VpcId`

Tags can be selected by prepending the tag name with `Tags.`

Example `ec2_instance_attribute()` query

```javascript
ec2_instance_attribute(us-east-1, Tags.Name, { "tag:Team": [ "sysops" ] })
```

## Cost

Amazon provides 1 million CloudWatch API requests each month at no additional charge. Past this,
it costs $0.01 per 1,000 GetMetricStatistics or ListMetrics requests. For each query Grafana will
issue a GetMetricStatistics request and every time you pick a dimension in the query editor
Grafana will issue a ListMetrics request.
