---
aliases:
  - about-api-keys/
  - create-api-key/
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

### Before you begin

To follow these instructions, you need at least one of the following:

- Administrator permissions
- Editor permissions
- Service account writer

- To ensure you have permission to create and edit API keys, follow the instructions in [Roles and permissions]({{< relref "../roles-and-permissions/#" >}}).

### Steps

To create an API, complete the following steps:

1. Sign in to Grafana.
1. Click **Administration** in the left-side menu and select **API Keys**.
1. Click **Add API key**.
1. Enter a unique name for the key.
1. In the **Role** field, select one of the following access levels you want to assign to the key.
   - **Admin**: Enables a user to use APIs at the broadest, most powerful administrative level.
   - **Editor** or **Viewer** to limit the key's users to those levels of power.
1. In the **Time to live** field, specify how long you want the key to be valid.
   - The maximum length of time is 30 days (one month). You enter a number and a letter. Valid letters include `s` for seconds,`m` for minutes, `h` for hours, `d `for days, `w` for weeks, and `M `for month. For example, `12h` is 12 hours and `1M` is 1 month (30 days).
   - If you are unsure about how long an API key should be valid, we recommend that you choose a short duration, such as a few hours. This approach limits the risk of having API keys that are valid for a long time.
1. Click **Add**.

## Migrate API keys to Grafana service accounts

As an alternative to using API keys for authentication, you can use a service account-based authentication system. When compared to API keys, service accounts have limited scopes that provide more security than using API keys.

For more information about the benefits of service accounts, refer to [Grafana service account benefits]({{< relref "../service-accounts/#service-account-benefits" >}}).

The service account endpoints generate a machine user for authentication instead of using API keys. When you migrate an API key to a service account, a service account will be created with a service account token.

> **Note:** If you are using API keys for authentication, we recommend that you migrate your integration to the service account authentication method. The API key will continue to work. You can locate the API key in the [Grafana service account tokens]({{< relref "../service-accounts/#service-account-tokens" >}}) details.

## Ways of migrating API keys to service accounts

If you are currently using API keys in your environment, you need to reconfigure your setup to use service accounts.

Depending on your current setup, you may need to use one or all of the following methods to migrate your environment to service accounts:

- The Grafana user interface: Use this method if you have been using the UI to manage your API keys and want to switch to using service accounts.
- The Grafana API: Use this method if you have been using API calls to manage your API keys and want to switch to using service accounts programmatically.
- Terraform: If you have a Terraform configuration that sets up API keys, you need to reconfigure your Terraform to use service accounts instead.

By following these steps, you can successfully migrate your integration from API keys to service accounts and continue using Grafana seamlessly.

### Migrate API keys to Grafana service accounts using the Grafana user interface

This section shows you how to migrate API keys to Grafana service accounts using the Grafana user interface. You can choose to migrate a single API key or all API keys. When you migrate all API keys, you can no longer create API keys and must use service accounts instead.

#### Before you begin

To follow these instructions, you need at least one of the following:

- Administrator permissions
- Editor permissions
- Service account writer

For more information about permissions, refer to [Roles and permissions]({{< relref "../roles-and-permissions/#" >}}).

#### Steps

To migrate all API keys to service accounts, complete the following steps:

1. Sign in to Grafana, point to **Configuration** (the gear icon), and click **API Keys**.
1. In the top of the page, find the section which says **Switch from API keys to service accounts**
1. Click **Migrate to service accounts now**.
1. A confirmation window will appear, asking to confirm the migration. Click **Yes, migrate now** if you are willing to continue.
1. Once migration is successful, you can choose to forever hide the API keys page. Click **Hide API keys page forever** if you want to do that.

To migrate a single API key to a service account, complete the following steps:

1. Sign in to Grafana.
1. Click **Administration** in the left-side menu and select **API Keys**.
1. Find the API Key you want to migrate.
1. Click **Migrate to service account**.

### Migrate API keys to Grafana service accounts using the API

This section shows you how to migrate API keys to Grafana service accounts using the Grafana API.

#### Before you begin

To follow these instructions, you need one of the following:

- Administrator permissions
- Editor permissions
- Service account writer

#### Steps

Complete the following steps to migrate from API keys to service accounts using the API:

1. Call the `POST /api/serviceaccounts` endpoint and the `POST /api/serviceaccounts/<id>/tokens`.

   This action generates a service account token.

1. Store the ID and secret that the system returns to you.
1. Pass the token in the `Authrorization` header, prefixed with `Bearer`.

   This action authenticates API requests.

1. SATs used for authentication
1. Remove code that handles the old `/api/auth/keys` endpoint.
1. Track the [API keys](http://localhost:3000/org/apikeys) in use and migrate them to SATs.

### Migrate API keys to Grafana service accounts using Terraform

This section shows you how to migrate API keys to Grafana service accounts using Terraform.

#### Steps

Complete the following steps to migrate from API keys to service accounts using Terraform:

1. Generate `grafana_service_account` and `grafana_service_account_token` resources.
1. Specify the desired scopes and expiration date when creating the service account.
1. Use the token returned from `grafana_service_account_token` to authenticate the API requests.
1. Remove the terraform configuration for creating your `grafana_api_key` resources.
