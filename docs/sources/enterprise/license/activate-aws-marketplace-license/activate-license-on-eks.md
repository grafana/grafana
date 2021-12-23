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

## Task 1: Deploy Grafana Enterprise on Amazon EKS

If you do not have Grafana Enterprise running in EKS already, you must deploy it. Follow Amazon's documentation to [create an Amazon EKS cluster](https://docs.aws.amazon.com/eks/latest/userguide/getting-started-console.html) and [install Grafana on Kubernetes using the Helm Chart](https://github.com/grafana/helm-charts/tree/main/charts/grafana).

Update the deployment configuration to use Grafana Enterprise. Use `kubectl set image deployment/my-release grafana=grafana/grafana-enterprise:<version>` to update the container image to Grafana Enterprise version 8.3.0 or higher. For example, use `grafana/grafana-enterprise:8.3.3`.

Versions of Grafana before 8.3.0 do not support licenses granted through AWS Marketplace.

## Task 2: Setup Grafana for high-availability

Update the [database]({{< relref "../../../../../administration/configuration.md#database" >}}) configuration section, so that Grafana use a shared database for storing dashboard, users, and other persistent data.

> If you do not have a MySQL database already, [create an Amazon RDS DB instance](https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/USER_CreateDBInstance.html) and check the information needed to [connect to your RDS DB instance](https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/CHAP_CommonTasks.Connect.html).

You can do this in one of two ways:

**Option 1:** Use `kubectl edit configmap grafana` to edit the Grafana configuration file. Under `grafana.ini` add the following section to your config:

```
[database]
type = mysql
host = localhost:3306
name = grafana
user = [mysql database username]
password = [mysql database password]
```

**Option 2:** Use `kubectl edit deployment my-release` to edit the pod environment variables. Under `env` add the following variables:

```
- name: GF_DATABASE_TYPE
  value: mysql
- name: GF_DATABASE_HOST
  value: localhost:3306
- name: GF_DATABASE_NAME
  value: grafana
- name: GF_DATABASE_USER
  value: [mysql database username]
- name: GF_DATABASE_PASSWORD
  value: [mysql database password]
```

## Task 3: Configure Grafana Enterprise to validate its license with AWS

1. In AWS IAM, assign the following permissions to your Node IAM Role if you are using a Node Group, or Pod execution role if you are using a Fargate profile:

   - `"license-manager:CheckoutLicense"`
   - `"license-manager:ListReceivedLicenses"`
   - `"license-manager:GetLicenseUsage"`
   - `"license-manager:CheckInLicense"`

   For more detailed steps to create an access policy, refer to the AWS documentation on [creating IAM policies](https://docs.aws.amazon.com/IAM/latest/UserGuide/access_policies_create-console.html).

   For more information about AWS license permissions, refer to [Actions, resources, and condition keys for AWS License Manager](​​https://docs.aws.amazon.com/service-authorization/latest/reference/list_awslicensemanager.html).

2. Update the [license_validation_type]({{< relref "../../enterprise-configuration.md#license_validation_type" >}}) configuration to `aws`, so that Grafana Enterprise validates the license with AWS instead of Grafana Labs.
   **Option 1:** Use `kubectl edit configmap grafana` to edit the Grafana configuration file. Under `grafana.ini` add the following section to your config:

   ```
   [enterprise]
   license_validation_type=aws
   ```

   **Option 2:** Use `kubectl edit deployment my-release` to edit the pod environment variables. Under `env` add the following variable:

   ```
   - name: GF_ENTERPRISE_LICENSE_VALIDATION_TYPE
     value: aws
   ```

### Task 4: Start or restart Grafana

To activate Grafana Enterprise features, start (or restart) Grafana.

To restart Grafana on a Kubernetes cluster, use `kubectl rollout restart deployment my-release`.

For more information about restarting Grafana, refer to [Restart Grafana]({{< relref "../../../installation/restart-grafana" >}}).

> If you experience issues when you update the EKS cluster, refer to [Amazon EKS troubleshooting](https://docs.aws.amazon.com/eks/latest/userguide/troubleshooting.html).
