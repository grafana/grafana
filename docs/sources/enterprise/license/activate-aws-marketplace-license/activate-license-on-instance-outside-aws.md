+++
title = "Activate a Grafana Enterprise license from AWS on an instance deployed outside of AWS"
description = "Activate a Grafana Enterprise license from AWS on an instance deployed outside of AWS"
keywords = ["grafana", "enterprise", "aws", "marketplace", "activate"]
aliases = ["/docs/grafana/latest/enterprise/activate-aws-marketplace-license/activate-license-on-instance-outside-aws"]
weight = 300
+++

# Activate a Grafana Enterprise license from AWS on an instance deployed outside of AWS

While AWS Marketplace lists ECS and EKS as the supported environments for Grafana Enterprise, you can apply a Grafana Enterprise license from AWS Marketplace to any Grafana instance with network access to the AWS licensing service.

## Before you begin:

- Purchase a subscription to [Grafana Enterprise from AWS Marketplace](https://aws.amazon.com/marketplace/pp/prodview-dlncd4kzt5kx6).
- Be sure that the IAM user that was used to purchase Grafana Enterprise has permission to manage subscriptions, create new IAM users, and create access policies.
- Be sure there is network access between AWS and the environment where you intend to run Grafana. Network access is required because your Grafana instance communicates with the [AWS License Manager API endpoints](https://docs.aws.amazon.com/general/latest/gr/licensemanager.html) to retrieve license and subscription information.

To activate a Grafana Enterprise license from AWS on a Grafana Enterprise instance deployed outside of AWS, complete the following tasks.

## Task 1: Install Grafana Enterprise

To install Grafana, refer to the documentation specific to your implementation.

- [Install Grafana]({{< relref "../../../installation/" >}}).
- [Run Grafana Docker image]({{< relref "../../../installation/docker" >}})
- [Deploy Grafana on Kubernetes]({{< relref "../../../installation/kubernetes/#deploy-grafana-enterprise-on-kubernetes" >}}).

## Task 2: Create an AWS IAM user with access to your Grafana Enterprise license

To retrieve your license, Grafana Enterprise requires access to your AWS account and license information. Grant access by creating an IAM user in AWS with access to the license, and passing its credentials as environment variables on the host or container where Grafana is running.

1. In AWS, create an IAM policy with the following permissions for the **License Manager** service:

   - `"license-manager:CheckoutLicense"`
   - `"license-manager:ListReceivedLicenses"`
   - `"license-manager:GetLicenseUsage"`
   - `"license-manager:CheckInLicense"`

   For details on creating a policy in AWS, refer to the AWS documentation on [creating IAM policies](https://docs.aws.amazon.com/IAM/latest/UserGuide/access_policies_create.html).

   For more information about AWS Identity and Access Management, refer to [IAM users](​​https://docs.aws.amazon.com/IAM/latest/UserGuide/id_users.html).

2. In the **Resources** section of the policy, specify your license ARN in order to limit the policy to get usage data for only the license granted to Grafana Enterprise. You can find your license ID in the **Granted Licenses** section of [AWS License Manager](https://console.aws.amazon.com/license-manager/home).  
   
   Your policy JSON should look like this:

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

3. Create an [IAM user](https://docs.aws.amazon.com/IAM/latest/UserGuide/id_users.html) with [access key credentials](https://docs.aws.amazon.com/IAM/latest/UserGuide/id_credentials_access-keys.html), and attach the policy you created to the user.

4. Add the IAM user's Access Key ID and Secret Access Key, along with your default AWS region, as environment variables to the host or container where you are running Grafana. This will allow Grafana to retrieve license details from AWS using these credentials.

   Your environment variables should look like this:

   ```
   AWS_ACCESS_KEY_ID=ABCD5E75FGHIJKTM7
   AWS_SECRET_ACCESS_KEY=k8fhYAQVy+5NhCejhe6HeSjSphjRuy+12C06
   AWS_DEFAULT_REGION=us-east1
   ```

## Task 3: Configure Grafana Enterprise to validate its license with AWS

Update the [license_validation_type]({{< relref "../../enterprise-configuration.md#license_validation_type" >}}) configuration to `aws`, so that Grafana Enterprise validates the license with AWS instead of Grafana Labs. 
   
You can do this in one of two ways:

**Option 1:** In the [enterprise] section of the grafana.ini configuration file, add a `license_validation_type` configuration value to `aws`.

```
[enterprise]
license_validation_type=aws
```

**Option 2:** Add the following environment variable to the container:

```
GF_ENTERPRISE_LICENSE_VALIDATION_TYPE=aws
```

## Task 4: Start or restart Grafana

To activate Grafana Enterprise features, start (or restart) Grafana.

For information about restarting Grafana, refer to [Restart Grafana]({{< relref "../../../installation/restart-grafana" >}}).
