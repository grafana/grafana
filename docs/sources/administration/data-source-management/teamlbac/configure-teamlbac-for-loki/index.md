---
aliases:
  - ../../../enterprise/activate-aws-marketplace-license/activate-license-on-ecs/
  - ../../../enterprise/license/activate-aws-marketplace-license/activate-license-on-ecs/
description: Configure Team LBAC for Loki data soure on Grafana Cloud
keywords:
  - grafana
  - ecs
  - enterprise
  - aws
  - marketplace
  - activate
labels:
  products:
    - enterprise
    - oss
title: Configure Team LBAC for Loki
weight: 250
---

# Configure Team LBAC for Loki data source on Grafana Cloud

{{% alert title="Creating Team LBAC rules is available for preview for logs with Loki in Grafana Cloud." color="warning" %}}

Report any unexpected behavior to the Grafana Support team.

{{% /alert %}}

Team LBAC is available on Cloud for data sources created with basic authentication. Any managed Loki data source can **NOT** be configured with Team LBAC rules.

## Before you begin

- Be sure that you have the permission setup to create a loki tenant in Grafana Cloud 
- Be sure that you have admin data source permissions for Grafana.

## Task 1: Configure Team LBAC for a new Loki data source

1. Access Loki data sources details for your stack through grafana.com
1. Copy Loki Details and Create a CAP
   - Copy the details of your Loki setup.
   - Create a Cloud Access Policy (CAP) for the Loki data source in grafana.com.
   - Ensure the CAP includes `logs:read` permissions.
   - Ensure the CAP does not include `labels` rules.
1. Create a New Loki Data Source
   - In Grafana, proceed to add a new data source and select Loki as the type.
1. Navigate back to the Loki data source
   - Set up the Loki data source using basic authentication. Use the userID as the username. Use the generated CAP token as the password.
   - Save and connect.
1. Navigate to Data Source Permissions
   - Go to the permissions tab of the newly created Loki data source. Here, you'll find the Team LBAC rules section.

For more information on how to setup Team LBAC rules for a Loki data source, refer to [Add Team LBAC rules to Loki](/).