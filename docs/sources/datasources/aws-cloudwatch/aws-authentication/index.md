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
weight: 200
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

A Grafana data source plugin's requests to AWS are made on behalf of an AWS Identity and Access Management (IAM) [role](https://docs.aws.amazon.com/IAM/latest/UserGuide/id_roles.html) or IAM [user](https://docs.aws.amazon.com/IAM/latest/UserGuide/id_users.html).
The IAM user or IAM role must have the associated policies to perform certain API actions to query the data in the data source.
Since these policies are specific to each data source, refer to each data source plugin's documentation for details.

All requests to AWS APIs are performed on the server side by the Grafana backend using the official [AWS SDK](https://github.com/aws/aws-sdk-go).

This topic has the following sections:

- [Select an authentication method](#select-an-authentication-method)
- [Assume a role](#assume-a-role)
- [Use a custom endpoint](#use-a-custom-endpoint)
- [Use an AWS credentials file](#use-an-aws-credentials-file)
- [Use EKS IAM roles for service accounts](#use-eks-iam-roles-for-service-accounts)

## Select an authentication method

Depending on your configuration and the environment your instance of Grafana is running in, you'll have different authentication methods to select from.

Open source Grafana enables the `AWS SDK Default`, `Credentials file`, and `Access and secret key` methods by default. Cloud Grafana enables `Access and secret key` by default. If necessary, you can enable or disable particular auth providers if you have server configuration access. For more information, refer to the [`allowed_auth_providers` documentation](ref:configure-grafana-allowed-auth-providers).

- `AWS SDK Default` performs no custom configuration and instead uses the [default provider](https://docs.aws.amazon.com/sdk-for-go/v1/developer-guide/configuring-sdk.html) as specified by the [AWS SDK for Go](https://github.com/aws/aws-sdk-go).
  It requires you to configure your AWS credentials outside of grafana, such as with [the CLI](https://docs.aws.amazon.com/cli/latest/userguide/cli-configure-files.html), or by [attaching credentials directly to an EC2 instance](https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/iam-roles-for-amazon-ec2.html), [in an ECS task](https://docs.aws.amazon.com/AmazonECS/latest/developerguide/task-iam-roles.html), or for a [Service Account in a Kubernetes cluster](https://docs.aws.amazon.com/eks/latest/userguide/iam-roles-for-service-accounts.html). With `AWS SDK Default` you can attach permissions directly to the data source or you can use it combination with the optional [`Assume Role ARN`](#assume-a-role) field.
- `Credentials file` corresponds directly to the [SharedCredentialsProvider](https://docs.aws.amazon.com/sdk-for-go/api/aws/credentials/#SharedCredentialsProvider) provider in the [AWS SDK for Go](https://github.com/aws/aws-sdk-go).
  It reads the AWS shared credentials file to find a given profile.
  While `AWS SDK Default` will also find the shared credentials file, this option allows you to specify which profile to use without using environment variables.
  This option doesn't have any implicit fallbacks to other credential providers, and it fails if the credentials provided from the file aren't correct.
- `Access and secret key` corresponds to the [StaticProvider](https://docs.aws.amazon.com/sdk-for-go/api/aws/credentials/#StaticProvider) and uses the given access key ID and secret key to authenticate.
  This method doesn't have any fallbacks, and will fail if the provided key pair doesn't work. This is the primary authentication method for Grafana Cloud.
- `Grafana Assume Role` - With this auth provider option, Grafana Cloud users create an AWS IAM role that has a trust relationship with Grafana's AWS account. Grafana then uses [STS](https://docs.aws.amazon.com/STS/latest/APIReference/welcome.html) to generate temporary credentials on its behalf. Users with this option enabled no longer need to generate secret and access keys for users. Refer to [Use Grafana Assume Role](/docs/grafana/latest/datasources/aws-cloudwatch/aws-authentication/#use-grafana-assume-role) for further detail.
- `Workspace IAM role` corresponds to the [EC2RoleProvider](https://docs.aws.amazon.com/sdk-for-go/api/aws/credentials/ec2rolecreds/#EC2RoleProvider).
  The EC2RoleProvider pulls credentials for a role attached to the EC2 instance that Grafana runs on.
  You can also achieve this by using the authentication method AWS SDK Default, but this option is different as it doesn't have any fallbacks.
  This option is enabled by default only in Amazon Managed Grafana.

## Assume a role

{{% admonition type="note" %}}
Assume a role is required for the Grafana Assume Role.
{{% /admonition %}}

You can specify an IAM role to assume in the **Assume Role ARN** field.

When this field is filled in, Grafana uses the provided credentials to perform an [sts:AssumeRole](https://docs.aws.amazon.com/STS/latest/APIReference/API_AssumeRole.html) call. In this scenario, the primary authentication method does not need permission to access CloudWatch directly; it just needs the ability to assume a role, while the role it assumes should have permission to access CloudWatch.

For example, you may have one set of long term credentials for all of your AWS data sources. However, you want to limit the access each data source has to AWS (maybe one accesses staging data and another production data, for example). You could create separate credentials for each data source, each maintaining its own set of permissions to various resources. However, depending on how many data sources instances you have and how you've set them up, that might mean rotating and managing many different secret and access keys.

Instead, using the assume role functionality, you could have one set of AWS credentials for all of your AWS data sources that has only one permission—the permission to assume a role with STS. Then you could create a separate IAM role for each data source that specifies which permissions that data source can temporarily assume. Since IAM roles are not credentials, there's no need to rotate them and they may be easier to manage.

The Grafana Assume Role also helps facilitate this. Using this role, Grafana's AWS account acts as the primary credential, having only the permission to assume roles in other accounts. You can then create IAM roles for Grafana's account to assume. For more information, refer to [Use Grafana assume role](#use-grafana-assume-role).

If the **Assume Role ARN** field is left empty, Grafana uses the provided credentials from the selected authentication method directly, and permissions to AWS data must be attached directly to those credentials. The **Assume Role ARN** field is optional for all authentication methods except for Grafana Assume Role.

To disable this feature in open source Grafana or Grafana Enterprise, refer to the [`assume_role_enabled` documentation](ref:configure-grafana-assume-role-enabled).

### Use an external ID

{{% admonition type="note" %}}
You cannot use an external ID for the Grafana Assume Role authentication provider.
{{% /admonition %}}

To assume a role in another account that was created with an external ID, specify the external ID in the **External ID** field.

For more information, refer to the [AWS documentation on external ID](https://docs.aws.amazon.com/IAM/latest/UserGuide/id_roles_create_for-user_externalid.html).

When Grafana Assume Role is the selected authentication provider, Grafana is responsible for supplying and calling the external ID. It's displayed on the data source configuration page and is unique to your account. It's very important when creating an IAM role for `Grafana Assume Role` that you set a conditional that Grafana's AWS account can only assume your IAM role when a particular external ID is specified:

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

## Use Grafana Assume Role

{{% admonition type="note" %}}
Grafana Assume Role is currently in [private preview](https://grafana.com/docs/release-life-cycle/) for Grafana Cloud. To get early access this feature, reach out to Customer Support and ask for the `awsDatasourcesTempCredentials` feature toggle to be enabled on your account. It is currently only available for CloudWatch.
{{% /admonition %}}

The Grafana Assume Role authentication provider lets you authenticate with AWS without having to create and maintain long term AWS users or rotate their access and secret keys. Instead, you can create an IAM role that has permissions to access CloudWatch and a trust relationship with Grafana's AWS account. Grafana's AWS account then makes an STS request to AWS to create temporary credentials to access your AWS data. It makes this STS request by passing along an `externalID` that's unique per Cloud account, to ensure that Grafana Cloud users can only access their own AWS data. For more information, refer to the [AWS documentation on external ID](https://docs.aws.amazon.com/IAM/latest/UserGuide/id_roles_create_for-user_externalid.html).

To use the Grafana Assume Role:

1. Grafana Cloud customers need to open a support ticket to enable the feature `awsDatasourcesTempCredentials`.
   This feature is enabled by default in open source Grafana and Grafana Enterprise.
2. Once the feature is enabled, create a new CloudWatch data source (or update an existing one) and select **Grafana Assume Role** as an authentication provider.
3. In the AWS Console, create a new IAM role, and under **Trusted entity type**, select **Another AWS account** as the trusted Entity.
4. Enter Grafana's account id (displayed in the instructions box on the **Settings** tab of the CloudWatch data source configuration) and check the **Require external ID** box.
5. Enter the external ID specified in the instructions box on the **Settings** tab of the CloudWatch data source configuration in Grafana. This external ID will be unique to your Grafana instance.
6. Attach any required permissions you would like Grafana to be able to access on your behalf (for example, CloudWatch Logs and CloudWatch Metrics policies).
7. Give the role a name and description, and click **Create role**.
8. Copy the ARN of the role you just created and paste it into the **Assume Role ARN** field on the **Settings** tab of CloudWatch data source configuration in Grafana.

Sample Trust Relationship for an IAM role:

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
