---
aliases:
  - /docs/grafana/latest/administration/api-keys/about-api-keys/
  - /docs/grafana/latest/administration/api-keys/
  - /docs/grafana/latest/administration/api-keys/create-api-key/
description: This section contains information about API keys in Grafana
keywords:
  - API keys
  - Service accounts
menuTitle: API keys
title: API keys
weight: 700
---

# API keys

An API key is a randomly generated string that external systems use to interact with Grafana HTTP APIs.

When you create an API key, you specify a **Role** that determines the permissions associated with the API key. Role permissions control that actions the API key can perform on Grafana resources.

> **Note:** If you use Grafana v8.5 or newer, use service accounts instead of API keys. For more information, refer to [Grafana service accounts]({{< relref "../service-accounts/" >}}).

{{< section >}}

## Create an API key

Create an API key when you want to manage your computed workload with a user.

This topic shows you how to create an API key using the Grafana UI. You can also create an API key using the Grafana HTTP API. For more information about creating API keys via the API, refer to [Create API key via API]({{< relref "../../developers/http_api/create-api-tokens-for-org/#how-to-create-a-new-organization-and-an-api-token" >}}).

### Before you begin:

- Ensure you have permission to create and edit API keys. For more information about permissions, refer to [Roles and permissions]({{< relref "../roles-and-permissions/#" >}}).

**To create an API key:**

1. Sign in to Grafana, hover your cursor over **Configuration** (the gear icon), and click **API Keys**.
1. Click **New API key**.
1. Enter a unique name for the key.
1. In the **Role** field, select one of the following access levels you want to assign to the key.
   - **Admin**: Enables a user to use APIs at the broadest, most powerful administrative level.
   - **Editor** or **Viewer** to limit the key's users to those levels of power.
1. In the **Time to live** field, specify how long you want the key to be valid.
   - The maximum length of time is 30 days (one month). You enter a number and a letter. Valid letters include `s` for seconds,`m` for minutes, `h` for hours, `d `for days, `w` for weeks, and `M `for month. For example, `12h` is 12 hours and `1M` is 1 month (30 days).
   - If you are unsure about how long an API key should be valid, we recommend that you choose a short duration, such as a few hours. This approach limits the risk of having API keys that are valid for a long time.
1. Click **Add**.

## Migrate API Keys to Grafana service accounts

You can migrate one or all API keys to [Grafana service accounts]({{< relref "../service-accounts/" >}}). When you migrate an API key to a service account, a service account will be created with a service account token.
The API key will continue to work, and you can find it in the [Grafana service account tokens]({{< relref "../service-accounts/#service-account-benefits/#service-account-tokens" >}}) details.
For more information about benefits of service accounts, refer to [Grafana service account benefits]({{< relref "../service-accounts/#service-account-benefits" >}}).

You can choose to migrate a single API key or all API keys. Note that when you migrate all API keys, you can't create new API keys anymore and will have to use service accounts instead.

### Before you begin

- Ensure you have permission to create Grafana service accounts. For more information about permissions, refer to [Roles and permissions]({{< relref "../roles-and-permissions/#" >}}).

**To migrate all API keys to service accounts:**

1. Sign in to Grafana, hover your cursor over **Configuration** (the gear icon), and click **API Keys**.
2. In the top of the page, find the section which says **Switch from API keys to service accounts**
3. Click **Migrate to service accounts now**.
4. A confirmation window will appear, asking to confirm the migration. Click **Yes, migrate now** if you are willing to continue.
5. Once migration is successful, you can choose to forever hide the API keys page. Click **Hide API keys page forever** if you want to do that.

**To migrate single API key to a service account:**

1. Sign in to Grafana, hover your cursor over **Configuration** (the gear icon), and click **API Keys**.
1. Find the API Key you want to migrate.
1. Click **Migrate to service account**.

### Revert service account token to API key

**Note:** This is undesired operation and should be used only in emergency situations.

It is possible to convert back service account token to API key. You can use the [Revert service account token to API key HTTP API]({{< relref "../../developers/http_api/create-api-tokens-for-org/#how-to-create-a-new-organization-and-an-api-token" >}}) for that.

**The revert will perform the following actions:**

1. Convert the given service account token back to API key
1. Delete the service account associated with the given key. **Make sure there are no other tokens associated with the service account, otherwise they all will be deleted.**
