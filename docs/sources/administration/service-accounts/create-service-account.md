---
title: Create a service account in Grafana
menuTitle: Create a service account
description: 'How to create a service account in Grafana'
weight: 50
keywords:
  - Service accounts
---

# Create a service account in Grafana

A service account is a user account that can be used to run automated or compute workloads. For more information, refer to [About service accounts]({{< relref "../service-accounts/about-service-accounts.md#">}}).

For more information about creating service accounts via the API, refer to [Create service account via API]({{< relref "../../http_api/serviceaccount.md#create-service-account">}}).

Before you begin:

- Ensure you have added the feature toggle for service accounts `service-accounts`. [Enable service accounts]({{< relref "./enable-service-accounts.md#">}})
- Ensure you have permission to create and edit service accounts, for more information refer to [About users and permissions]({{< relref "../manage-users-and-permissions/about-users-and-permissions.md#">}})

**To create a service account:**

1. Sign in to Grafana and hover your cursor over the organization icon in the sidebar.
1. Click **Service accounts**.
1. Click **New service account**.
1. Enter a **Display name**.

- This name needs to be unique to start with, as it determines the id.
- We recommend that you use a consistent naming convention when you name service accounts. A consistent naming convention can help you scale and maintain service accounts in the future.
- Do not worry about the naming you can change this name later.

1. Click **Create service account**.
