---
aliases:
  - about-service-accounts/
  - add-service-account-token/
  - create-service-account/
  - enable-service-accounts/
description: This page contains information about service accounts in Grafana
keywords:
  - API keys
  - Service accounts
menuTitle: Service accounts
title: Service accounts
weight: 800
---

# Service accounts

You can use a service account to run automated workloads in Grafana, such as dashboard provisioning, configuration, or report generation. Create service accounts and tokens to authenticate applications, such as Terraform, with the Grafana API.

> **Note:** Service accounts will eventually replace [API keys]({{< relref "../api-keys/" >}}) as the primary way to authenticate applications that interact with Grafana.

A common use case for creating a service account is to perform operations on automated or triggered tasks. You can use service accounts to:

- Schedule reports for specific dashboards to be delivered on a daily/weekly/monthly basis
- Define alerts in your system to be used in Grafana
- Set up an external SAML authentication provider
- Interact with Grafana without signing in as a user

In [Grafana Enterprise]({{< relref "../../introduction/grafana-enterprise/" >}}), you can also use service accounts in combination with [role-based access control]({{< relref "../roles-and-permissions/access-control/" >}}) to grant very specific permissions to applications that interact with Grafana.

> **Note:** Service accounts can only act in the organization they are created for. If you have the same task that is needed for multiple organizations, we recommend creating service accounts in each organization.

{{< vimeo 742056367 >}}
<br>

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

## Create a service account in Grafana

A service account can be used to run automated workloads in Grafana, like dashboard provisioning, configuration, or report generation. For more information about how you can use service accounts, refer to [About service accounts]({{< ref "#about-service-accounts" >}}).

For more information about creating service accounts via the API, refer to [Create a service account in the HTTP API]({{< relref "../../developers/http_api/serviceaccount/#create-service-account" >}}).

Note that the user who created a service account will also be able to read, update and delete the service account that they created, as well as permissions associated with that service account.

### Before you begin

- Ensure you have permission to create and edit service accounts. By default, the organization administrator role is required to create and edit service accounts. For more information about user permissions, refer to [About users and permissions]({{< relref "../roles-and-permissions/#" >}}).

### To create a service account

1. Sign in to Grafana and click **Administration** in the left-side menu.
1. Click **Service accounts**.
1. Click **Add service account** .
1. Enter a **Display name**.
1. The display name must be unique as it determines the ID associated with the service account.
   - We recommend that you use a consistent naming convention when you name service accounts. A consistent naming convention can help you scale and maintain service accounts in the future.
   - You can change the display name at any time.
1. Click **Create**.

## Add a token to a service account in Grafana

A service account token is a generated random string that acts as an alternative to a password when authenticating with Grafana’s HTTP API. For more information about service accounts, refer to [About service accounts in Grafana]({{< ref "#about-service-accounts" >}}).

You can create a service account token using the Grafana UI or via the API. For more information about creating a service account token via the API, refer to [Create service account tokens using the HTTP API]({{< relref "../../developers/http_api/serviceaccount/#create-service-account-tokens" >}}).

### Before you begin

- Ensure you have permission to create and edit service accounts. By default, the organization administrator role is required to create and edit service accounts. For more information about user permissions, refer to [About users and permissions]({{< relref "../roles-and-permissions/#" >}}).

### Service account token expiration dates

By default, service account tokens don't have an expiration date, meaning they won't expire at all. However, if `token_expiration_day_limit` is set to a value greater than 0, Grafana restricts the lifetime limit of new tokens to the configured value in days.

### To add a token to a service account

1. Sign in to Grafana and click **Administration** in the left-side menu.
1. Click **Service accounts**.
1. Click the service account to which you want to add a token.
1. Click **Add service account token**.
1. Enter a name for the token.
1. (recommended) Select **Set expiration date** and enter an expiry date for the token.
   - The expiry date specifies how long you want the key to be valid.
   - If you are unsure of an expiration date, we recommend that you set the token to expire after a short time, such as a few hours or less. This limits the risk associated with a token that is valid for a long time.
1. Click **Generate token**.

## Assign roles to a service account in Grafana

You can assign roles to a Grafana service account to control access for the associated service account tokens.
You can assign roles to a service account using the Grafana UI or via the API. For more information about assigning a role to a service account via the API, refer to [Update service account using the HTTP API]({{< relref "../../developers/http_api/serviceaccount/#update-service-account" >}}).

