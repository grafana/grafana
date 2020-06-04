+++
title = "AWS CloudWatch"
description = "Guide for using CloudWatch in Grafana"
keywords = ["grafana", "cloudwatch", "guide"]
type = "docs"
aliases = ["/docs/grafana/latest/datasources/cloudwatch"]
[menu.docs]
name = "AWS Cloudwatch"
identifier = "cloudwatch"
parent = "datasources"
weight = 5
+++

# Using AWS CloudWatch in Grafana

Grafana ships with built-in support for CloudWatch. Add it as a data source, then you are ready to
build dashboards or use Explore with CloudWatch metrics and CloudWatch Logs.

## Adding the data source

1. In the side menu under the `Configuration` link, click on `Data Sources`.
2. Click the `Add data source` button.
3. Select `Cloudwatch` in the `Cloud` section.

> NOTE: If at any moment you have issues with getting this data source to work and Grafana is giving you undescriptive errors then don't
> forget to check your log file (try looking in /var/log/grafana/grafana.log).

| Name                       | Description                                                                                             |
| -------------------------- | ------------------------------------------------------------------------------------------------------- |
| _Name_                     | The data source name. This is how you refer to the data source in panels and queries.                   |
| _Default_                  | Default data source means that it will be pre-selected for new panels.                                  |
| _Default Region_           | Used in query editor to set region (can be changed on per query basis)                                  |
| _Custom Metrics namespace_ | Specify the CloudWatch namespace of Custom metrics                                                      |
| _Auth Provider_            | Specify the provider to get credentials.                                                                |
| _Credentials_ profile name | Specify the name of the profile to use (if you use `~/.aws/credentials` file), leave blank for default. |
| _Assume Role Arn_          | Specify the ARN of the role to assume                                                                   |

## Authentication

### IAM Roles

Currently all access to CloudWatch is done server side by the Grafana backend using the official AWS SDK. If your Grafana
server is running on AWS you can use IAM Roles and authentication will be handled automatically.

