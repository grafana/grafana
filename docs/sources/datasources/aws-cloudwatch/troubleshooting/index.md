---
aliases:
  - ../../data-sources/aws-cloudwatch/troubleshooting/
description: Troubleshooting guide for the Amazon CloudWatch data source in Grafana
keywords:
  - grafana
  - cloudwatch
  - aws
  - troubleshooting
  - errors
  - authentication
  - query
labels:
  products:
    - cloud
    - enterprise
    - oss
menuTitle: Troubleshooting
title: Troubleshoot Amazon CloudWatch data source issues
weight: 500
refs:
  configure-cloudwatch:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/datasources/aws-cloudwatch/configure/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana/<GRAFANA_VERSION>/datasources/aws-cloudwatch/configure/
  cloudwatch-aws-authentication:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/datasources/aws-cloudwatch/aws-authentication/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana/<GRAFANA_VERSION>/datasources/aws-cloudwatch/aws-authentication/
  cloudwatch-template-variables:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/datasources/aws-cloudwatch/template-variables/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana/<GRAFANA_VERSION>/datasources/aws-cloudwatch/template-variables/
  cloudwatch-query-editor:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/datasources/aws-cloudwatch/query-editor/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana/<GRAFANA_VERSION>/datasources/aws-cloudwatch/query-editor/
  private-data-source-connect:
    - pattern: /docs/grafana/
      destination: /docs/grafana-cloud/connect-externally-hosted/private-data-source-connect/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/connect-externally-hosted/private-data-source-connect/
---

# Troubleshoot Amazon CloudWatch data source issues

This document provides solutions to common issues you may encounter when configuring or using the Amazon CloudWatch data source. For configuration instructions, refer to [Configure CloudWatch](ref:configure-cloudwatch).

## Authentication errors

These errors occur when AWS credentials are invalid, missing, or don't have the required permissions.

### "Access Denied" or "Not authorized to perform this operation"

**Symptoms:**

- Save & test fails with "Access Denied"
- Queries return authorization errors
- Namespaces, metrics, or dimensions don't load

**Possible causes and solutions:**

| Cause                                   | Solution                                                                                                                                                                                                                                                                                                                                                              |
| --------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| IAM policy missing required permissions | Attach the appropriate IAM policy to your user or role. For metrics, you need `cloudwatch:ListMetrics`, `cloudwatch:GetMetricData`, and related permissions. For logs, you need `logs:DescribeLogGroups`, `logs:StartQuery`, `logs:GetQueryResults`, and related permissions. Refer to [Configure CloudWatch](ref:configure-cloudwatch) for complete policy examples. |
| Incorrect access key or secret key      | Verify the credentials in the AWS Console under **IAM** > **Users** > your user > **Security credentials**. Generate new credentials if necessary.                                                                                                                                                                                                                    |
| Credentials have expired                | For temporary credentials, generate new ones. For access keys, verify they haven't been deactivated or deleted.                                                                                                                                                                                                                                                       |
| Wrong AWS region                        | Verify the default region in the data source configuration matches where your resources are located.                                                                                                                                                                                                                                                                  |
| Assume Role ARN is incorrect            | Verify the role ARN format: `arn:aws:iam::<account-id>:role/<role-name>`. Check that the role exists in the AWS Console.                                                                                                                                                                                                                                              |

### "Unable to assume role"

**Symptoms:**

- Authentication fails when using Assume Role ARN
- Error message references STS or AssumeRole

**Solutions:**

1. Verify the trust relationship on the IAM role allows the Grafana credentials to assume it.
1. Check the trust policy includes the correct principal (the user or role running Grafana).
1. If using an external ID, ensure it matches exactly in both the role's trust policy and the Grafana data source configuration.
1. Verify the base credentials have the `sts:AssumeRole` permission.
1. Check that the role ARN is correct and the role exists.

