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

> **Note:** If you use Grafana v9.1 or newer, use service accounts instead of API keys. For more information, refer to [Grafana service accounts]({{< relref "../service-accounts/" >}}).

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

### Migrate API keys to Grafana service accounts for API calls

This section shows you how to migrate API keys to Grafana service accounts specifically for the Grafana API. For references see: [Grafana Service Accounts for the Grafana API](https://grafana.com/docs/grafana/latest/developers/http_api/serviceaccount/).

#### Before you begin

To follow these instructions, you need one of the following:

- Administrator permissions
- Editor permissions
- Service account writer

#### Steps

Complete the following steps to migrate from API keys to service accounts for API:

1. Call the `POST /api/serviceaccounts` endpoint and the `POST /api/serviceaccounts/<id>/tokens`.

   This action generates a service account token.

1. Store the ID and secret that the system returns to you.
1. Pass the token in the `Authrorization` header, prefixed with `Bearer`.

   This action authenticates API requests.

1. SATs used for authentication
1. Remove code that handles the old `/api/auth/keys` endpoint.
1. Track the [API keys](http://localhost:3000/org/apikeys) in use and migrate them to SATs.

Example:

```sh
curl -X POST -H "Content-Type: application/json" -d '{"name": "my-service-account", "role": "Viewer"}' http://admin:admin@localhost:3000/api/serviceaccounts

# response from the api
{"id":1,"name":"my-service-account","login":"sa-my-service-account","orgId":1,"isDisabled":false,"role":"Viewer","tokens":0,"avatarUrl":""}%

curl -X POST -H "Content-Type: application/json" -d '{"name": "my-service-account-token"}' http://admin:admin@localhost:3000/api/serviceaccounts/1/tokens

# response from api
{"id":2,"name":"my-service-account-token","key":"glsa_9244xlVFZK0j8Lh4fU8Cz6Z5tO664zIi_7a762939"}%

```

### Migrate API keys to Grafana service accounts in Terraform

This section shows you how to migrate your terraform configuration for API keys to Grafana service accounts. For resources, see [Grafana Service Accounts in Terraform](https://registry.terraform.io/providers/grafana/grafana/latest/docs/resources/service_account_token).

#### Steps

Complete the following steps to migrate from API keys to service accounts using Terraform:

1. Generate `grafana_service_account` and `grafana_service_account_token` resources.
1. Specify the desired scopes and expiration date when creating the service account.
1. Use the token returned from `grafana_service_account_token` to authenticate the API requests.
1. Remove the terraform configuration for creating your `grafana_api_key` resources.

**Example: your current terraform configuration**

```tf
terraform {
  required_providers {
    grafana = {
      source  = "grafana/grafana"
    }
  }
}

# configure the provider with basic auth
provider "grafana" {
  url  = "http://localhost:3000"
  auth = "admin:admin"
}

resource "grafana_api_key" "foo" {
  name = "key_foo"
  role = "Viewer"
}

resource "grafana_api_key" "bar" {
  name            = "key_bar"
  role            = "Admin"
  seconds_to_live = 30
}
```

**Your new terraform configuration**

_Note:_ that we can create multiple tokens using one service account.

```tf
terraform {
  required_providers {
    grafana = {
      source  = "grafana/grafana"
    }
  }
}

# configure the provider with basic auth
provider "grafana" {
  url  = "http://localhost:3000"
  auth = "admin:admin"
}

# Creating a service account in Grafana instance to be used as auth and attach tokens
# notice we can attach multiple tokens to one service account
resource "grafana_service_account" "sa-admin" {
  name             = "sa-admin"
  role             = "Admin"
}

# Creating a service account token in Grafana instance to be used for creating resources in Grafana instance
resource "grafana_service_account_token" "sat-bar" {
  name           = "sat-bar"
  service_account_id = grafana_service_account.sa-admin.id
}

# Creating a service account token in Grafana instance to be used for creating resources in Grafana instance
resource "grafana_service_account_token" "sat-foo" {
  name           = "sat-foo"
  service_account_id = grafana_service_account.sa-admin.id
  seconds_to_live    = 30
}
```
