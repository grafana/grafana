+++
title = "Authentication"
description = "AWS authentication"
keywords = ["grafana", "aws", "authentication"]
aliases = ["/docs/grafana/latest/datasources/cloudwatch"]
weight = 205
+++

# AWS Authentication

There are three different authentication methods available. 

`AWS SDK Default` performs no custom configuration at all and instead uses the [default provider](https://docs.aws.amazon.com/sdk-for-go/v1/developer-guide/configuring-sdk.html) as specified by the AWS SDK for Go. This requires you to configure your AWS credentials separately, such as if you've [configured the CLI](https://docs.aws.amazon.com/cli/latest/userguide/cli-configure-files.html), if you're [running on an EC2 instance](https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/iam-roles-for-amazon-ec2.html), [in an ECS task](https://docs.aws.amazon.com/AmazonECS/latest/developerguide/task-iam-roles.html) or for a [Service Account in a Kubernetes cluster](https://docs.aws.amazon.com/eks/latest/userguide/iam-roles-for-service-accounts.html).

`Credentials file` corresponds directly to the [SharedCredentialsProvider](https://docs.aws.amazon.com/sdk-for-go/api/aws/credentials/#SharedCredentialsProvider) provider in the Go SDK. In short, it will read the AWS shared credentials file and find the given profile. While `AWS SDK Default` will also find the shared credentials file, this option allows you to specify which profile to use without using environment variables. It doesn't have any implicit fallbacks to other credential providers, and will fail if using credentials from the credentials file doesn't work.

`Access & secret key` corresponds to the [StaticProvider](https://docs.aws.amazon.com/sdk-for-go/api/aws/credentials/#StaticProvider) and uses the given access key ID and secret key to authenticate. This method doesn't have any fallbacks, and will fail if the provided key pair doesn't work.

## IAM roles

Currently all access to CloudWatch is done server side by the Grafana backend using the official AWS SDK. Providing you have chosen the _AWS SDK Default_ authentication method, and your Grafana server is running on AWS, you can use IAM Roles to handle authentication automatically.

See the AWS documentation on [IAM Roles](http://docs.aws.amazon.com/AWSEC2/latest/UserGuide/iam-roles-for-amazon-ec2.html)

## IAM policies

Grafana needs permissions granted via IAM to be able to read CloudWatch metrics
and EC2 tags/instances/regions. You can attach these permissions to IAM roles and
utilize Grafana's built-in support for assuming roles.

Here is a minimal policy example:

```json
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

## Assuming a role

The `Assume Role ARN` field allows you to specify which IAM role to assume, if any. When left blank, the provided credentials are used directly and the associated role or user should have the required permissions. If this field is non-blank, on the other hand, the provided credentials are used to perform an [sts:AssumeRole](https://docs.aws.amazon.com/STS/latest/APIReference/API_AssumeRole.html) call.

## Endpoint

The `Endpoint` field allows you to specify a custom endpoint URL that overrides the default generated endpoint for the CloudWatch API. Leave this field blank if you want to use the default generated endpoint. For more information on why and how to use Service endpoints, refer to the [AWS service endpoints documentation](https://docs.aws.amazon.com/general/latest/gr/rande.html).

## EKS IAM roles for service accounts

The Grafana process in the container runs as user 472 (called "grafana"). When Kubernetes mounts your projected credentials, they will by default only be available to the root user. In order to allow user 472 to access the credentials (and avoid it falling back to the IAM role attached to the EC2 instance), you will need to provide a [security context](https://kubernetes.io/docs/tasks/configure-pod-container/security-context/) for your pod.

```yaml
securityContext:
  fsGroup: 472
  runAsUser: 472
  runAsGroup: 472
```

## AWS credentials file

Create a file at `~/.aws/credentials`. That is the `HOME` path for user running grafana-server.

> **Note:** If you think you have the credentials file in the right place and it is still not working, you might try moving your .aws file to '/usr/share/grafana/' and make sure your credentials file has at most 0644 permissions.

Example content:

```bash
[default]
aws_access_key_id = asdsadasdasdasd
aws_secret_access_key = dasdasdsadasdasdasdsa
region = us-west-2
```
