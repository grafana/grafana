----
page_title: Cloudwatch
page_description: Cloudwatch grafana datasource documentation
page_keywords: Cloudwatch, grafana, documentation, datasource, docs
---

<<<<<<< 05b941c75cf4422a6ede399871781a6ba63b7397
<<<<<<< 18ea8c9186f85496a3c30e579c3b2559d3b7c1b5
# CloudWatch

Grafana ships with built in support for CloudWatch. You just have to add it as a data source and you will
be ready to build dashboards for you CloudWatch metrics.

## Adding the data source
![](/img/cloudwatch/cloudwatch_add.png)
=======
# Cloudwatch
=======
# CloudWatch
>>>>>>> docs(cloudwatch): initial cloudwatch docs, closes #2900

Grafana ships with built in support for CloudWatch. You just have to add it as a data source and you will
be ready to build dashboards for you CloudWatch metrics.

## Adding the data source
<<<<<<< 05b941c75cf4422a6ede399871781a6ba63b7397
![](/img/v2/add_Graphite.jpg)
>>>>>>> docs(elasticsearch): initial elasticsearch docs, closes #2862
=======
![](/img/cloudwatch/cloudwatch_add.png)
>>>>>>> docs(cloudwatch): initial cloudwatch docs, closes #2900

1. Open the side menu by clicking the the Grafana icon in the top header.
2. In the side menu under the `Dashboards` link you should find a link named `Data Sources`.

    > NOTE: If this link is missing in the side menu it means that your current user does not have the `Admin` role for the current organization.

3. Click the `Add new` link in the top header.
<<<<<<< 05b941c75cf4422a6ede399871781a6ba63b7397
<<<<<<< 18ea8c9186f85496a3c30e579c3b2559d3b7c1b5
4. Select `CloudWatch` from the dropdown.
=======
4. Select `Elasticsearch` from the dropdown.
>>>>>>> docs(elasticsearch): initial elasticsearch docs, closes #2862
=======
4. Select `CloudWatch` from the dropdown.
>>>>>>> docs(cloudwatch): initial cloudwatch docs, closes #2900

Name | Description
------------ | -------------
Name | The data source name, important that this is the same as in Grafana v1.x if you plan to import old dashboards.
Default | Default data source means that it will be pre-selected for new panels.
<<<<<<< cae57a0f97b479d71508ff9837f3cf48a88886d4
<<<<<<< 05b941c75cf4422a6ede399871781a6ba63b7397
<<<<<<< 18ea8c9186f85496a3c30e579c3b2559d3b7c1b5
=======
>>>>>>> docs(cloudwatch): updated docs with info about #3080
Credentials profile name | Specify the name of the profile to use (if you use `~/aws/credentials` file), leave blank for default. This option was introduced in Grafana 2.5.1
Default Region | Used in query editor to set region (can be changed on per query basis)

## Authentication

### IAM Roles

Currently all access to CloudWatch is done server side by the Grafana backend using the official AWS SDK. If you grafana
server is running on AWS you can use IAM Roles and authentication will be handled automatically.

Checkout AWS docs on [IAM Roles]](http://docs.aws.amazon.com/AWSEC2/latest/UserGuide/iam-roles-for-amazon-ec2.html)

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
`dimension_values(region, namespace, metric)` | Returns a list of dimension values matching the specified `region`, `namespace` and `metric`.

For details about the metrics CloudWatch provides, please refer to the [CloudWatch documentation](https://docs.aws.amazon.com/AmazonCloudWatch/latest/DeveloperGuide/CW_Support_For_AWS.html).

If you want to filter dimension values by other dimension key/value pair, you can specify optional parameter like this.
```sql
dimension_values(region, namespace, metric, dim_key1=dim_val1,dim_key2=dim_val2,...)
```

![](/img/v2/cloudwatch_templating.png)

## Cost

It's worth to mention that Amazon will charge you for CloudWatch API usage. CloudWatch costs
$0.01 per 1,000 GetMetricStatistics or ListMetrics requests. For each query Grafana will
issue a GetMetricStatistics request and every time you pick a dimension in the query editor
Grafana will issue a ListMetrics request.

=======
Url | The http protocol, ip and port of you elasticsearch server.
Access | Proxy = access via Grafana backend, Direct = access directory from browser.
=======
Default-Region | Used in query editor to set region (can be changed on per query basis)
>>>>>>> docs(cloudwatch): initial cloudwatch docs, closes #2900

## Authentication

### IAM Roles

Currently all access to CloudWatch is done server side by the Grafana backend using the offical AWS SDK. If you grafana
server is running on AWS you can use IAM Roles and authentication will be handled automatically.

Checkout AWS docs on [IAM Roles]](http://docs.aws.amazon.com/AWSEC2/latest/UserGuide/iam-roles-for-amazon-ec2.html)

### AWS credentials file

Create a file at `~/.aws/credentials`. That is the `HOME` path for user running grafana-server.

Example content:

    [default]
    aws_access_key_id = asdsadasdasdasd
    aws_secret_access_key = dasdasdsadasdasdasdsa
    region = us-west-2


### Metric Query Editor

![](/img/cloudwatch/query_editor.png)

You need to specify a namespace, metric, at least one stat, and at least one dimension.


### Cost

It's worth to mention that Amazon will charge you for CloudWatch API usage. CloudWatch costs
$0.01 per 1,000 GetMetricStatistics or ListMetrics requests. For each query Grafana will
issue a GetMetricStatistics request and every time you pick a dimenion in the query editor
Grafana will issue a ListMetrics request.

<<<<<<< 05b941c75cf4422a6ede399871781a6ba63b7397
Direct access is still supported because in some cases it may be useful to access a Data Source directly depending on the use case and topology of Grafana, the user, and the Data Source.
>>>>>>> docs(elasticsearch): initial elasticsearch docs, closes #2862
=======
>>>>>>> docs(cloudwatch): initial cloudwatch docs, closes #2900

