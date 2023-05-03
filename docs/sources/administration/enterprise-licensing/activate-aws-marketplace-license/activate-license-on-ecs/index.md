---
aliases:
  - ../../../enterprise/activate-aws-marketplace-license/activate-license-on-ecs/
  - ../../../enterprise/license/activate-aws-marketplace-license/activate-license-on-ecs/
description: Activate a Grafana Enterprise license from AWS Marketplace on ECS
keywords:
  - grafana
  - ecs
  - enterprise
  - aws
  - marketplace
  - activate
title: Activate a Grafana Enterprise license from AWS Marketplace on ECS
weight: 250
---

# Activate a Grafana Enterprise license from AWS Marketplace on ECS

If you have purchased a Grafana Enterprise subscription through AWS Marketplace, you must activate it in order to use Grafana Enterprise data source plugins and features in Grafana.

## Before you begin

- Purchase a subscription to [Grafana Enterprise from AWS Marketplace](https://aws.amazon.com/marketplace/pp/prodview-dlncd4kzt5kx6).
- Be sure that the IAM user that was used to purchase Grafana Enterprise has permission to manage subscriptions, create new IAM users and roles, and create access policies.

To activate your license, complete the following tasks.

## Task 1: Deploy Grafana Enterprise on Amazon ECS

1. Deploy Grafana Enterprise on Amazon ECS.

   For more information about deploying an application on Amazon ECS, refer to [Creating an Amazon ECS service](https://docs.aws.amazon.com/AmazonECS/latest/developerguide/create-service.html).

1. As you create the Amazon ECS service, use the Grafana Enterprise version 8.3.0 or later container image.

   For example, enter `grafana/grafana-enterprise:8.3.3`.

   > Only Grafana Enterprise versions 8.3.0 and later support licenses granted through AWS Marketplace.

## Task 2: Configure Grafana for high availability

Grafana requires that you configure a database to hold dashboards, users, and other persistent data.

### Before you begin

- Ensure that you have a supported Grafana database available.
  - For a list of supported databases, refer to [Supported databases]({{< relref "../../../../setup-grafana/installation/#supported-databases" >}}).
  - For information about creating a database, refer to [Creating an Amazon RDS DB instance](https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/USER_CreateDBInstance.html).
- Review the information required to connect to the RDS DB instance. For more information, refer to [Connecting to an Amazon RDS DB instance](https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/CHAP_CommonTasks.Connect.html).

To configure Grafana for high availability:

1. In AWS ECS, use environment variables to update the `database` parameters.

   For a list of database parameters, refer to [Configuration]({{< relref "../../../../setup-grafana/configure-grafana/#database" >}}).

1. Create a revision of the task definition for the ECS Task that runs Grafana Enterprise.

   For more information about creating a task, refer to [Updating a task definition using the classic console](https://docs.aws.amazon.com/AmazonECS/latest/developerguide/update-task-definition.html).

1. Within the new revision, edit the Grafana Enterprise container for this task, and add the following environment variables to the container:

   ```
   GF_DATABASE_TYPE=[database type]
   GF_DATABASE_HOST=[database address and port]
   GF_DATABASE_NAME=[database name]
   GF_DATABASE_USER=[database username]
   GF_DATABASE_PASSWORD=[database password]
   ```

> For more information about how to update your ECS service with an environment variable, refer to [Updating a service using the new console](https://docs.aws.amazon.com/AmazonECS/latest/developerguide/update-service-console-v2.html).

## Task 3: Configure Grafana Enterprise to validate its license with AWS

In this task you configure Grafana Enterprise to validate the license with AWS instead of Grafana Labs.

1. In AWS IAM, create an access policy with the following permissions:

   - `"license-manager:CheckoutLicense"`
   - `"license-manager:ListReceivedLicenses"`
   - `"license-manager:GetLicenseUsage"`
   - `"license-manager:CheckInLicense"`

   For more information about creating an access policy, refer to [Creating IAM policies (console)](https://docs.aws.amazon.com/IAM/latest/UserGuide/access_policies_create-console.html).

   For more information about AWS license permissions, refer to [Actions, resources, and condition keys for AWS License Manager](https://docs.aws.amazon.com/service-authorization/latest/reference/list_awslicensemanager.html).

1. Create an Elastic Container Service task role and attach the policy you created in the previous step.

   For more information about creating a task role, refer to [IAM Roles for Tasks](https://docs.aws.amazon.com/AmazonECS/latest/developerguide/task-iam-roles.html).

1. Create a revision of the task definition for the ECS Task that runs Grafana Enterprise.

   For more information about creating a revision of the task definition, refer to [Updating a task definition using the classic console](https://docs.aws.amazon.com/AmazonECS/latest/developerguide/update-task-definition.html).

1. Within the new revision, perform the following steps:

   a. Update the Task Role of your ECS Task to the role that you created, with permission to access license information.

   b. Edit the Grafana Enterprise container for this task, and add the following environment variable to the container:

   ```
   GF_ENTERPRISE_LICENSE_VALIDATION_TYPE=aws
   ```

   For more information about how to update your ECS service with an environment variable, refer to [Updating a service using the new console](https://docs.aws.amazon.com/AmazonECS/latest/developerguide/update-service-console-v2.html).

### Task 4: Start or restart Grafana

1. To restart Grafana and activate your license, update the service running Grafana to use the latest revision of the task definition that you created.
1. After you update the service, navigate to your Grafana instance, sign in with Grafana Admin credentials, and navigate to **Administration > Stats and license** to validate that your license is active.

For more information about validating that your license is active, refer to [Grafana Enterprise license restrictions]({{< relref "../../#grafana-enterprise-license-restrictions" >}}).