In [Grafana Enterprise]({{< relref "../../introduction/grafana-enterprise/" >}}), you can also [assign RBAC roles]({{< relref "../roles-and-permissions/access-control/assign-rbac-roles" >}}) to grant very specific permissions to applications that interact with Grafana.

### Before you begin

- Ensure you have permission to update service accounts roles. By default, the organization administrator role is required to update service accounts permissions. For more information about user permissions, refer to [About users and permissions]({{< relref "../roles-and-permissions/#" >}}).

### To assign a role to a service account

1. Sign in to Grafana and click **Administration** in the left-side menu.
1. Click **Service accounts**.
1. Click the service account to which you want to assign a role. As an alternative, find the service account in the list view.
1. Assign a role using the role picker to update.

## Manage users and teams permissions for a service account in Grafana

To control what and who can do with the service account you can assign permissions directly to users and teams. You can assign permissions using the Grafana UI.

### Before you begin

- Ensure you have permission to update user and team permissions of a service accounts. By default, the organization administrator role is required to update user and teams permissions for a service account. For more information about user permissions, refer to [About users and permissions]({{< relref "../roles-and-permissions/#" >}}).
- Ensure you have permission to read teams.

### User and team permissions for a service account

You can assign on of the following permissions to a specific user or a team:

1. **Edit**: A user or a team with this permission can view, edit, enable and disable a service account, and add or delete service account tokens.
1. **Admin**: User or a team with this permission will be able to everything from **Edit** permission, as well as manage user and team permissions for a service account.

### To update team permissions for a service account

1. Sign in to Grafana and click **Administration** in the left-side menu.
1. Click **Service accounts**.
1. Click the service account for which you want to update team permissions a role.
1. In the Permissions section at the bottom, click **Add permission**.
1. Choose **Team** in the dropdown and select your desired team.
1. Choose **View**, **Edit** or **Admin** role in the dropdown and click **Save**.

### To update user permissions for a service account

1. Sign in to Grafana and click **Administration** in the left-side menu.
1. Click **Service accounts**.
1. Click the service account for which you want to update team permissions a role.
1. In the Permissions section at the bottom, click **Add permission**.
1. Choose **User** in the dropdown and select your desired user.
1. Choose **View**, **Edit** or **Admin** role in the dropdown and click **Save**.

## Debug the permissions of a service account token

This section explains how to learn which RBAC permissions are attached to a service account token.
This can help you diagnose permissions-related issues with token authorization.

### Before you begin

These endpoints provide details on a service account's token.
If you haven't added a token to a service account, do so before proceeding.
For details, refer to [Add a token to a service account]({{< relref "#add-a-token-to-a-service-account-in-grafana" >}}).

### List a service account token's permissions

To list your token's permissions, use the `/api/access-control/user/permissions` endpoint.

#### Example

> **Note:** The following command output is shortened to show only the relevant content.
> Authorize your request with the token whose permissions you want to check.

```bash
curl -H "Authorization: Bearer glsa_HOruNAb7SOiCdshU9algkrq7FDsNSLAa_54e2f8be" -X GET '<grafana_url>/api/access-control/user/permissions' | jq
```

The output lists the token's permissions:

```json
{
  "dashboards:read": ["dashboards:uid:70KrY6IVz"],
  "dashboards:write": ["dashboards:uid:70KrY6IVz"],
  "datasources.id:read": ["datasources:*"],
  "datasources:read": ["datasources:*"],
  "datasources:explore": [""],
  "datasources:query": ["datasources:uid:grafana"],
  "datasources:read": ["datasources:uid:grafana"],
  "orgs:read": [""]
}
```

### Check which dashboards a token is allowed to see

To list which dashboards a token can view, you can filter the `/api/access-control/user/permissions` endpoint's response for the `dashboards:read` permission key.

#### Example

```bash
curl -H "Authorization: Bearer glsa_HOruNAb7SOiCdshU9algkrq7FDsNSLAa_54e2f8be" -X GET '<grafana_url>/api/access-control/user/permissions' | jq '."dashboards:read"'
```

The output lists the dashboards a token can view and the folders a token can view dashboards from,
by their unique identifiers (`uid`):

```json
[
  "dashboards:uid:70KrY6IVz",
  "dashboards:uid:d61be733D",
  "folders:uid:dBS87Axw2",
],
```
