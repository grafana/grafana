---
title: 'Add a token to a service account in Grafana'
menuTitle: 'Add a token to a service account'
aliases: [docs/sources/administration/service-accounts/add.md]
description: 'This topic shows you how to add a token to a service account'
weight: 60
---

# Add a token to a service account in Grafana

You can add a token to service account in the service account tab of the organization.
For more information about service accounts, refer to [About service accounts in Grafana]({{< relref "./about-service-accounts.md">}}).

For more information about creating a service account token via the API, refer to [HTTP API Create service account token]({{< relref "../../http_api/serviceaccount.md#create-service-account-tokens">}}).

Before you begin:

- Ensure you have added the `service-accounts` feature toggle to Grafana. For more information about enabling service accounts, refer to [Enable service accounts]({{< relref "./enable-service-accounts.md#">}})
- Ensure you have permission to create and edit service accounts. For more information about user roles, refer to [About users and permissions]({{< relref "../manage-users-and-permissions/about-users-and-permissions.md#">}}).
- Create a service account. Refer to [Create a service account in Grafana]({{< relref "./create-service-account.md#">}})

**To add a token to a service account:**

1. Sign in to Grafana and hover your cursor over the organization icon in the sidebar.
1. Click **Service accounts**. 
1. Click the service account to which you want to add a token.
1. Click **Add token**.
1. Enter a name for the token.
1. (recommended) Enter an expiry date and expiry date for the token or leave it on no expiry date option. This specifies how long you want the key to be valid.

- If you are unsure of an expiration date, we recommend that you set the token to expire after a short time, such as a few hours or less. This limits the risk associated with a token that is valid for a long time.

1. Click **Generate service account token**.

**To create a API key:**

1. In the Grafana console side menu, pause on the Configuration (gear) icon, then choose API Keys.
2. Choose **New API key**.
3. Enter a unique name for the key.
4. For Role, select the access level that the key is to be granted.

- Select Admin to allow a user with this key to use APIs at the broadest, most powerful administrative level. Select Editor or Viewer to limit the key's users to those levels of power.

1. We strongly recommend that you set the key's time to live for a shorter time, such as a few hours or less. This creates much less risk than having API keys that are valid for a long time.
1. Choose Add.
