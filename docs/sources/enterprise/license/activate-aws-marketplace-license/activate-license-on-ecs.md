+++
title = "Activate a Grafana Enterprise license from AWS Marketplace on ECS"
description = "Activate a Grafana Enterprise license from AWS Marketplace on ECS"
keywords = ["grafana", "ecs", "enterprise", "aws", "marketplace", "activate"]
aliases = ["/docs/grafana/latest/enterprise/activate-aws-marketplace-license/activate-license-on-ecs"]
weight = 250
+++

# Activate a Grafana Enterprise license from AWS Marketplace on ECS

If you have purchased a Grafana Enterprise subscription through AWS Marketplace, you must activate it in order to use Grafana Enterprise data source plugins and features in Grafana.

## Before you begin:

- Purchase a subscription to [Grafana Enterprise from AWS Marketplace](https://aws.amazon.com/marketplace/pp/prodview-dlncd4kzt5kx6).
- Be sure that the IAM user that was used to purchase Grafana Enterprise has permission to manage subscriptions, create new IAM users and roles, and create access policies.

To activate your license, complete the following tasks:

## Task 1: Deploy Grafana Enterprise on Amazon ECS

If you do not have Grafana Enterprise running in ECS already, you must deploy it. Follow Amazon's documentation to [Create an Amazon ECS service](https://docs.aws.amazon.com/AmazonECS/latest/developerguide/create-service.html). While creating the service, use the container image for Grafana Enterprise version 8.3.0 or higher. For example, use `grafana/grafana-enterprise:8.3.3`.

Versions of Grafana before 8.3.0 do not support licenses granted through AWS Marketplace.

## Task 2: Configure Grafana Enterprise to validate its license with AWS

1. In AWS IAM, create a new Access Policy with the following permissions:

   - `"license-manager:CheckoutLicense"`
   - `"license-manager:ListReceivedLicenses"`
   - `"license-manager:GetLicenseUsage"`
   - `"license-manager:CheckInLicense"`

   For more detailed steps to create an access policy, refer to the AWS documentation on [creating IAM policies](https://docs.aws.amazon.com/IAM/latest/UserGuide/access_policies_create-console.html).

   For more information about AWS license permissions, refer to [Actions, resources, and condition keys for AWS License Manager](https://docs.aws.amazon.com/service-authorization/latest/reference/list_awslicensemanager.html).

2. Follow the AWS documentation to [create a new Elastic Container Service Task Role](https://docs.aws.amazon.com/AmazonECS/latest/developerguide/task-iam-roles.html) and attach the policy you created in the previous step to this new role.

3. Create a new revision of the Task Definition for the ECS Task that runs Grafana Enterprise. For details, refer to the AWS documentation on [updating a task definition](https://docs.aws.amazon.com/AmazonECS/latest/developerguide/update-task-definition.html).
   
   Within the new revision:

   1. Update the Task Role of your ECS Task to the role that you created above, which has permission to access license information.

   2. Edit the Grafana Enterprise container for this task, and add the following environment variable to the container:

      ```
      GF_ENTERPRISE_LICENSE_VALIDATION_TYPE=aws
      ```

      > For more information about how to update your ECS service with an environment variable, refer to [Updating a service using the new console](https://docs.aws.amazon.com/AmazonECS/latest/developerguide/update-service-console-v2.html).

### Task 3: Start or restart Grafana

To restart Grafana and activate your license, update the service running Grafana to use the latest revision of the Task Definition, which you created in the previous step.

Once you have updated the service, navigate to your Grafana instance, sign in with Grafana Admin credentials, and visit the Stats & Licensing page to validate that your license is active.
