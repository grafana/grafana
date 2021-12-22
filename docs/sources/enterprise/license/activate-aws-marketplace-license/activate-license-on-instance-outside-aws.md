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

## Task 2: Install the Amazon command line interface

To retrieve your license, Grafana Enterprise requires access to your AWS account and license information. You grant access using the AWS command line interface (CLI).

1. To install the AWS CLI, refer to [Getting started with the AWS CLI](https://docs.aws.amazon.com/cli/latest/userguide/cli-chap-getting-started.html).

1. Configure Grafana with the credentials of an IAM user granted the following permissions:

   - `"license-manager:CheckoutLicense"`
   - `"license-manager:ListReceivedLicenses"`
   - `"license-manager:GetLicenseUsage"`
   - `"license-manager:CheckInLicense"`

   For more information about AWS Identity and Access Management, refer to [IAM users](​​https://docs.aws.amazon.com/IAM/latest/UserGuide/id_users.html).

## Task 3: Configure Grafana Enterprise to validate its license with AWS

Update one of the following settings so that Grafana Enterprise validates the license with AWS instead of Grafana Labs.

- In the grafana.ini configuration file, update the license_validation_type configuration value to `aws`.
- Add the following environment variable to the container:

```
GF_ENTERPRISE_LICENSE_VALIDATION_TYPE=aws
```

## Task 4: Start or restart Grafana

To activate Grafana Enterprise features, start (or restart) Grafana.

For information about restarting Grafana, refer to [Restart Grafana]({{< relref "../../../installation/restart-grafana" >}}).