See the AWS documentation on [IAM Roles](http://docs.aws.amazon.com/AWSEC2/latest/UserGuide/iam-roles-for-amazon-ec2.html)

> NOTE: AWS Role Switching as described [here](https://docs.aws.amazon.com/IAM/latest/UserGuide/id_roles_use_switch-role-cli.html) is not supported at the moment.

## IAM Policies

Grafana needs permissions granted via IAM to be able to read CloudWatch metrics
and EC2 tags/instances/regions. You can attach these permissions to IAM roles and
utilize Grafana's built-in support for assuming roles.

Here is a minimal policy example:

```bash
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
        "cloudwatch:GetMetricStatistics",
        "cloudwatch:GetMetricData"
      ],
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

### AWS credentials

If Auth Provider is `Credentials file`, Grafana tries to get credentials in the following order.

- Environment variables. (`AWS_ACCESS_KEY_ID` and `AWS_SECRET_ACCESS_KEY`)
- Hard-code credentials.
- Shared credentials file.
- IAM role for Amazon EC2.

See the AWS documentation on [Configuring the AWS SDK for Go](https://docs.aws.amazon.com/sdk-for-go/v1/developer-guide/configuring-sdk.html)

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

## Using the Query Editor

The CloudWatch data source can query data from both CloudWatch metrics and CloudWatch Logs APIs, each with its own specialized query editor. You select which API you want to query with using the query mode switch on top of the editor.

{{< docs-imagebox img="/img/docs/v70/cloudwatch-metrics-query-field.png" max-width="800px" class="docs-image--left" caption="CloudWatch metrics query field" >}}
{{< docs-imagebox img="/img/docs/v70/cloudwatch-logs-query-field.png" max-width="800px" class="docs-image--right" caption="CloudWatch Logs query field" >}}

## Using the Metric Query Editor

To create a valid query, you need to specify the namespace, metric name and at least one statistic. If `Match Exact` is enabled, you also need to specify all the dimensions of the metric you’re querying, so that the [metric schema](https://docs.aws.amazon.com/AmazonCloudWatch/latest/monitoring/search-expression-syntax.html) matches exactly. If `Match Exact` is off, you can specify any number of dimensions by which you’d like to filter. Up to 100 metrics matching your filter criteria will be returned.

### Dynamic queries using dimension wildcards

> Only available in Grafana v6.5+.

In Grafana 6.5 or higher, you’re able to monitor a dynamic list of metrics by using the asterisk (\*) wildcard for one or more dimension values.

{{< docs-imagebox img="/img/docs/v65/cloudwatch-dimension-wildcard.png" max-width="800px" class="docs-image--right" caption="CloudWatch dimension wildcard" >}}

In the example, all metrics in the namespace `AWS/EC2` with a metric name of `CPUUtilization` and ANY value for the `InstanceId` dimension are queried. This can help you monitor metrics for AWS resources, like EC2 instances or containers. For example, when new instances get created as part of an auto scaling event, they will automatically appear in the graph without you having to track the new instance IDs. This capability is currently limited to retrieving up to 100 metrics. You can click on `Show Query Preview` to see the search expression that is automatically built to support wildcards. To learn more about search expressions, visit the [CloudWatch documentation](https://docs.aws.amazon.com/AmazonCloudWatch/latest/monitoring/search-expression-syntax.html).

By default, the search expression is defined in such a way that the queried metrics must match the defined dimension names exactly. This means that in the example only metrics with exactly one dimension with name ‘InstanceId’ will be returned.

You can untoggle `Match Exact` to include metrics that have other dimensions defined. Disabling `Match Exact` also creates a search expression even if you don’t use wildcards. We simply search for any metric that matches at least the namespace, metric name, and all defined dimensions.

### Multi-value template variables

> Only available in Grafana v6.5+.

When defining dimension values based on multi-valued template variables, a search expression is used to query for the matching metrics. This enables the use of multiple template variables in one query and also allows you to use template variables for queries that have the `Match Exact` option disabled.

Search expressions are currently limited to 1024 characters, so your query may fail if you have a long list of values. We recommend using the asterisk (`*`) wildcard instead of the `All` option if you want to query all metrics that have any value for a certain dimension name.

The use of multi-valued template variables is only supported for dimension values. Using multi-valued template variables for `Region`, `Namespace`, or `Metric Name` is not supported.

### Metric math expressions

You can create new time series metrics by operating on top of CloudWatch metrics using mathematical functions. Arithmetic operators, unary subtraction and other functions are supported and can be applied to CloudWatch metrics. More details on the available functions can be found on [AWS Metric Math](https://docs.aws.amazon.com/AmazonCloudWatch/latest/monitoring/using-metric-math.html)

As an example, if you want to apply arithmetic operations on a metric, you can do it by giving an id (a unique string) to the raw metric as shown below. You can then use this id and apply arithmetic operations to it in the Expression field of the new metric.

Please note that in the case you use the expression field to reference another query, like `queryA * 2`, it will not be possible to create an alert rule based on that query.

### Period

A period is the length of time associated with a specific Amazon CloudWatch statistic. Periods are defined in numbers of seconds, and valid values for period are 1, 5, 10, 30, or any multiple of 60.

If the period field is left blank or set to `auto`, then it calculates automatically based on the time range. The formula used is `time range in seconds / 2000`, and then it snaps to the next higher value in an array of predefined periods `[60, 300, 900, 3600, 21600, 86400]`. By clicking `Show Query Preview` in the query editor, you can see what period Grafana used.

### Deep linking from Grafana panels to the CloudWatch console

> Only available in Grafana v6.5+.

{{< docs-imagebox img="/img/docs/v65/cloudwatch-deep-linking.png" max-width="500px" class="docs-image--right" caption="CloudWatch deep linking" >}}

Left clicking a time series in the panel shows a context menu with a link to `View in CloudWatch console`. Clicking that link will open a new tab that will take you to the CloudWatch console and display all the metrics for that query. If you're not currently logged in to the CloudWatch console, the link will forward you to the login page. The provided link is valid for any account but will only display the right metrics if you're logged in to the account that corresponds to the selected data source in Grafana.

This feature is not available for metrics that are based on metric math expressions.

## Using the Logs Query Editor

> Only available in Grafana v7.0+.

To query CloudWatch Logs, select the region and up to 20 log groups which you want to query. Use the main input area to write your query in [CloudWatch Logs Query Language](https://docs.aws.amazon.com/AmazonCloudWatch/latest/logs/CWL_QuerySyntax.html)

You can also write queries returning time series data by using the [`stats` command](https://docs.aws.amazon.com/AmazonCloudWatch/latest/logs/CWL_Insights-Visualizing-Log-Data.html). When making `stats` queries in Explore, you have to make sure you are in Metrics Explore mode.

{{< docs-imagebox img="/img/docs/v70/explore-mode-switcher.png" max-width="500px" class="docs-image--right" caption="Explore mode switcher" >}}

To the right of the query input field is a CloudWatch Logs Insights link that opens the CloudWatch Logs Insights console with your query. You can continue exploration there if necessary.

{{< docs-imagebox img="/img/docs/v70/cloudwatch-logs-deep-linking.png" max-width="500px" class="docs-image--right" caption="CloudWatch Logs deep linking" >}}

### Using template variables

As with several other data sources, the CloudWatch data source supports the use of template variables in queries.
See the [Templating]({{< relref "../../variables/templates-and-variables.md" >}}) documentation for an introduction to the templating feature and the different types of template variables.

### Deep linking from Grafana panels to the CloudWatch console

{{< docs-imagebox img="/img/docs/v70/cloudwatch-logs-deep-linking.png" max-width="500px" class="docs-image--right" caption="CloudWatch Logs deep linking" >}}
If you'd like to view your query in the CloudWatch Logs Insights console, simply click the `CloudWatch Logs Insights` button next to the query editor.
If you're not currently logged in to the CloudWatch console, the link will forward you to the login page. The provided link is valid for any account but will only display the right metrics if you're logged in to the account that corresponds to the selected data source in Grafana.

### Alerting

Since CloudWatch Logs queries can return numeric data, for example through the use of the `stats` command, alerts are supported.
See the [Alerting]({{< relref "../../alerting/alerts-overview.md" >}}) documentation for more on Grafana alerts.

## Curated dashboards

> Only available in Grafana v6.5+.

The updated CloudWatch data source ships with pre-configured dashboards for five of the most popular AWS services:

- Amazon Elastic Compute Cloud `Amazon EC2`,
- Amazon Elastic Block Store `Amazon EBS`,
- AWS Lambda `AWS Lambda`,
- Amazon CloudWatch Logs `Amazon CloudWatch Logs`, and
- Amazon Relational Database Service `Amazon RDS`.

To import the pre-configured dashboards, go to the configuration page of your CloudWatch data source and click on the `Dashboards` tab. Click `Import` for the dashboard you would like to use. To customize the dashboard, we recommend saving the dashboard under a different name, because otherwise the dashboard will be overwritten when a new version of the dashboard is released.

TODO: will need to be update when we have the dashboards for logs.

{{< docs-imagebox img="/img/docs/v65/cloudwatch-dashboard-import.png" caption="CloudWatch dashboard import" >}}

## Templated queries

Instead of hard-coding things like server, application and sensor name in you metric queries you can use variables in their place. Variables are shown as dropdown select boxes at the top of the dashboard. These dropdowns make it easy to change the data being displayed in your dashboard.

See the [Templating]({{< relref "../../variables/templates-and-variables.md" >}}) documentation for an introduction to the templating feature and the different types of template variables.

### Query variable

The CloudWatch data source provides the following queries that you can specify in the `Query` field in the Variable edit view. They allow you to fill a variable's options list with things like `region`, `namespaces`, `metric names` and `dimension keys/values`.

In place of `region` you can specify `default` to use the default region configured in the data source for the query,
e.g. `metrics(AWS/DynamoDB, default)` or `dimension_values(default, ..., ..., ...)`.

Read more about the available dimensions in the [CloudWatch Metrics and Dimensions Reference](https://docs.aws.amazon.com/AmazonCloudWatch/latest/monitoring/CW_Support_For_AWS.html).

| Name                                                                          | Description                                                                                                                                                                        |
| ----------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| _regions()_                                                                   | Returns a list of all AWS regions                                                                                                                                                  |
| _namespaces()_                                                                | Returns a list of namespaces CloudWatch support.                                                                                                                                   |
| _metrics(namespace, [region])_                                                | Returns a list of metrics in the namespace. (specify region or use "default" for custom metrics)                                                                                   |
| _dimension_\__keys(namespace)_                                                | Returns a list of dimension keys in the namespace.                                                                                                                                 |
| _dimension_\__values(region, namespace, metric, dimension_\__key, [filters])_ | Returns a list of dimension values matching the specified `region`, `namespace`, `metric`, `dimension_key` or you can use dimension `filters` to get more specific result as well. |
| _ebs_\__volume_\__ids(region, instance_\__id)_                                | Returns a list of volume ids matching the specified `region`, `instance_id`.                                                                                                       |
| _ec2_\__instance_\__attribute(region, attribute_\__name, filters)_            | Returns a list of attributes matching the specified `region`, `attribute_name`, `filters`.                                                                                         |
| _resource_\__arns(region, resource_\__type, tags)_                            | Returns a list of ARNs matching the specified `region`, `resource_type` and `tags`.                                                                                                |
| _statistics()_                                                                | Returns a list of all the standard statistics                                                                                                                                      |

For details about the metrics CloudWatch provides, please refer to the [CloudWatch documentation](https://docs.aws.amazon.com/AmazonCloudWatch/latest/DeveloperGuide/CW_Support_For_AWS.html).

#### Examples templated queries

Example dimension queries which will return list of resources for individual AWS Services:

| Query                                                                                                                            | Service          |
| -------------------------------------------------------------------------------------------------------------------------------- | ---------------- |
| _dimension_\__values(us-east-1,AWS/ELB,RequestCount,LoadBalancerName)_                                                           | ELB              |
| _dimension_\__values(us-east-1,AWS/ElastiCache,CPUUtilization,CacheClusterId)_                                                   | ElastiCache      |
| _dimension_\__values(us-east-1,AWS/Redshift,CPUUtilization,ClusterIdentifier)_                                                   | RedShift         |
| _dimension_\__values(us-east-1,AWS/RDS,CPUUtilization,DBInstanceIdentifier)_                                                     | RDS              |
| _dimension_\__values(us-east-1,AWS/S3,BucketSizeBytes,BucketName)_                                                               | S3               |
| _dimension_\__values(us-east-1,CWAgent,disk_\__used_\__percent,device,{"InstanceId":"\$instance_\__id"})_                        | CloudWatch Agent |
| _resource_\__arns(eu-west-1,elasticloadbalancing:loadbalancer,{"elasticbeanstalk:environment-name":["myApp-dev","myApp-prod"]})_ | ELB              |
| _resource_\__arns(eu-west-1,ec2:instance,{"elasticbeanstalk:environment-name":["myApp-dev","myApp-prod"]})_                      | EC2              |

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
ec2_instance_attribute(us - east - 1, InstanceId, { 'tag:Environment': ['production'] });
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

Tags can be selected by prepending the tag name with `Tags.`

Example `ec2_instance_attribute()` query

```javascript
ec2_instance_attribute(us - east - 1, Tags.Name, { 'tag:Team': ['sysops'] });
```

## Using json format template variables

Some queries accept filters in JSON format and Grafana supports the conversion of template variables to JSON.

If `env = 'production', 'staging'`, following query will return ARNs of EC2 instances which `Environment` tag is `production` or `staging`.

```
resource_arns(us-east-1, ec2:instance, {"Environment":${env:json}})
```

## Pricing

The Amazon CloudWatch data source for Grafana uses the `ListMetrics` and `GetMetricData` CloudWatch API calls to list and retrieve metrics.
Pricing for CloudWatch Logs is based on the amount of data ingested, archived, and analyzed via CloudWatch Logs Insights queries.
Please see the [CloudWatch pricing page](https://aws.amazon.com/cloudwatch/pricing/) for more details.

Every time you pick a dimension in the query editor Grafana will issue a ListMetrics request.
Whenever you make a change to the queries in the query editor, one new request to GetMetricData will be issued.

Please note that for Grafana version 6.5 or higher, all API requests to GetMetricStatistics have been replaced with calls to GetMetricData. This change enables better support for CloudWatch metric math and enables the automatic generation of search expressions when using wildcards or disabling the `Match Exact` option. While GetMetricStatistics qualified for the CloudWatch API free tier, this is not the case for GetMetricData calls. For more information, please refer to the [CloudWatch pricing page](https://aws.amazon.com/cloudwatch/pricing/).

## Service quotas

AWS defines quotas, or limits, for resources, actions, and items in your AWS account. Depending on the number of queries in your dashboard and the number of users accessing the dashboard, you may reach the usage limits for various CloudWatch and CloudWatch Logs resources. Note that quotas are defined per account and per region. If you're using multiple regions or have set up more than one CloudWatch data source to query against multiple accounts, you need to request a quota increase for each account and each region in which you hit the limit.

To request a quota increase, visit the [AWS Service Quotas console](https://console.aws.amazon.com/servicequotas/home?r#!/services/monitoring/quotas/L-5E141212).

Please see the AWS documentation for [Service Quotas](https://docs.aws.amazon.com/servicequotas/latest/userguide/intro.html) and [CloudWatch limits](https://docs.aws.amazon.com/AmazonCloudWatch/latest/monitoring/cloudwatch_limits.html) for more information.

## Configure the data source with provisioning

It's now possible to configure data sources using config files with Grafana's provisioning system. You can read more about how it works and all the settings you can set for data sources on the [provisioning docs page]({{< relref "../../administration/provisioning/#datasources" >}})

Here are some provisioning examples for this data source.

### Using a credentials file

```yaml
apiVersion: 1

datasources:
  - name: Cloudwatch
    type: cloudwatch
    jsonData:
      authType: credentials
      defaultRegion: eu-west-2
```

### Using `accessKey` and `secretKey`

```yaml
apiVersion: 1

datasources:
  - name: Cloudwatch
    type: cloudwatch
    jsonData:
      authType: keys
      defaultRegion: eu-west-2
    secureJsonData:
      accessKey: '<your access key>'
      secretKey: '<your secret key>'
```
