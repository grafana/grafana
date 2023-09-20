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
---

# Configure AWS authentication

A Grafana plugin's requests to AWS are made on behalf of an AWS Identity and Access Management (IAM) role or IAM user.
The IAM user or IAM role must have the associated policies to perform certain API actions.
Since these policies are specific to each data source, refer to the data source documentation for details.

All requests to AWS APIs are performed on the server side by the Grafana backend using the official AWS SDK.

This topic has the following sections:

- [Select an authentication method](#select-an-authentication-method)
- [Assume a role](#assume-a-role)
- [Use a custom endpoint](#use-a-custom-endpoint)
- [Use an AWS credentials file](#use-an-aws-credentials-file)
- [Use EKS IAM roles for service accounts](#use-eks-iam-roles-for-service-accounts)

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
- `Grafana Assume Role` is a new auth type in private preview only available in Grafana Cloud. To gain early access to this feature, reach out to customer support and ask about enabling the `awsDatasourcesTempCredentials` feature toggle. With this auth provider option, Grafana Cloud customers create an AWS IAM Role which has a trust relationship with Grafana's AWS Account. Grafana then uses STS to generate temporary credentials on it's behalf. Users with this option enabled will no longer need to generate secret and access keys for users.

If necessary, you can enable or disable them if you have server configuration access.
For more information, refer to the [`allowed_auth_providers` documentation][configure-grafana-allowed-auth-providers].

## Assume a role (optional for all auth methods except "Grafana Assume Role")

You can specify an IAM role to assume in the **Assume Role ARN** field.

When this field is filled, Grafana uses the provided credentials to perform an [sts:AssumeRole](https://docs.aws.amazon.com/STS/latest/APIReference/API_AssumeRole.html) call. In this example, the primary authentication method does not need permission to access CloudWatch directly, it just needs the ability to assume a role, while the role it assumes should have permission to access CloudWatch.

For example, you may have one set of long term credentials for all of your AWS datasources. However you may want to limit the access each datasource has to AWS (maybe one accesses staging data and another production data for example). One method could be to create separate credentials for each datasource, each maintaining it's own set of permissions to various resources. But depending on how many datasources you have and how you've set them up that might mean rotating/managing many different secret and access keys. Another method could be to have one set of AWS credentials for all of your AWS Datasources that has only one permission--the permission to assume a role with STS. Then you could create a separate IAM Role for each datasource that specifies which permissions that datasource can temporarily assume. Since IAM Roles are not credentials, there is no need to rotate them and they may be easier to manage.

To make this even easier, Grafana has released a new feature for Cloud customers called `Grafana Assume Role` in which Grafana's AWS Account acts as the primary credential, only having the permission to assume roles in other accounts. Users then create IAM Roles for Grafana's account to assume. Now users won't need to create any Long Term AWS Users and Keys, they only need to create IAM Roles and grant permission to Grafana's Account to assume them.

If the Assume Role field is left blank, Grafana will use the provided credentials from the selected authentication method directly, and permissions to AWS data must be attached directly to those credentials. The Assume Role field is optional for all authentication methods except for `Grafana Assume Role`.

To disable this feature, refer to the [`assume_role_enabled` documentation][configure-grafana-assume-role-enabled].

### Use an external ID (optional for all auth methods, not possible with "Grafana Assume Role")

To assume a role in another account that was created with an external ID, specify the external ID in the **External ID** field.

For more information, refer to the [AWS documentation on external ID](https://docs.aws.amazon.com/IAM/latest/UserGuide/id_roles_create_for-user_externalid.html).

When `Grafana Assume Role` is the selected authentication provider, Grafana is responsible for supplying and calling the external ID. It will be displayed on the datasource configuration page and will be unique to your account. It is very important when creating an IAM Role for `Grafana Assume Role` that you set a conditional that Grafana's AWS Account can only assume your IAM Role when a particular external ID is specified:

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

{{% docs/reference %}}
[configure-grafana-allowed-auth-providers]: "/docs/grafana/ -> /docs/grafana/<GRAFANA VERSION>/setup-grafana/configure-grafana#allowed_auth_providers"
[configure-grafana-allowed-auth-providers]: "/docs/grafana-cloud/ -> /docs/grafana/<GRAFANA VERSION>/setup-grafana/configure-grafana#allowed_auth_providers"

[configure-grafana-assume-role-enabled]: "/docs/grafana/ -> /docs/grafana/<GRAFANA VERSION>/setup-grafana/configure-grafana#assume_role_enabled"
[configure-grafana-assume-role-enabled]: "/docs/grafana-cloud/ -> /docs/grafana/<GRAFANA VERSION>/setup-grafana/configure-grafana#assume_role_enabled"
{{% /docs/reference %}}

## Use `Grafana Assume Role`

> Note: Grafan Assume Role is currently in Private Preview for Grafana Cloud. To get early access this feature, reach out to Customer Support and ask for the `awsDatasourcesTempCredentials` feature toggle to be enabled on your account. It is currently only available for CloudWatch.

`Grafana Assume Role` lets Grafana Cloud users authenticate with AWS without having to create and maintain long term AWS Users and rotate their access and secret keys. Instead Grafana Cloud customers can create an IAM Role with permissions to access CloudWatch and a trust relationship with Grafana's AWS Account. Grafana's AWS Account will then make an STS request to AWS to create temporary credentials to access the customer's AWS data. It makes this STS request by passing along an `externalID` that is unique per cloud account, to ensure that Grafana Cloud customers can only access their own AWS data. For more information, refer to the [AWS documentation on external ID](https://docs.aws.amazon.com/IAM/latest/UserGuide/id_roles_create_for-user_externalid.html).

To use this `Grafana Assume Role`:

1. Put in a request to Customer Support to enable `awsDatasourcesTempCredentials`
2. Once the feature is enabled, create a new CloudWatch datasource (or update an existing one) and select `Grafana Assume Role` as an authentication provider
3. Create a new IAM role in the AWS console, and select Another AWS account as the Trusted entity.
4. Enter the account ID of the Grafana account that has permission to assume this role 008923505280 and check the Require external ID box.
5. Enter the external ID specified in the Instructions Box on the CloudWatch Datasource Configuration page in Grafana. This external ID will be unique to your grafana instance.
6. Attach any required permissions you would like Grafana to be able to access on your behalf (example CloudWatch Logs and CloudWatch Metrics policies)
7. Give the role a name and description, and click Create role.
8. Copy the ARN of the role you just created and paste it into the Assume Role ARN field on the CloudWatch Datasource Configuration page in Grafana.

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