**Example trust policy:**

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "AWS": "arn:aws:iam::<your-account-id>:user/<grafana-user>"
      },
      "Action": "sts:AssumeRole",
      "Condition": {
        "StringEquals": {
          "sts:ExternalId": "<your-external-id>"
        }
      }
    }
  ]
}
```

### AWS SDK Default authentication not working

**Symptoms:**

- Data source test fails when using AWS SDK Default
- Works locally but fails in production

**Solutions:**

1. Verify AWS credentials are configured in the environment where Grafana runs.
1. Check for credentials in the default locations:
   - Environment variables (`AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`)
   - Shared credentials file (`~/.aws/credentials`)
   - EC2 instance metadata (if running on EC2)
   - ECS task role (if running in ECS)
   - EKS service account (if running in EKS)
1. Ensure the Grafana process has permission to read the credentials file.
1. For EKS with IRSA, set the pod's security context to allow user 472 (grafana) to access the projected token. Refer to [AWS authentication](ref:cloudwatch-aws-authentication) for details.

### Credentials file not found

**Symptoms:**

- Error indicates credentials file cannot be read
- Authentication fails with "Credentials file" option

**Solutions:**

1. Create the credentials file at `~/.aws/credentials` for the user running the `grafana-server` service.
1. Verify the file has correct permissions (`0644`).
1. If the file exists but isn't working, move it to `/usr/share/grafana/` and set permissions to `0644`.
1. Ensure the profile name in the data source configuration matches a profile in the credentials file.

## Connection errors

These errors occur when Grafana cannot reach AWS CloudWatch endpoints.

### "Request timed out" or connection failures

**Symptoms:**

- Data source test times out
- Queries fail with timeout errors
- Intermittent connection issues

**Solutions:**

1. Verify network connectivity from the Grafana server to AWS endpoints.
1. Check firewall rules allow outbound HTTPS (port 443) to AWS services.
1. If using a VPC, ensure proper NAT gateway or VPC endpoint configuration.
1. For Grafana Cloud connecting to private resources, configure [Private data source connect](ref:private-data-source-connect).
1. Check if the default region is correct—incorrect regions may cause longer timeouts.
1. Increase the timeout settings if queries involve large data volumes.

### Custom endpoint configuration issues

**Symptoms:**

- Connection fails when using a custom endpoint
- Endpoint URL rejected

**Solutions:**

1. Verify the endpoint URL format is correct.
1. Ensure the endpoint is accessible from the Grafana server.
1. Check that the endpoint supports the required AWS APIs.
1. For VPC endpoints, verify the endpoint policy allows the required actions.

## CloudWatch Metrics query errors

These errors occur when querying CloudWatch Metrics.

### "No data" or empty results

**Symptoms:**

- Query executes without error but returns no data
- Charts show "No data" message

**Possible causes and solutions:**

| Cause                           | Solution                                                                                                   |
| ------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| Time range doesn't contain data | Expand the dashboard time range. CloudWatch metrics have different retention periods based on resolution.  |
| Wrong namespace or metric name  | Verify the namespace (for example, `AWS/EC2`) and metric name (for example, `CPUUtilization`) are correct. |
| Incorrect dimensions            | Ensure dimension names and values match your AWS resources exactly.                                        |
| Match Exact enabled incorrectly | When Match Exact is enabled, all dimensions must be specified. Try disabling it to see if metrics appear.  |
| Period too large                | Reduce the period setting or set it to "auto" to ensure data points are returned for your time range.      |
| Custom metrics not configured   | Add custom metric namespaces in the data source configuration under **Namespaces of Custom Metrics**.      |

### "Metric not found" or metrics don't appear in drop-down

**Symptoms:**

- Expected metrics don't appear in the query editor
- Metric drop-down is empty for a namespace

**Solutions:**

1. Verify the metric exists in the selected region.
1. For custom metrics, add the namespace to **Namespaces of Custom Metrics** in the data source configuration.
1. Check that the IAM policy includes `cloudwatch:ListMetrics` permission.
1. CloudWatch limits `ListMetrics` to 500 results per page—ensure the metric isn't being filtered out.
1. Use the Query Inspector to verify the API request and response.

### Dimension values not loading

**Symptoms:**

- Dimension value drop-down doesn't populate
- Wildcard searches return no results

**Solutions:**

1. Verify the IAM policy includes `cloudwatch:ListMetrics` permission.
1. Check that the namespace and metric are selected before dimension values can load.
1. For EC2 dimensions, ensure `ec2:DescribeTags` and `ec2:DescribeInstances` permissions are granted.
1. Dimension values require existing metrics—if no metrics match, no values appear.

### "Too many data points" or API throttling

**Symptoms:**

- Queries fail with throttling errors
- Performance degrades with multiple panels

**Solutions:**

1. Increase the period setting to reduce the number of data points.
1. Reduce the time range of your queries.
1. Use fewer dimensions or wildcard queries per panel.
1. Request a quota increase for `GetMetricData` requests per second in the [AWS Service Quotas console](https://console.aws.amazon.com/servicequotas/).
1. Enable query caching in Grafana to reduce API calls.

### Metric math expression errors

**Symptoms:**

- Expression returns errors
- Referenced metrics not found

**Solutions:**

1. Verify each referenced metric has a unique ID set.
1. Check that metric IDs start with a lowercase letter and contain only letters, numbers, and underscores.
1. Ensure all referenced metrics are in the same query.
1. Verify the expression syntax follows [AWS Metric Math](https://docs.aws.amazon.com/AmazonCloudWatch/latest/monitoring/using-metric-math.html) documentation.
1. Metric math expressions can't be used with Grafana alerting if they reference other query rows.

## CloudWatch Logs query errors

These errors occur when querying CloudWatch Logs.

### "Query failed" or logs don't appear

**Symptoms:**

- Log queries return errors
- No log data is displayed

**Solutions:**

1. Verify log group names are correct and exist in the selected region.
1. Check the IAM policy includes `logs:StartQuery`, `logs:GetQueryResults`, and `logs:DescribeLogGroups` permissions.
1. Ensure the time range contains log data.
1. Verify the query syntax is valid. For CloudWatch Logs Insights QL, test the query in the AWS Console.
1. Select the correct query language (Logs Insights QL, OpenSearch PPL, or OpenSearch SQL) based on your query syntax.

### Log query timeout

**Symptoms:**

- Query runs for a long time then fails
- Error mentions timeout

**Solutions:**

1. Increase the **Query timeout result** setting in the data source configuration (default is 30 minutes).
1. Narrow the time range to reduce the amount of data scanned.
1. Add filters to your query to limit results.
1. Break complex queries into smaller, more focused queries.
1. For alerting, the timeout defined in the Grafana configuration file takes precedence.

### Log groups not appearing in selector

**Symptoms:**

- Log group selector is empty
- Can't find expected log groups

**Solutions:**

1. Verify the IAM policy includes `logs:DescribeLogGroups` permission.
1. Check that log groups exist in the selected region.
1. For cross-account observability, ensure proper IAM permissions for `oam:ListSinks` and `oam:ListAttachedLinks`.
1. Use prefix search to filter log groups if you have many groups.
1. Verify the selected account (for cross-account) contains the expected log groups.

### OpenSearch SQL query errors

**Symptoms:**

- OpenSearch SQL queries fail
- Syntax errors with SQL queries

**Solutions:**

1. Specify the log group identifier or ARN in the `FROM` clause:

   ```sql
   SELECT * FROM `log_group_name` WHERE `@message` LIKE '%error%'
   ```

1. For multiple log groups, use the `logGroups` function:

   ```sql
   SELECT * FROM `logGroups(logGroupIdentifier: ['LogGroup1', 'LogGroup2'])`
   ```

1. Amazon CloudWatch supports only a subset of OpenSearch SQL commands. Refer to the [CloudWatch Logs documentation](https://docs.aws.amazon.com/AmazonCloudWatch/latest/logs/CWL_AnalyzeLogData_Languages.html) for supported syntax.

## Template variable errors

These errors occur when using template variables with the CloudWatch data source.

### Variables return no values

**Symptoms:**

- Variable drop-down is empty
- Dashboard fails to load with variable errors

**Solutions:**

1. Verify the data source connection is working.
1. Check that the IAM policy includes permissions for the variable query type:
   - **Regions:** No additional permissions needed.
   - **Namespaces:** No additional permissions needed.
   - **Metrics:** Requires `cloudwatch:ListMetrics`.
   - **Dimension Values:** Requires `cloudwatch:ListMetrics`.
   - **EC2 Instance Attributes:** Requires `ec2:DescribeInstances`.
   - **EBS Volume IDs:** Requires `ec2:DescribeVolumes`.
   - **Resource ARNs:** Requires `tag:GetResources`.
   - **Log Groups:** Requires `logs:DescribeLogGroups`.
1. For dependent variables, ensure parent variables have valid selections.
1. Verify the region is set correctly (use "default" for the data source's default region).

For more information on template variables, refer to [CloudWatch template variables](ref:cloudwatch-template-variables).

### Multi-value template variables cause query failures

**Symptoms:**

- Queries fail when selecting multiple dimension values
- Error about search expression limits

**Solutions:**

1. Search expressions are limited to 1,024 characters. Reduce the number of selected values.
1. Use the asterisk (`*`) wildcard instead of selecting "All" to query all metrics for a dimension.
1. Multi-valued template variables are only supported for dimension values—not for Region, Namespace, or Metric Name.

## Cross-account observability errors

These errors occur when using CloudWatch cross-account observability features.

### Cross-account queries fail

**Symptoms:**

- Can't query metrics or logs from linked accounts
- Monitoring account badge doesn't appear

**Solutions:**

1. Verify cross-account observability is configured in the AWS CloudWatch console.
1. Add the required IAM permissions:

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

1. Check that the monitoring account and source accounts are properly linked in AWS.
1. Cross-account observability works within a single region—verify all accounts are in the same region.
1. EC2 Instance Attributes can't be queried across accounts because they use the EC2 API, not the CloudWatch API.

## Quota and pricing issues

These issues relate to AWS service quotas and cost management.

### API throttling errors

**Symptoms:**

- "Rate exceeded" errors
- Dashboard panels intermittently fail to load

**Solutions:**

1. Reduce the frequency of dashboard refreshes.
1. Increase the period setting to reduce `GetMetricData` requests.
1. Enable query caching in Grafana (available in Grafana Enterprise and Grafana Cloud).
1. Request a quota increase in the [AWS Service Quotas console](https://console.aws.amazon.com/servicequotas/).
1. Consider consolidating similar queries using metric math.

### Unexpectedly high CloudWatch costs

**Symptoms:**

- AWS CloudWatch costs are higher than expected
- Frequent API calls from Grafana

**Solutions:**

1. The `GetMetricData` API doesn't qualify for the CloudWatch API free tier.
1. Reduce dashboard auto-refresh frequency.
1. Increase the period setting to reduce data points returned.
1. Use query caching to reduce repeated API calls.
1. Review variable query settings—set variable refresh to "On dashboard load" instead of "On time range change."
1. Avoid using wildcards in dimensions when possible, as they generate search expressions with multiple API calls.

## Other common issues

These issues don't produce specific error messages but are commonly encountered.

### Custom metrics don't appear

**Symptoms:**

- Custom metrics from applications or agents don't show in the namespace drop-down
- Only standard AWS namespaces are visible

**Solutions:**

1. Add your custom metric namespace to the **Namespaces of Custom Metrics** field in the data source configuration.
1. Separate multiple namespaces with commas (for example, `CWAgent,CustomNamespace`).
1. Verify custom metrics have been published to CloudWatch in the selected region.

### Pre-configured dashboards not working

**Symptoms:**

- Imported dashboards show no data
- Dashboard variables don't load

**Solutions:**

1. Verify the data source name in the dashboard matches your CloudWatch data source.
1. Check that the dashboard's AWS region setting matches where your resources are located.
1. Ensure the IAM policy grants access to the required services (EC2, Lambda, RDS, etc.).
1. Verify resources exist and are emitting metrics in the selected region.

### X-Ray trace links not appearing

**Symptoms:**

- Log entries don't show X-Ray trace links
- `@xrayTraceId` field not appearing

**Solutions:**

1. Verify an X-Ray data source is configured and linked in the CloudWatch data source settings.
1. Ensure your logs contain the `@xrayTraceId` field.
1. Update log queries to include `@xrayTraceId` in the fields, for example: `fields @message, @xrayTraceId`.
1. Configure your application to log X-Ray trace IDs. Refer to the [AWS X-Ray documentation](https://docs.aws.amazon.com/xray/latest/devguide/xray-services.html).

## Enable debug logging

To capture detailed error information for troubleshooting:

1. Set the Grafana log level to `debug` in the configuration file:

   ```ini
   [log]
   level = debug
   ```

1. Review logs in `/var/log/grafana/grafana.log` (or your configured log location).
1. Look for CloudWatch-specific entries that include request and response details.
1. Reset the log level to `info` after troubleshooting to avoid excessive log volume.

## Get additional help

If you've tried the solutions above and still encounter issues:

1. Check the [Grafana community forums](https://community.grafana.com/) for similar issues.
1. Review the [CloudWatch plugin GitHub issues](https://github.com/grafana/grafana/issues) for known bugs.
1. Consult the [AWS CloudWatch documentation](https://docs.aws.amazon.com/cloudwatch/) for service-specific guidance.
1. Contact Grafana Support if you're an Enterprise, Cloud Pro, or Cloud Contracted user.
1. When reporting issues, include:
   - Grafana version
   - AWS region
   - Error messages (redact sensitive information)
   - Steps to reproduce
   - Query configuration (redact credentials and account IDs)
