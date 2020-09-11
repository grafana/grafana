+++
title = "AWS X-Ray"
description = "Guide for using X-Ray in Grafana"
keywords = ["grafana", "x-ray", "guide"]
type = "docs"
aliases = ["/docs/grafana/latest/datasources/x-ray"]
[menu.docs]
name = "AWS X-Ray"
identifier = "x-ray"
parent = "datasources"
weight = 5
+++

# Using AWS X-Ray in Grafana

Grafana ships with built-in support for X-Ray. Add it as a data source, then you are ready to
build dashboards or use Explore with X-Ray to look at traces.

## Adding the data source

1. In the side menu under the `Configuration` link, click on `Data Sources`.
2. Click the `Add data source` button.
3. Select `X-Ray` in the `Distributed tracing` section.

> NOTE: If at any moment you have issues with getting this data source to work and Grafana is giving you undescriptive errors then don't
> forget to check your log file (try looking in /var/log/grafana/grafana.log).

| Name                       | Description                                                                                                              |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| _Name_                     | The data source name. This is how you refer to the data source in panels and queries.                                    |
| _Default_                  | Default data source means that it will be pre-selected for new panels.                                                   |
| _Default Region_           | Used in query editor to set region (can be changed on per query basis)                                                   |                                                                    
| _Auth Provider_            | Specify the provider to get credentials.                                                                                 |
| _Credentials_ profile name | Specify the name of the profile to use (if you use `~/.aws/credentials` file), leave blank for default.                  |
| _Assume Role Arn_          | Specify the ARN of the role to assume                                                                                    |
| _External ID_              | If you are assuming a role in another account, that has been created with an external ID, specify the external ID here. |

## Authentication

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
aws_access_key_id = <your access key>
aws_secret_access_key = <your access key>
region = us-west-2
```

## The Query Editor 

The most important field in the editor is the query type. There are 4 query types Trace List(Traces in AWS), Trace Statistics, Trace Analytics(Analytics in AWS), Insights.

{{< docs-imagebox img="/img/docs/v72/x-ray-query-editor.png" max-width="800px" class="docs-image--left" caption="X-Ray query editor" >}}

### Trace List

The trace list is pretty much the same as in AWS. Clicking on the trace id in the first column opens the trace on the right side. Notice the query field in the editor which works the same as in AWS. You can write queries, filter expressions or a trace id there.

{{< docs-imagebox img="/img/docs/v72/x-ray-trace-list.png" caption="X-Ray trace list in Grafana" >}}

### Trace Statistics

In trace statistics you can see a graph and a table showing information about error, fault, throttle, success and total count. You can use the columns field in the query editor to only see specified columns.

{{< docs-imagebox img="/img/docs/v72/x-ray-trace-statistics.png" caption="X-Ray trace statistics in Grafana" >}}

### Trace Analytics

In trace analytics you can visualize one of the tables from Analytics in AWS.

### Insights

In insights you can see the summary table for insights just like in AWS. Clicking the InsightId will take you to AWS console.

### Alerting

Since X-Ray queries can return numeric data, alerts are supported. See the [Alerting]({{< relref "../../alerting/alerts-overview.md" >}}) documentation for more on Grafana alerts.

## Pricing

> With AWS X-Ray, there are no upfront fees or commitments. You pay only for what you use, based on the number of traces recorded, retrieved, and scanned. The first 1,000,000 traces retrieved or scanned each month are free. Beyond the free tier, traces scanned cost $0.50 per 1 million traces scanned ($0.0000005 per trace).
Please see the [X-Ray pricing page](https://aws.amazon.com/xray/pricing/) for more details.

## Configure the data source with provisioning

It's now possible to configure data sources using config files with Grafana's provisioning system. You can read more about how it works and all the settings you can set for data sources on the [provisioning docs page]({{< relref "../../administration/provisioning/#datasources" >}})

Here are some provisioning examples for this data source.

### Using a credentials file

```yaml
apiVersion: 1

datasources:
  - name: X-Ray
    type: datasource
    jsonData:
      authType: credentials
      defaultRegion: eu-west-2
```

### Using `accessKey` and `secretKey`

```yaml
apiVersion: 1

datasources:
  - name: X-Ray
    type: datasource
    jsonData:
      authType: keys
      defaultRegion: eu-west-2
    secureJsonData:
      accessKey: '<your access key>'
      secretKey: '<your secret key>'
```
