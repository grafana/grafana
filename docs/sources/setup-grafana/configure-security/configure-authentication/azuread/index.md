---
aliases:
  - ../../../auth/azuread/
description: Grafana Azure AD OAuth Guide
keywords:
  - grafana
  - configuration
  - documentation
  - oauth
title: Configure Azure AD OAuth2 authentication
menuTitle: Azure AD OAuth2
weight: 800
---

# Configure Azure AD OAuth2 authentication

The Azure AD authentication allows you to use an Azure Active Directory tenant as an identity provider for Grafana. You can use Azure AD Application Roles to assign users and groups to Grafana roles from the Azure Portal. This topic has the following sections:

- [Configure Azure AD OAuth2 authentication](#configure-azure-ad-oauth2-authentication)
  - [Create the Azure AD application](#create-the-azure-ad-application)
    - [Assign server administrator privileges](#assign-server-administrator-privileges)
  - [Enable Azure AD OAuth in Grafana](#enable-azure-ad-oauth-in-grafana)
    - [Configure refresh token](#configure-refresh-token)
    - [Configure allowed groups](#configure-allowed-groups)
    - [Configure allowed domains](#configure-allowed-domains)
    - [PKCE](#pkce)
    - [Configure automatic login](#configure-automatic-login)
    - [Team Sync (Enterprise only)](#team-sync-enterprise-only)
  - [Common troubleshooting](#common-troubleshooting)
    - [Users with over 200 Group assignments](#users-with-over-200-group-assignments)
    - [Force fetching groups from Microsoft graph API](#force-fetching-groups-from-microsoft-graph-api)
    - [Map roles](#map-roles)
  - [Skip organization role sync](#skip-organization-role-sync)

## Create the Azure AD application

To enable the Azure AD OAuth2, register your application with Azure AD.

1. Log in to [Azure Portal](https://portal.azure.com), then click **Azure Active Directory** in the side menu.

1. If you have access to more than one tenant, select your account in the upper right. Set your session to the Azure AD tenant you wish to use.

1. Under **Manage** in the side menu, click **App Registrations** > **New Registration**. Enter a descriptive name.

1. Under **Redirect URI**, select the app type **Web**.

1. Add the following redirect URLs `https://<grafana domain>/login/azuread` and `https://<grafana domain>` then click **Register**. The app's **Overview** page opens.

1. Note the **Application ID**. This is the OAuth client ID.

1. Click **Endpoints** from the top menu.

   - Note the **OAuth 2.0 authorization endpoint (v2)** URL. This is the authorization URL.
   - Note the **OAuth 2.0 token endpoint (v2)**. This is the token URL.

1. Click **Certificates & secrets**, then add a new entry under **Client secrets** with the following configuration.

   - Description: Grafana OAuth
   - Expires: Never

1. Click **Add** then copy the key value. This is the OAuth client secret.

1. Click **Manifest**, then define the required Application Role values for Grafana: Viewer, Editor, or Admin. If not defined, all users will have the Viewer role. Every role requires a unique ID which you can generate on Linux with `uuidgen`, and on Windows through Microsoft PowerShell with `New-Guid`.

1. Include the unique ID in the configuration file:

   ```json
   	"appRoles": [
   			{
   				"allowedMemberTypes": [
   					"User"
   				],
   				"description": "Grafana org admin Users",
   				"displayName": "Grafana Org Admin",
   				"id": "SOME_UNIQUE_ID",
   				"isEnabled": true,
   				"lang": null,
   				"origin": "Application",
   				"value": "Admin"
   			},
   			{
   				"allowedMemberTypes": [
   					"User"
   				],
   				"description": "Grafana read only Users",
   				"displayName": "Grafana Viewer",
   				"id": "SOME_UNIQUE_ID",
   				"isEnabled": true,
   				"lang": null,
   				"origin": "Application",
   				"value": "Viewer"
   			},
   			{
   				"allowedMemberTypes": [
   					"User"
   				],
   				"description": "Grafana Editor Users",
   				"displayName": "Grafana Editor",
   				"id": "SOME_UNIQUE_ID",
   				"isEnabled": true,
   				"lang": null,
   				"origin": "Application",
   				"value": "Editor"
   			}
   		],
   ```

1. Go to **Azure Active Directory** and then to **Enterprise Applications**. Search for your application and click on it.

1. Click on **Users and Groups** and add Users/Groups to the Grafana roles by using **Add User**.

### Assign server administrator privileges

> Available in Grafana v9.2 and later versions.

If the application role received by Grafana is `GrafanaAdmin`, Grafana grants the user server administrator privileges.  
This is useful if you want to grant server administrator privileges to a subset of users.  
Grafana also assigns the user the `Admin` role of the default organization.

The setting `allow_assign_grafana_admin` under `[auth.azuread]` must be set to `true` for this to work.  
If the setting is set to `false`, the user is assigned the role of `Admin` of the default organization, but not server administrator privileges.

```json
{
  "allowedMemberTypes": ["User"],
  "description": "Grafana server admin Users",
  "displayName": "Grafana Server Admin",
  "id": "SOME_UNIQUE_ID",
  "isEnabled": true,
  "lang": null,
  "origin": "Application",
  "value": "GrafanaAdmin"
}
```

## Enable Azure AD OAuth in Grafana

1. Add the following to the [Grafana configuration file]({{< relref "../../../configure-grafana#configuration-file-location" >}}):

```
[auth.azuread]
name = Azure AD
enabled = true
allow_sign_up = true
auto_login = false
client_id = APPLICATION_ID
client_secret = CLIENT_SECRET
scopes = openid email profile
auth_url = https://login.microsoftonline.com/TENANT_ID/oauth2/v2.0/authorize
token_url = https://login.microsoftonline.com/TENANT_ID/oauth2/v2.0/token
allowed_domains =
allowed_groups =
allowed_organizations = TENANT_ID
role_attribute_strict = false
allow_assign_grafana_admin = false
skip_org_role_sync = false
use_pkce = true
```

You can also use these environment variables to configure **client_id** and **client_secret**:

```
GF_AUTH_AZUREAD_CLIENT_ID
GF_AUTH_AZUREAD_CLIENT_SECRET
```

**Note:** Verify that the Grafana [root_url]({{< relref "../../../configure-grafana#root_url" >}}) is set in your Azure Application Redirect URLs.

### Configure refresh token

> Available in Grafana v9.3 and later versions.

> **Note:** This feature is behind the `accessTokenExpirationCheck` feature toggle.

When a user logs in using an OAuth provider, Grafana verifies that the access token has not expired. When an access token expires, Grafana uses the provided refresh token (if any exists) to obtain a new access token.

Grafana uses a refresh token to obtain a new access token without requiring the user to log in again. If a refresh token doesn't exist, Grafana logs the user out of the system after the access token has expired.

To enable a refresh token for AzureAD, extend the `scopes` in `[auth.azuread]` with `offline_access`.

### Configure allowed tenants

To limit access to authenticated users who are members of one or more tenants, set `allowed_organizations`
to a comma- or space-separated list of tenant IDs. You can find tenant IDs on the Azure portal under **Azure Active Directory -> Overview**.

Make sure to include the tenant IDs of all the federated Users' root directory if your Azure AD contains external identities.

For example, if you want to only give access to members of the tenant `example` with an ID of `8bab1c86-8fba-33e5-2089-1d1c80ec267d`, then set the following:

```
allowed_organizations = 8bab1c86-8fba-33e5-2089-1d1c80ec267d
```

### Configure allowed groups

To limit access to authenticated users who are members of one or more groups, set `allowed_groups`
to a comma- or space-separated list of group object IDs. You can find object IDs for a specific group on the Azure portal:

1. Go to **Azure Active Directory -> Groups**. If you want to only give access to members of the group `example` with an ID of `8bab1c86-8fba-33e5-2089-1d1c80ec267d`, then set the following:

   ```
   allowed_groups = 8bab1c86-8fba-33e5-2089-1d1c80ec267d
   ```

1. Verify that [group attributes](https://docs.microsoft.com/en-us/azure/active-directory/hybrid/how-to-connect-fed-group-claims#configure-the-azure-ad-application-registration-for-group-attributes) is enabled in your Azure AD Application Registration manifest file by navigating to **Azure Portal** > **Azure Active Directory** > **Application Registrations** > **Select Application** -> **Manifest**, and set the following:

   ```
   "groupMembershipClaims": "ApplicationGroup, SecurityGroup"
   ```

### Configure allowed domains

The `allowed_domains` option limits access to users who belong to specific domains. Separate domains with space or comma. For example,

```
allowed_domains = mycompany.com mycompany.org
```

### PKCE

IETF's [RFC 7636](https://datatracker.ietf.org/doc/html/rfc7636)
introduces "proof key for code exchange" (PKCE) which provides
additional protection against some forms of authorization code
interception attacks. PKCE will be required in [OAuth 2.1](https://datatracker.ietf.org/doc/html/draft-ietf-oauth-v2-1-03).

> You can disable PKCE in Grafana by setting `use_pkce` to `false` in the`[auth.azuread]` section.

### Configure automatic login

To bypass the login screen and log in automatically, enable the "auto_login" feature.
This setting is ignored if multiple auth providers are configured to use auto login.

```
auto_login = true
```

### Team Sync (Enterprise only)

With Team Sync you can map your Azure AD groups to teams in Grafana so that your users will automatically be added to
the correct teams.

You can reference Azure AD groups by group object ID, like `8bab1c86-8fba-33e5-2089-1d1c80ec267d`.

To learn more, refer to the [Team Sync]({{< relref "../../configure-team-sync" >}}) documentation.

## Common troubleshooting

Here are some common issues and particulars you can run into when
configuring Azure AD authentication in Grafana.

### Users with over 200 Group assignments

> Supported in Grafana v8.5 and later versions.

To ensure that the token size doesn't exceed HTTP header size limits,
Azure AD limits the number of object IDs that it includes in the groups claim.
If a user is member of more groups than the
overage limit (200), then
Azure AD does not emit the groups claim in the token and emits a group overage claim instead.

> More information in [Groups overage claim](https://learn.microsoft.com/en-us/azure/active-directory/develop/id-token-claims-reference#groups-overage-claim)

If Grafana receives a token with a group overage claim instead of a groups claim,
Grafana attempts to retrieve the user's group membership by calling the included endpoint.

> Note: The token must include the `GroupMember.Read.All` permission for group overage claim calls to succeed.
> Admin consent may be required for this permission.

### Force fetching groups from Microsoft graph API

To force fetching groups from Microsoft Graph API instead of the `id_token`. You can use the `force_use_graph_api` config option.

```
force_use_graph_api = true
```

### Map roles

By default, Azure AD authentication will map users to organization roles based on the most privileged application role assigned to the user in AzureAD.

If no application role is found, the user is assigned the role specified by
[the `auto_assign_org_role` option]({{< relref "../../../configure-grafana#auto_assign_org_role" >}}).
You can disable this default role assignment by setting `role_attribute_strict = true`.
It denies user access if no role or an invalid role is returned.

**On every login** the user organization role will be reset to match AzureAD's application role and
their organization membership will be reset to the default organization.

## Skip organization role sync

If Azure AD authentication is not intended to sync user roles and organization membership and prevent the sync of org roles from AzureAD, set `skip_org_role_sync` to `true`. This is useful if you want to manage the organization roles for your users from within Grafana or that your organization roles are synced from another provider.
See [Configure Grafana]({{< relref "../../../configure-grafana#authazuread" >}}) for more details.

```ini
[auth.azuread]
# ..
# prevents the sync of org roles from AzureAD
skip_org_role_sync = true
```
