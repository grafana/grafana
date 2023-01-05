---
aliases:
  - ../../activate-aws-marketplace-license/activate-license-on-instance-outside-aws/
description: Activate a Grafana Enterprise license from AWS on an instance deployed
  outside of AWS
keywords:
  - grafana
  - enterprise
  - aws
  - marketplace
  - activate
title: Activate a Grafana Enterprise license from AWS on an instance deployed outside
  of AWS
weight: 300
---

# Activate a Grafana Enterprise license from AWS on an instance deployed outside of AWS

While AWS Marketplace lists ECS and EKS as the supported environments for Grafana Enterprise, you can apply a Grafana Enterprise license from AWS Marketplace to any Grafana instance with network access to the AWS licensing service.

## Before you begin

- Purchase a subscription to [Grafana Enterprise from AWS Marketplace](https://aws.amazon.com/marketplace/pp/prodview-dlncd4kzt5kx6).
- Be sure that the IAM user that was used to purchase Grafana Enterprise has permission to manage subscriptions, create new IAM users, and create access policies.
- Be sure there is network access between AWS and the environment where you intend to run Grafana. Network access is required because your Grafana instance communicates with the [AWS License Manager endpoints and quotas](https://docs.aws.amazon.com/general/latest/gr/licensemanager.html) to retrieve license and subscription information. Grafana instances with access to the public internet will have access to AWS license manager.

To activate a Grafana Enterprise license from AWS on a Grafana Enterprise instance deployed outside of AWS, complete the following tasks.

## Task 1: Install Grafana Enterprise

To install Grafana, refer to the documentation specific to your implementation.

- [Install Grafana]({{< relref "../../../installation/" >}}).
- [Run Grafana Docker image]({{< relref "../../../installation/docker" >}}).
- [Deploy Grafana on Kubernetes]({{< relref "../../../installation/kubernetes/#deploy-grafana-enterprise-on-kubernetes" >}}).

## Task 2: Create an AWS IAM user with access to your Grafana Enterprise license

To retrieve your license, Grafana Enterprise requires access to your AWS account and license information. To grant access, create an IAM user in AWS with access to the license, and pass its credentials as environment variables on the host or container where Grafana is running. These environment variables allow Grafana to retrieve license details from AWS.

1. In the AWS License Manager service, create an IAM policy with the following permissions:

   - `"license-manager:CheckoutLicense"`
   - `"license-manager:ListReceivedLicenses"`
   - `"license-manager:GetLicenseUsage"`
   - `"license-manager:CheckInLicense"`

   For more information about creating a policy in AWS, refer to [Creating IAM policies](https://docs.aws.amazon.com/IAM/latest/UserGuide/access_policies_create.html).

   For more information about AWS Identity and Access Management, refer to [IAM users](https://docs.aws.amazon.com/IAM/latest/UserGuide/id_users.html).

1. To limit the policy to obtain usage data just for Grafana Enterprise, in the **Resources** section of the policy, specify your license ARN.

   You can find your license ID in the **Granted Licenses** section of [AWS License Manager](https://console.aws.amazon.com/license-manager/home).

   The policy JSON should look similar to the following example:

   ```
   {
      "Version": "2012-10-17",
      "Statement": [
         {
               "Sid": "VisualEditor0",
               "Effect": "Allow",
               "Action": "license-manager:GetLicenseUsage",
               "Resource": "arn:aws:license-manager::[YOUR_ACCOUNT]:license:[YOUR_LICENSE_ID]"
         },
         {
               "Sid": "VisualEditor1",
               "Effect": "Allow",
               "Action": [
                  "license-manager:CheckoutLicense",
                  "license-manager:ListReceivedLicenses",
                  "license-manager:CheckInLicense"
               ],
               "Resource": "*"
         }
      ]
   }
   ```

1. Create an IAM user and choose access key credentials as its authentication method.

   For more information about creating an IAM user, refer to [IAM users](https://docs.aws.amazon.com/IAM/latest/UserGuide/id_users.html).

   For more information about access key credentials, refer to [Managing access keys for IAM users](https://docs.aws.amazon.com/IAM/latest/UserGuide/id_credentials_access-keys.html).

1. Attach the policy you created to the IAM user.

1. Add the following values as environment variables to the host or container running Grafana:

   - AWS region
   - IAM user's access key ID
   - IAM user's secret access key

   The environment variables should look similar to the following example:

   ```
   AWS_ACCESS_KEY_ID=ABCD5E75FGHIJKTM7
   AWS_SECRET_ACCESS_KEY=k8fhYAQVy+5NhCejhe6HeSjSphjRuy+12C06
   AWS_REGION=us-east-1
   ```

## Task 3: Configure Grafana Enterprise to validate its license with AWS

In this task you configure Grafana Enterprise to validate the license with AWS instead of Grafana Labs.

Choose one of the following options to update the [license_validation_type]({{< relref "../../enterprise-configuration.md#license_validation_type" >}}) configuration to `aws`:

- **Option 1:** In the `[enterprise]` section of the grafana.ini configuration file, add `license_validation_type=aws`.

  For example:

  ```
  [enterprise]
  license_validation_type=aws
  ```

- **Option 2:** Add the following environment variable to the container or host:

  ```
  GF_ENTERPRISE_LICENSE_VALIDATION_TYPE=aws
  ```

## Task 4: Start or restart Grafana

To activate Grafana Enterprise features, start (or restart) Grafana.

For information about restarting Grafana, refer to [Restart Grafana]({{< relref "../../../installation/restart-grafana" >}}).
