---
aliases:
  - /docs/grafana/latest/administration/service-accounts/
  - /docs/grafana/latest/administration/service-accounts/about-service-accounts/
  - /docs/grafana/latest/administration/service-accounts/add-service-account-token/
  - /docs/grafana/latest/administration/service-accounts/create-service-account/
  - /docs/grafana/latest/administration/service-accounts/enable-service-accounts/
description: This page contains information about service accounts in Grafana
keywords:
  - API keys
  - Service accounts
menuTitle: Service accounts
title: Service accounts
weight: 800
---

# Service accounts

You can use service accounts to run automated or compute workloads.

{{< section >}}

## About service accounts

A service account can be used to run automated workloads in Grafana, like dashboard provisioning, configuration, or report generation. Create service accounts and tokens to authenticate applications like Terraform with the Grafana API.

> **Note:** Service accounts are available in Grafana 8.5+ as a beta feature. To enable service accounts, refer to the [Enable service accounts]({{< ref "#enable-service-accounts" >}}) section. Service accounts will eventually replace [API keys]({{< relref "../api-keys/" >}}) as the primary way to authenticate applications that interact with Grafana.

A common use case for creating a service account is to perform operations on automated or triggered tasks. You can use service accounts to:

- Schedule reports for specific dashboards to be delivered on a daily/weekly/monthly basis
- Define alerts in your system to be used in Grafana
- Set up an external SAML authentication provider
- Interact with Grafana without signing in as a user

In [Grafana Enterprise]({{< relref "../../enterprise/" >}}), you can also use service accounts in combination with [role-based access control]({{< relref "../roles-and-permissions/access-control/" >}}) to grant very specific permissions to applications that interact with Grafana.

> **Note:** Service accounts can only act in the organization they are created for. If you have the same task that is needed for multiple organizations, we recommend creating service accounts in each organization.

## Service account tokens

A service account token is a generated random string that acts as an alternative to a password when authenticating with Grafana's HTTP API.

When you create a service account, you can associate one or more access tokens with it. You can use service access tokens the same way as API Keys, for example to access Grafana HTTP API programmatically.

You can create multiple tokens for the same service account. You might want to do this if:

- multiple applications use the same permissions, but you would like to audit or manage their actions separately.
- you need to rotate or replace a compromised token.

Service account access tokens inherit permissions from the service account.

## Service account benefits

The added benefits of service accounts to API keys include:

- Service accounts resemble Grafana users and can be enabled/disabled, granted specific permissions, and remain active until they are deleted or disabled. API keys are only valid until their expiry date.
- Service accounts can be associated with multiple tokens.
- Unlike API keys, service account tokens are not associated with a specific user, which means that applications can be authenticated even if a Grafana user is deleted.
- You can grant granular permissions to service accounts by leveraging [role-based access control]({{< relref "../roles-and-permissions/access-control/" >}}). For more information about permissions, refer to [About users and permissions]({{< relref "../roles-and-permissions/" >}}).

## Enable service accounts in Grafana

Service accounts are available behind the `serviceAccounts` feature toggle, available in Grafana 8.5+.

You can enable service accounts by:

- modifying the Grafana configuration file, or
- configuring an environment variable

### Enable service accounts in the Grafana configuration file

This topic shows you how to enable service accounts by modifying the Grafana configuration file.

1. Sign in to the Grafana server and locate the configuration file. For more information about finding the configuration file, refer to LINK.
2. Open the configuration file and locate the [feature toggles section]({{< relref "../../setup-grafana/configure-grafana/#feature_toggles" >}}). Add `serviceAccounts` as a [feature_toggle]({{< relref "../../setup-grafana/configure-grafana/#feature_toggle" >}}).

```
[feature_toggles]
# enable features, separated by spaces
enable = serviceAccounts
```

1. Save your changes, Grafana should recognize your changes; in case of any issues we recommend restarting the Grafana server.

### Enable service accounts with an environment variable

This topic shows you how to enable service accounts by setting environment variables before starting Grafana.

Follow the instructions to [override configuration with environment variables]({{< relref "../../setup-grafana/configure-grafana/#override-configuration-with-environment-variables" >}}). Set the following environment variable: `GF_FEATURE_TOGGLES_ENABLE = serviceAccounts`.

> **Note:** Environment variables override configuration file settings.

## Create a service account in Grafana

A service account can be used to run automated workloads in Grafana, like dashboard provisioning, configuration, or report generation. For more information about how you can use service accounts, refer to [About service accounts]({{< ref "#about-service-accounts" >}}).

For more information about creating service accounts via the API, refer to [Create a service account in the HTTP API]({{< relref "../../developers/http_api/serviceaccount/#create-service-account" >}}).

### Before you begin

- Ensure you have added the feature toggle for service accounts `serviceAccounts`. For more information about adding the feature toggle, refer to [Enable service accounts]({{< ref "#enable-service-accounts" >}}).
- Ensure you have permission to create and edit service accounts. By default, the organization administrator role is required to create and edit service accounts. For more information about user permissions, refer to [About users and permissions]({{< relref "../roles-and-permissions/#" >}}).

### To create a service account

1. Sign in to Grafana and hover your cursor over the Configuration (cog) icon in the sidebar.
1. Click **Service accounts**.
1. Click **New service account**.
1. Enter a **Display name**.
1. The display name must be unique as it determines the ID associated with the service account.
   - We recommend that you use a consistent naming convention when you name service accounts. A consistent naming convention can help you scale and maintain service accounts in the future.
   - You can change the display name at any time.
1. Click **Create service account**.

## Add a token to a service account in Grafana

A service account token is a generated random string that acts as an alternative to a password when authenticating with Grafana’s HTTP API. For more information about service accounts, refer to [About service accounts in Grafana]({{< ref "#about-service-accounts" >}}).

You can create a service account token using the Grafana UI or via the API. For more information about creating a service account token via the API, refer to [Create service account tokens using the HTTP API]({{< relref "../../developers/http_api/serviceaccount/#create-service-account-tokens" >}}).

### Before you begin

- Ensure you have added the `serviceAccounts` feature toggle to Grafana. For more information about adding the feature toggle, refer to [Enable service accounts]({{< ref "#enable-service-accounts" >}}).
- Ensure you have permission to create and edit service accounts. By default, the organization administrator role is required to create and edit service accounts. For more information about user permissions, refer to [About users and permissions]({{< relref "../roles-and-permissions/#" >}}).

### To add a token to a service account

1. Sign in to Grafana, then hover your cursor over **Configuration** (the gear icon) in the sidebar.
1. Click **Service accounts**.
1. Click the service account to which you want to add a token.
1. Click **Add token**.
1. Enter a name for the token.
1. (recommended) Enter an expiry date and expiry date for the token or leave it on no expiry date option.
   - The expiry date specifies how long you want the key to be valid.
   - If you are unsure of an expiration date, we recommend that you set the token to expire after a short time, such as a few hours or less. This limits the risk associated with a token that is valid for a long time.
1. Click **Generate service account token**.
