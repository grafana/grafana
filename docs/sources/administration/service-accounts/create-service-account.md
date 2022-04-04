---
title: Create a service account in Grafana
menuTitle: Create a service account
aliases: [docs/sources/administration/service-accounts/add-service-account-token.md]
description: 'How to create a service account in Grafana'
weight: 50
keywords:
  - Service accounts
---

# Create a service account in Grafana

You can create a service account in the service account tab of the organization. To manage your computed workload with a user that is not tied to a user specifically.

Consider the following restriction when you create a service account:

- A service account is identified by its name, which is unique to the entire suite of organizations. The name is set upon creation of the service account
- Service accounts live on a organizational level and are restricted as such

For more information about service accounts refer to [About service accounts in Grafana]({{< relref "./about-service-accounts.md">}}).

For more information about creating service accounts via the API, refer to [Create service account via API]({{< relref "../../http_api/serviceaccount.md#create-service-account">}}).

Before you begin:

- Ensure you have added the feature toggle for service accounts `service-accounts`. Refer to [Enable service accounts]({{< relref "./enable-service-accounts.md#">}})
- Ensure you have permission to create and edit service accounts, for more information refer to [About users and permissions]({{< relref "../manage-users-and-permissions/about-users-and-permissions.md#">}})

**To create a service account:**

1. Hover your mouse over the organization icon in the sidebar.
1. Click service accounts. Grafana opens the service accounts tab.
1. Click **New service account**.
1. Enter a display name, this will be unique within the organization
1. Click **Create service account**.
