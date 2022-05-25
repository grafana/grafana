---
aliases:
  - /docs/grafana/latest/administration/service-accounts/create-service-account/
description: How to create a service account in Grafana
keywords:
  - Service accounts
menuTitle: Create a service account
title: Create a service account in Grafana
weight: 50
---

# Create a service account in Grafana

A service account can be used to run automated workloads in Grafana, like dashboard provisioning, configuration, or report generation. For more information about how you can use service accounts, refer to [About service accounts]({{< relref "../service-accounts/about-service-accounts.md#" >}}).

For more information about creating service accounts via the API, refer to [Create a service account in the HTTP API]({{< relref "../../developers/http_api/serviceaccount.md#create-service-account" >}}).

## Before you begin

- Ensure you have added the feature toggle for service accounts `serviceAccounts`. For more information about adding the feature toggle, refer to [Enable service accounts]({{< relref "./enable-service-accounts.md#" >}}).
- Ensure you have permission to create and edit service accounts. By default, the organization administrator role is required to create and edit service accounts. For more information about user permissions, refer to [About users and permissions]({{< relref "../manage-users-and-permissions/about-users-and-permissions.md#" >}}).

## To create a service account

1. Sign in to Grafana and hover your cursor over the Configuration (cog) icon in the sidebar.
1. Click **Service accounts**.
1. Click **New service account**.
1. Enter a **Display name**.
1. The display name must be unique as it determines the ID associated with the service account.
   - We recommend that you use a consistent naming convention when you name service accounts. A consistent naming convention can help you scale and maintain service accounts in the future.
   - You can change the display name at any time.
1. Click **Create service account**.
