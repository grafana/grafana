----
page_title: Cloudwatch
page_description: Cloudwatch grafana datasource documentation
page_keywords: Cloudwatch, grafana, documentation, datasource, docs
---

# CloudWatch

Grafana ships with built in support for CloudWatch. You just have to add it as a data source and you will
be ready to build dashboards for you CloudWatch metrics.

## Adding the data source
![](/img/cloudwatch/cloudwatch_add.png)

1. Open the side menu by clicking the the Grafana icon in the top header.
2. In the side menu under the `Dashboards` link you should find a link named `Data Sources`.

    > NOTE: If this link is missing in the side menu it means that your current user does not have the `Admin` role for the current organization.

3. Click the `Add new` link in the top header.
4. Select `CloudWatch` from the dropdown.

Name | Description
------------ | -------------
Name | The data source name, important that this is the same as in Grafana v1.x if you plan to import old dashboards.
Default | Default data source means that it will be pre-selected for new panels.
Credentials profile name | Specify the name of the profile to use (if you use `~/aws/credentials` file), leave blank for default. This option was introduced in Grafana 2.5.1
Default Region | Used in query editor to set region (can be changed on per query basis)
Custom Metrics namespace | Specify the CloudWatch namespace of Custom metrics
Assume Role Arn | Specify the ARN of the role to assume

## Authentication

### IAM Roles

Currently all access to CloudWatch is done server side by the Grafana backend using the official AWS SDK. If you grafana
server is running on AWS you can use IAM Roles and authentication will be handled automatically.

Checkout AWS docs on [IAM Roles](http://docs.aws.amazon.com/AWSEC2/latest/UserGuide/iam-roles-for-amazon-ec2.html)

### AWS credentials file

Create a file at `~/.aws/credentials`. That is the `HOME` path for user running grafana-server.

Example content:

    [default]
    aws_access_key_id = asdsadasdasdasd
    aws_secret_access_key = dasdasdsadasdasdasdsa
    region = us-west-2


## Metric Query Editor

![](/img/cloudwatch/query_editor.png)

You need to specify a namespace, metric, at least one stat, and at least one dimension.

## Templated queries
CloudWatch Datasource Plugin provides the following functions in `Variables values query` field in Templating Editor to query `region`, `namespaces`, `metric names` and `dimension keys/values` on the CloudWatch.

Name | Description
------- | --------
`regions()` | Returns a list of regions AWS provides their service.
`namespaces()` | Returns a list of namespaces CloudWatch support.
`metrics(namespace)` | Returns a list of metrics in the namespace.
`dimension_keys(namespace)` | Returns a list of dimension keys in the namespace.
`dimension_values(region, namespace, metric, dimension_key)` | Returns a list of dimension values matching the specified `region`, `namespace`, `metric` and `dimension_key`.
`ebs_volume_ids(region, instance_id)` | Returns a list of volume id matching the specified `region`, `instance_id`.
`ec2_instance_attribute(region, attribute_name, filters)` | Returns a list of attribute matching the specified `region`, `attribute_name`, `filters`.

For details about the metrics CloudWatch provides, please refer to the [CloudWatch documentation](https://docs.aws.amazon.com/AmazonCloudWatch/latest/DeveloperGuide/CW_Support_For_AWS.html).

## Example templated Queries

Example dimension queries which will return list of resources for individual AWS Services:

Service | Query
------- | -----
EBS | `dimension_values(us-east-1,AWS/ELB,RequestCount,LoadBalancerName)`
ElastiCache | `dimension_values(us-east-1,AWS/ElastiCache,CPUUtilization,CacheClusterId)`
RedShift | `dimension_values(us-east-1,AWS/Redshift,CPUUtilization,ClusterIdentifier)`
RDS | `dimension_values(us-east-1,AWS/RDS,CPUUtilization,DBInstanceIdentifier)`
S3 | `dimension_values(us-east-1,AWS/S3,BucketSizeBytes,BucketName)`

## ec2_instance_attribute JSON filters

The `ec2_instance_attribute` query take `filters` in JSON format.
You can specify [pre-defined filters of ec2:DescribeInstances](http://docs.aws.amazon.com/AWSEC2/latest/APIReference/API_DescribeInstances.html).
Specify like `{ filter_name1: [ filter_value1 ], filter_name2: [ filter_value2 ] }`

Example `ec2_instance_attribute()` query

    ec2_instance_attribute(us-east-1, InstanceId, { "tag:Environment": [ "production" ] })

![](/img/v2/cloudwatch_templating.png)

## Cost

Amazon provides 1 million CloudWatch API requests each month at no additional charge. Past this,
it costs $0.01 per 1,000 GetMetricStatistics or ListMetrics requests. For each query Grafana will
issue a GetMetricStatistics request and every time you pick a dimension in the query editor
Grafana will issue a ListMetrics request.


