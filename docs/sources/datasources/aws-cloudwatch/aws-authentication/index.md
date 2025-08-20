---
aliases:
  - ../../data-sources/aws-cloudwatch/aws-authentication/
  - ../../data-sources/elasticsearch/aws-authentication/
  - ../cloudwatch/
description: Guide to configuring AWS authentication in Grafana
keywords:
  - grafana
  - aws
  - authentication
labels:
  products:
    - cloud
    - enterprise
    - oss
menuTitle: AWS authentication
title: Configure AWS authentication
weight: 400
refs:
  configure-grafana-assume-role-enabled:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/setup-grafana/configure-grafana/#assume_role_enabled
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana/<GRAFANA_VERSION>/setup-grafana/configure-grafana/#assume_role_enabled
  configure-grafana-allowed-auth-providers:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/setup-grafana/configure-grafana/#allowed_auth_providers
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana/<GRAFANA_VERSION>/setup-grafana/configure-grafana/#allowed_auth_providers
---

# Configure AWS authentication

Grafana data source plugins make requests to AWS on behalf of an AWS Identity and Access Management (IAM) [role](https://docs.aws.amazon.com/IAM/latest/UserGuide/id_roles.html) or IAM [user](https://docs.aws.amazon.com/IAM/latest/UserGuide/id_users.html).
The IAM user or IAM role must have the associated policies to perform certain API actions for querying data source data.
Since these policies are specific to each data source, refer to individual data source plugin documentation for details.

The Grafana backend performs all AWS API requests server-side using the official [AWS SDK](https://github.com/aws/aws-sdk-go).

This document explores the following topics:

- [Select an authentication method](#select-an-authentication-method)
- [Assume a role](#assume-a-role)
- [Use a custom endpoint](#use-a-custom-endpoint)
- [Use an AWS credentials file](#use-an-aws-credentials-file)
- [Use EKS IAM roles for service accounts](#use-eks-iam-roles-for-service-accounts)

## Select an authentication method

Available authentication methods depend on your configuration and the environment where Grafana runs.

Open source Grafana enables the `AWS SDK Default`, `Credentials file`, and `Access and secret key` methods by default. Cloud Grafana enables only `Access and secret key` by default. Users with server configuration access can enable or disable specific auth providers as needed. For more information, refer to the [`allowed_auth_providers` documentation](ref:configure-grafana-allowed-auth-providers).

- `AWS SDK Default` uses the [default provider](https://docs.aws.amazon.com/sdk-for-go/v1/developer-guide/configuring-sdk.html) from the [AWS SDK for Go](https://github.com/aws/aws-sdk-go) without custom configuration.
  This method requires configuring AWS credentials outside Grafana through [the CLI](https://docs.aws.amazon.com/cli/latest/userguide/cli-configure-files.html), or by [attaching credentials directly to an EC2 instance](https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/iam-roles-for-amazon-ec2.html), [in an ECS task](https://docs.aws.amazon.com/AmazonECS/latest/developerguide/task-iam-roles.html), or for a [Service Account in a Kubernetes cluster](https://docs.aws.amazon.com/eks/latest/userguide/iam-roles-for-service-accounts.html). You can attach permissions directly to the data source with AWS SDK Default or combine it with the optional [`Assume Role ARN`](#assume-a-role) field.
- `Credentials file` maps to the [SharedCredentialsProvider](https://docs.aws.amazon.com/sdk-for-go/api/aws/credentials/#SharedCredentialsProvider) provider in the [AWS SDK for Go](https://github.com/aws/aws-sdk-go).
  This method reads the AWS shared credentials file for a specified profile.
  Unlike `AWS SDK Default` which also reads the shared credentials file, this option lets you specify a profile directly without environment variables.
  This option provides no fallback to other credential providers and fails if the file credentials are invalid.
- `Access and secret key` corresponds to the [StaticProvider](https://docs.aws.amazon.com/sdk-for-go/api/aws/credentials/#StaticProvider) and authenticates using a specified access key ID and secret key pair.
  This method doesn't provide fallback authentication and fails if the key pair is invalid. Grafana Cloud uses this as the primary authentication method.
- `Grafana Assume Role` - With this authentication method, Grafana Cloud users create an AWS IAM role that has a trust relationship with Grafana's AWS account. Grafana uses [STS](https://docs.aws.amazon.com/STS/latest/APIReference/welcome.html) to generate temporary credentials on its behalf. This method eliminates the need to generate secret and access keys for users Refer to [Use Grafana Assume Role](/docs/grafana/latest/datasources/aws-cloudwatch/aws-authentication/#use-grafana-assume-role) for more information.
- `Workspace IAM role` corresponds to the [EC2RoleProvider](https://docs.aws.amazon.com/sdk-for-go/api/aws/credentials/ec2rolecreds/#EC2RoleProvider).
  The EC2RoleProvider retrieves credentials from a role attached to the EC2 instance running Grafana.
  While AWS SDK Default can achieve similar results, this option provides no fallback authentication. Amazon Managed Grafana enables this option by default.

## Assume a role

{{< admonition type="note" >}}
The Grafana Assume Role authentication method requires you to enter an **Assume Role ARN**. Other authentication methods can leave this field empty.
{{< /admonition >}}

Specify an IAM role to assume in the **Assume Role ARN** field.

When you configure **Assume Role ARN**, Grafana uses the provided credentials to perform an [sts:AssumeRole](https://docs.aws.amazon.com/STS/latest/APIReference/API_AssumeRole.html) call.  The primary authentication method only needs permission to assume the role, while the assumed role requires CloudWatch access permissions.

For example, you might use one set of long-term credentials across all AWS data sources but want to limit each data source's AWS access (such as separating staging and production data access). You could create separate credentials for each data source with distinct permissions, but this approach requires managing and rotating multiple secret and access keys across many data source instances.

Instead, assume role functionality lets you use one set of AWS credentials across all AWS data sources with a single permission: the ability to assume roles through STS. You then create separate IAM roles for each data source that specify temporary permissions. Since IAM roles are not credentials, they require no rotation and simplify management.

If the **Assume Role ARN** field is left empty, Grafana uses the provided credentials from the selected authentication method directly, and permissions to AWS data must be attached directly to those credentials. The **Assume Role ARN** field is optional for all authentication methods except for Grafana Assume Role.

To disable this feature in open source Grafana or Grafana Enterprise, refer to [`assume_role_enabled`](ref:configure-grafana-assume-role-enabled).

### Use an external ID

{{< admonition type="note" >}}
You cannot use an external ID for the Grafana Assume Role authentication provider.
{{< /admonition >}}

To assume a role in another account created with an external ID, specify the external ID in the **External ID** field.

For more information, refer to the [AWS documentation on external ID](https://docs.aws.amazon.com/IAM/latest/UserGuide/id_roles_create_for-user_externalid.html).

When you select Grafana Assume Role as the authentication method, Grafana provides and manages the external ID. This ID appears on the data source configuration page and is unique to your account. When creating an IAM role for `Grafana Assume Role`, you must set a condition that allows the Grafana AWS account to assume your IAM role only when it provides the specific external ID:

```
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Effect": "Allow",
            "Principal": {
                "AWS": {Grafana's AWS Account}
            },
            "Action": "sts:AssumeRole",
            "Condition": {
                "StringEquals": {
                    "sts:ExternalId": {External ID unique to your account}
                }
            }
        }
    ]
}
```

## Use a custom endpoint

Use the **Endpoint** field to specify a custom endpoint URL that overrides the default AWS service API endpoint. Leave this field blank to use the default generated endpoint.

For more information about using service endpoints, refer to the [AWS service endpoints documentation](https://docs.aws.amazon.com/general/latest/gr/rande.html).

## Use an AWS credentials file

Create a file at `~/.aws/credentials`, the `HOME` path for the user running the `grafana-server` service.

{{< admonition type="note" >}}
If the credentials file appears to be in the correct location but isn't working, move your `aws` file to `/usr/share/grafana/` and set the credentials file permissions to `0644`.
{{< /admonition >}}

**Credentials file example:**

```bash
[default]
aws_access_key_id = asdsadasdasdasd
aws_secret_access_key = dasdasdsadasdasdasdsa
region = us-west-2
```

## Use EKS IAM roles for service accounts

EKS IAM roles for service accounts (IRSA) are an AWS EKS feature that allows pods to assume IAM roles without storing long-term credentials. When you configure IRSA in your EKS cluster, AWS injects temporary credentials into your pod as projected volume mounts.

In Grafana containers, the process runs as user `472` ("grafana").
By default, Kubernetes mounts the projected credentials with permissions for the root user only.

To grant user `472` permission to access the credentials, and prevent fallback to the IAM role attached to the EC2 instance, set a [security context](https://kubernetes.io/docs/tasks/configure-pod-container/security-context/) for your pod.

**Security context example:**

```yaml
securityContext:
  fsGroup: 472
  runAsUser: 472
  runAsGroup: 472
```

## Use Grafana Assume Role

{{< admonition type="note" >}}
Grafana Assume Role is only available in Grafana Cloud.

It's currently only available for Amazon CloudWatch and Athena.
{{< /admonition >}}

The Grafana Assume Role authentication provider lets you access AWS without creating or managing long-term AWS IAM users or rotating access keys. Instead, you can create an IAM role that has permissions to access CloudWatch and trusts a Grafana AWS account.

The Grafana AWS account then makes a Security Token Service (STS) request to generate temporary credentials for your AWS data. This request includes an `externalID` unique to your Grafana Cloud account, which ensures users can access only their own AWS resources.

For more information, refer to the [AWS documentation on external ID](https://docs.aws.amazon.com/IAM/latest/UserGuide/id_roles_create_for-user_externalid.html)

To use the Grafana Assume Role:

1. Create a new CloudWatch data source (or update an existing one) and select **Grafana Assume Role** as an authentication provider.
2. In the AWS Console, create a new IAM role, and under **Trusted entity type**, select **Another AWS account** as the trusted Entity.
3. Enter the Grafana account id (displayed in the instructions box on the **Settings** tab of the CloudWatch data source configuration) and check the **Require external ID** box.
4. Enter the external ID specified in the instructions box on the **Settings** tab of the CloudWatch data source configuration in Grafana. This external ID will be unique to your Grafana instance.
5. Attach any required permissions you would like Grafana to be able to access on your behalf (for example, CloudWatch Logs and CloudWatch Metrics policies).
6. Give the role a name and description, and click **Create role**.
7. Copy the ARN of the role you just created and paste it into the **Assume Role ARN** field on the **Settings** tab of CloudWatch data source configuration in Grafana.

**Sample Trust Relationship for an IAM role:**

```
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Effect": "Allow",
            "Principal": {
                "AWS": {Grafana's AWS Account}
            },
            "Action": "sts:AssumeRole",
            "Condition": {
                "StringEquals": {
                    "sts:ExternalId": {External ID unique to your account}
                }
            }
        }
    ]
}
```

## CloudWatch Logs data protection

CloudWatch Logs can protect data by applying log group data protection policies. When data protection is enabled for a log group, any sensitive data that matches the identifiers you select is automatically masked. To view masked data, your IAM role or user must have the `logs:Unmask` permission. For more details, refer to [the AWS guide](https://docs.aws.amazon.com/AmazonCloudWatch/latest/logs/mask-sensitive-log-data.html) on masking sensitive log data. 
