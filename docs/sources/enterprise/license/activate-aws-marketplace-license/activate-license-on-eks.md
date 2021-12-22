+++
title = "Activate a Grafana Enterprise license from AWS Marketplace on EKS"
description = "Activate a Grafana Enterprise license from AWS Marketplace on EKS"
keywords = ["grafana", "enterprise", "aws", "marketplace", "eks", "activate"]
aliases = ["/docs/grafana/latest/enterprise/activate-aws-marketplace-license/activate-license-on-eks"]
weight = 200
+++

# Activate a Grafana Enterprise license from AWS Marketplace on EKS

If you have purchased a Grafana Enterprise subscription through AWS Marketplace, you must activate it in order to use Grafana Enterprise data source plugins and features in Grafana.

## Before you begin:

- Purchase a subscription to [Grafana Enterprise from AWS Marketplace](https://aws.amazon.com/marketplace/pp/prodview-dlncd4kzt5kx6).
- Be sure that the IAM user that was used to purchase Grafana Enterprise has permission to manage subscriptions, create new IAM users and roles, and create access policies.

To activate your license, complete the following tasks:

## Task 1: Install Grafana Enterprise on Amazon EKS

To install Grafana Enterprise on Amazon EKS, refer to the following Amazon documentation:

- [Create an Amazon EKS cluster](https://docs.aws.amazon.com/eks/latest/userguide/create-cluster.html)

> **Note:** Use the container image for Grafana Enterprise version 8.3.0 or higher. For example, use `grafana/grafana-enterprise:8.3.3`.

Versions of Grafana before 8.3.0 do not support licenses granted through AWS Marketplace.

## Task 2: Configure Grafana Enterprise to validate the license with AWS

Update the following settings in EKS so that Grafana Enterprise validates the license with AWS instead of Grafana Labs.

1. In Amazon EKS, create a role and assign the following permissions:

   - `"license-manager:CheckoutLicense"`
   - `"license-manager:ListReceivedLicenses"`
   - `"license-manager:GetLicenseUsage"`
   - `"license-manager:CheckInLicense"`

   For more information about AWS license permissions, refer to [Actions, resources, and condition keys for AWS License Manager](​​https://docs.aws.amazon.com/service-authorization/latest/reference/list_awslicensemanager.html).

2. Enter an image name according to the following convention: `grafana/grafana-enterprise:[VERSION]`, where [VERSION] is the Grafana Enterprise version number.

   > A Grafana Enterprise license purchased through AWS Marketplace supports Grafana Enterprise version 8.3 or higher.

3. Add the following environment variable to the container:

   ```
   GF_ENTERPRISE_LICENSE_VALIDATION_TYPE=aws
   ```

   > For more information about EKS, refer to [Cluster management](https://docs.aws.amazon.com/eks/latest/userguide/eks-managing.html).

### Task 3: Start or restart Grafana

To activate Grafana Enterprise features, start (or restart) Grafana.

For information about restarting Grafana, refer to [Restart Grafana]({{< relref "../../../installation/restart-grafana" >}}).

> If you experience issues when you update the EKS cluster, refer to [Amazon EKS troubleshooting](https://docs.aws.amazon.com/eks/latest/userguide/troubleshooting.html).
