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
menuTitle: AWS authentication
title: Configure AWS authentication
weight: 200
---

# Configure AWS authentication

A Grafana plugin's requests to AWS are made on behalf of an AWS Identity and Access Management (IAM) role or IAM user.
The IAM user or IAM role must have the associated policies to perform certain API actions.
Since these policies are specific to each data source, refer to the data source documentation for details.

All requests to AWS APIs are performed on the server side by the Grafana backend using the official AWS SDK.

This topic has the following sections:

- [Select an authentication method]({{< relref "#select-an-authentication-method" >}})
- [Assume a role]({{< relref "#assume-a-role" >}})
- [Use a custom endpoint]({{< relref "#use-a-custom-endpoint" >}})
- [Use an AWS credentials file]({{< relref "#use-an-aws-credentials-file" >}})
- [Use EKS IAM roles for service accounts]({{< relref "#use-eks-iam-roles-for-service-accounts" >}})

## Select an authentication method

You can use one of the following authentication methods.
Open source Grafana enables the `AWS SDK Default`, `Credentials file`, and `Access and secret key` methods by default.

- `AWS SDK Default` performs no custom configuration and instead uses the [default provider](https://docs.aws.amazon.com/sdk-for-go/v1/developer-guide/configuring-sdk.html) as specified by the AWS SDK for Go.
  It requires you to configure your AWS credentials separately, such as if you've [configured the CLI](https://docs.aws.amazon.com/cli/latest/userguide/cli-configure-files.html), if you're [running on an EC2 instance](https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/iam-roles-for-amazon-ec2.html), [in an ECS task](https://docs.aws.amazon.com/AmazonECS/latest/developerguide/task-iam-roles.html), or for a [Service Account in a Kubernetes cluster](https://docs.aws.amazon.com/eks/latest/userguide/iam-roles-for-service-accounts.html).
- `Credentials file` corresponds directly to the [SharedCredentialsProvider](https://docs.aws.amazon.com/sdk-for-go/api/aws/credentials/#SharedCredentialsProvider) provider in the Go SDK.
  It reads the AWS shared credentials file to find a given profile.
  While `AWS SDK Default` will also find the shared credentials file, this option allows you to specify which profile to use without using environment variables.
  This option doesn't have any implicit fallbacks to other credential providers, and it fails if the credentials provided from the file aren't correct.
- `Access and secret key` corresponds to the [StaticProvider](https://docs.aws.amazon.com/sdk-for-go/api/aws/credentials/#StaticProvider) and uses the given access key ID and secret key to authenticate.
  This method doesn't have any fallbacks, and will fail if the provided key pair doesn't work.
- `Workspace IAM role` corresponds to the [EC2RoleProvider](https://docs.aws.amazon.com/sdk-for-go/api/aws/credentials/ec2rolecreds/#EC2RoleProvider).
  The EC2RoleProvider pulls credentials for a role attached to the EC2 instance that Grafana runs on.
  You can also achieve this by using the authentication method AWS SDK Default, but this option is different as it doesn't have any fallbacks.
  This option is enabled by default only in Amazon Managed Grafana.

If necessary, you can enable or disable them if you have server configuration access.
For more information, refer to the [`allowed_auth_providers` documentation]({{< relref "../../../setup-grafana/configure-grafana#allowed_auth_providers" >}}).

## Assume a role

You can specify which IAM role to assume in the **Assume Role ARN** field.

If this field is left blank, Grafana uses the provided credentials directly, and the associated role or user should have the required permissions.

If this field isn't blank, Grafana uses the provided credentials to perform an [sts:AssumeRole](https://docs.aws.amazon.com/STS/latest/APIReference/API_AssumeRole.html) call.

To disable this feature, refer to the [`assume_role_enabled` documentation]({{< relref "../../../setup-grafana/configure-grafana#assume_role_enabled" >}}).

### Use an external ID

To assume a role in another account that was created with an external ID, specify the external ID in the **External ID** field.

For more information, refer to the [AWS documentation on external ID](https://docs.aws.amazon.com/IAM/latest/UserGuide/id_roles_create_for-user_externalid.html).

## Use a custom endpoint

You can specify a custom endpoint URL in the **Endpoint** field, which overrides the default generated endpoint for the AWS service API.
Leave this field blank to use the default generated endpoint.

For more information on why and how to use service endpoints, refer to the [AWS service endpoints documentation](https://docs.aws.amazon.com/general/latest/gr/rande.html).

## Use an AWS credentials file

Create a file at `~/.aws/credentials`, the `HOME` path for the user running the `grafana-server` service.

{{% admonition type="note" %}}
If you think you have the credentials file in the right location, but it's not working, try moving your `.aws` file to `/usr/share/grafana/` and grant your credentials file at most 0644 permissions.
{{% /admonition %}}

### Credentials file example

```bash
[default]
aws_access_key_id = asdsadasdasdasd
aws_secret_access_key = dasdasdsadasdasdasdsa
region = us-west-2
```

## Use EKS IAM roles for service accounts

The Grafana process in the container runs as user 472 (called "grafana").
When Kubernetes mounts your projected credentials, they're available by default to only the root user.

To grant user 472 permission to access the credentials, and avoid falling back to the IAM role attached to the EC2 instance, you must provide a [security context](https://kubernetes.io/docs/tasks/configure-pod-container/security-context/) for your pod.

### Security context example

```yaml
securityContext:
  fsGroup: 472
  runAsUser: 472
  runAsGroup: 472
```
