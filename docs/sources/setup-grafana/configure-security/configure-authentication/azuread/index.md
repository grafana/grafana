---
aliases:
  - ../../../auth/azuread/
description: Grafana Azure AD OAuth Guide
keywords:
  - grafana
  - configuration
  - documentation
  - oauth
labels:
  products:
    - cloud
    - enterprise
    - oss
menuTitle: Azure AD OAuth2
title: Configure Azure AD OAuth2 authentication
weight: 800
---

# Configure Azure AD OAuth2 authentication

The Azure AD authentication allows you to use a Microsoft Entra ID (formerly known as Azure Active Directory) tenant as an identity provider for Grafana. You can use Entra ID application roles to assign users and groups to Grafana roles from the Azure Portal.

{{% admonition type="note" %}}
If Users use the same email address in Microsoft Entra ID that they use with other authentication providers (such as Grafana.com), you need to do additional configuration to ensure that the users are matched correctly. Please refer to [Using the same email address to login with different identity providers](../#using-the-same-email-address-to-login-with-different-identity-providers) for more information.
{{% /admonition %}}

## Create the Microsoft Entra ID application

To enable the Azure AD OAuth2, register your application with Entra ID.

1. Log in to [Azure Portal](https://portal.azure.com), then click **Microsoft Entra ID** in the side menu.

1. If you have access to more than one tenant, select your account in the upper right. Set your session to the Entra ID tenant you wish to use.

1. Under **Manage** in the side menu, click **App Registrations** > **New Registration**. Enter a descriptive name.

1. Under **Redirect URI**, select the app type **Web**.

1. Add the following redirect URLs `https://<grafana domain>/login/azuread` and `https://<grafana domain>` then click **Register**. The app's **Overview** page opens.

1. Note the **Application ID**. This is the OAuth client ID.

1. Click **Endpoints** from the top menu.

   - Note the **OAuth 2.0 authorization endpoint (v2)** URL. This is the authorization URL.
   - Note the **OAuth 2.0 token endpoint (v2)**. This is the token URL.

1. Click **Certificates & secrets** in the side menu, then add a new entry under **Client secrets** with the following configuration.

   - Description: Grafana OAuth
   - Expires: Select an expiration period

1. Click **Add** then copy the key value. This is the OAuth client secret.

1. Define the required application roles for Grafana [using the Azure Portal](#configure-application-roles-for-grafana-in-the-azure-portal) or [using the manifest file](#configure-application-roles-for-grafana-in-the-manifest-file).

1. Go to **Microsoft Entra ID** and then to **Enterprise Applications**, under **Manage**.

1. Search for your application and click it.

1. Click **Users and Groups**.
1. Click **Add user/group** to add a user or group to the Grafana roles.

### Configure application roles for Grafana in the Azure Portal

This section describes setting up basic application roles for Grafana within the Azure Portal. For more information, see [Add app roles to your application and receive them in the token](https://learn.microsoft.com/en-us/entra/identity-platform/howto-add-app-roles-in-apps).

1. Go to **App Registrations**, search for your application, and click it.

1. Click **App roles** and then **Create app role**.

1. Define a role corresponding to each Grafana role: Viewer, Editor, and Admin.

   1. Choose a **Display name** for the role. For example, "Grafana Editor".

   1. Set the **Allowed member types** to **Users/Groups**.

   1. Ensure that the **Value** field matches the Grafana role name. For example, "Editor".

   1. Choose a **Description** for the role. For example, "Grafana Editor Users".

   1. Click **Apply**.

### Configure application roles for Grafana in the manifest file

If you prefer to configure the application roles for Grafana in the manifest file, complete the following steps:

1. Go to **App Registrations**, search for your application, and click it.

1. Click **Manifest**.

1. Add a Universally Unique Identifier to each role.

{{% admonition type="note" %}}
Every role requires a [Universally Unique Identifier](https://en.wikipedia.org/wiki/Universally_unique_identifier) which you can generate on Linux with `uuidgen`, and on Windows through Microsoft PowerShell with `New-Guid`.
{{% /admonition %}}

1. Replace each "SOME_UNIQUE_ID" with the generated ID in the manifest file:

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

1. Click **Save**.

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

## Before you begin

Ensure that you have followed the steps in [Create the Microsoft Entra ID application](#create-the-microsoft-entra-id-application) before you begin.

## Configure Azure AD authentication client using the Grafana UI

{{% admonition type="note" %}}
Available in Public Preview in Grafana 10.4 behind the `ssoSettingsApi` feature toggle.
{{% /admonition %}}

As a Grafana Admin, you can configure your Azure AD OAuth2 client from within Grafana using the Grafana UI. To do this, navigate to the **Administration > Authentication > Azure AD** page and fill in the form. If you have a current configuration in the Grafana configuration file, the form will be pre-populated with those values. Otherwise the form will contain default values.

After you have filled in the form, click **Save** to save the configuration. If the save was successful, Grafana will apply the new configurations.

If you need to reset changes you made in the UI back to the default values, click **Reset**. After you have reset the changes, Grafana will apply the configuration from the Grafana configuration file (if there is any configuration) or the default values.

{{% admonition type="note" %}}
If you run Grafana in high availability mode, configuration changes may not get applied to all Grafana instances immediately. You may need to wait a few minutes for the configuration to propagate to all Grafana instances.
{{% /admonition %}}

## Configure Azure AD authentication client using the Terraform provider

{{% admonition type="note" %}}
Available in Public Preview in Grafana 10.4 behind the `ssoSettingsApi` feature toggle. Supported in the Terraform provider since v2.12.0.
{{% /admonition %}}

```terraform
resource "grafana_sso_settings" "azuread_sso_settings" {
  provider_name = "azuread"
  oauth2_settings {
    name                       = "Azure AD"
    auth_url                   = "https://login.microsoftonline.com/TENANT_ID/oauth2/v2.0/authorize"
    token_url                  = "https://login.microsoftonline.com/TENANT_ID/oauth2/v2.0/token"
    client_id                  = "APPLICATION_ID"
    client_secret              = "CLIENT_SECRET"
    allow_sign_up              = true
    auto_login                 = false
    scopes                     = "openid email profile"
    allowed_organizations      = "TENANT_ID"
    role_attribute_strict      = false
    allow_assign_grafana_admin = false
    skip_org_role_sync         = false
    use_pkce                   = true
  }
}
```

Refer to [Terraform Registry](https://registry.terraform.io/providers/grafana/grafana/latest/docs/resources/sso_settings) for a complete reference on using the `grafana_sso_settings` resource.

## Configure Azure AD authentication client using the Grafana configuration file

Ensure that you have access to the [Grafana configuration file](../../../configure-grafana/#configuration-file-location).

### Enable Azure AD OAuth in Grafana

Add the following to the [Grafana configuration file](../../../configure-grafana/#configuration-file-location):

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

{{% admonition type="note" %}}
Verify that the Grafana [root_url](../../../configure-grafana/#root_url) is set in your Azure Application Redirect URLs.
{{% /admonition %}}

### Configure refresh token

> Available in Grafana v9.3 and later versions.

When a user logs in using an OAuth provider, Grafana verifies that the access token has not expired. When an access token expires, Grafana uses the provided refresh token (if any exists) to obtain a new access token.

Grafana uses a refresh token to obtain a new access token without requiring the user to log in again. If a refresh token doesn't exist, Grafana logs the user out of the system after the access token has expired.

Refresh token fetching and access token expiration check is enabled by default for the AzureAD provider since Grafana v10.1.0. If you would like to disable access token expiration check then set the `use_refresh_token` configuration value to `false`.

> **Note:** The `accessTokenExpirationCheck` feature toggle has been removed in Grafana v10.3.0 and the `use_refresh_token` configuration value will be used instead for configuring refresh token fetching and access token expiration check.

### Configure allowed tenants

To limit access to authenticated users who are members of one or more tenants, set `allowed_organizations`
to a comma- or space-separated list of tenant IDs. You can find tenant IDs on the Azure portal under **Microsoft Entra ID -> Overview**.

Make sure to include the tenant IDs of all the federated Users' root directory if your Entra ID contains external identities.

For example, if you want to only give access to members of the tenant `example` with an ID of `8bab1c86-8fba-33e5-2089-1d1c80ec267d`, then set the following:

```
allowed_organizations = 8bab1c86-8fba-33e5-2089-1d1c80ec267d
```

### Configure allowed groups

Microsoft Entra ID groups can be used to limit user access to Grafana. For more information about managing groups in Entra ID, refer to [Manage Microsoft Entra groups and group membership](https://learn.microsoft.com/en-us/entra/fundamentals/how-to-manage-groups).

To limit access to authenticated users who are members of one or more Entra ID groups, set `allowed_groups`
to a **comma-** or **space-separated** list of group object IDs.

1. To find object IDs for a specific group on the Azure portal, go to **Microsoft Entra ID > Manage > Groups**.

   You can find the Object Id of a group by clicking on the group and then clicking on **Properties**. The object ID is listed under **Object ID**. If you want to only give access to members of the group `example` with an Object Id of `8bab1c86-8fba-33e5-2089-1d1c80ec267d`, then set the following:

   ```
     allowed_groups = 8bab1c86-8fba-33e5-2089-1d1c80ec267d
   ```

1. You must enable adding the [group attribute](https://learn.microsoft.com/en-us/entra/identity-platform/optional-claims#configure-groups-optional-claims) to the tokens in your Entra ID App registration either [from the Azure Portal](#configure-group-membership-claims-on-the-azure-portal) or [from the manifest file](#configure-group-membership-claim-in-the-manifest-file).

#### Configure group membership claims on the Azure Portal

To ensure that the `groups` claim is included in the token, add the `groups` claim to the token configuration either through the Azure Portal UI or by editing the manifest file.

To configure group membership claims from the Azure Portal UI, complete the following steps:

1. Navigate to the **App Registrations** page and select your application.
1. Under **Manage** in the side menu, select **Token configuration**.
1. Click **Add groups claim** and select the relevant option for your use case (for example, **Security groups** and **Groups assigned to the application**).

For more information, see [Configure groups optional claims](https://learn.microsoft.com/en-us/entra/identity-platform/optional-claims#configure-groups-optional-claims).

{{% admonition type="note" %}}
If the user is a member of more than 200 groups, Entra ID does not emit the groups claim in the token and instead emits a group overage claim. To set up a group overage claim, see [Users with over 200 Group assignments](#users-with-over-200-group-assignments).
{{% /admonition %}}

#### Configure group membership claim in the manifest file

1. Go to **App Registrations**, search for your application, and click it.

1. Click **Manifest**.

1. Add the following to the root of the manifest file:

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

With Team Sync you can map your Entra ID groups to teams in Grafana so that your users will automatically be added to
the correct teams.

You can reference Entra ID groups by group object ID, like `8bab1c86-8fba-33e5-2089-1d1c80ec267d`.

To learn more, refer to the [Team Sync](../../configure-team-sync/) documentation.

## Common troubleshooting

Here are some common issues and particulars you can run into when
configuring Azure AD authentication in Grafana.

### Users with over 200 Group assignments

> Supported in Grafana v8.5 and later versions.

To ensure that the token size doesn't exceed HTTP header size limits,
Entra ID limits the number of object IDs that it includes in the groups claim.
If a user is member of more groups than the
overage limit (200), then
Entra ID does not emit the groups claim in the token and emits a group overage claim instead.

> More information in [Groups overage claim](https://learn.microsoft.com/en-us/entra/identity-platform/id-token-claims-reference#groups-overage-claim)

If Grafana receives a token with a group overage claim instead of a groups claim,
Grafana attempts to retrieve the user's group membership by calling the included endpoint.

{{% admonition type="note" %}}
The 'App registration' must include the `GroupMember.Read.All` API permission for group overage claim calls to succeed.

Admin consent might be required for this permission.
{{% /admonition %}}

#### Configure the required Graph API permissions

1. Navigate to **Microsoft Entra ID > Manage > App registrations** and select your application.
1. Select **API permissions** and then click on **Add a permission**.
1. Select **Microsoft Graph** from the list of APIs.
1. Select **Delegated permissions**.
1. Under the **GroupMember** section, select **GroupMember.Read.All**.
1. Click **Add permissions**.

{{% admonition type="note" %}}
Admin consent may be required for this permission.
{{% /admonition %}}

### Force fetching groups from Microsoft Graph API

To force fetching groups from Microsoft Graph API instead of the `id_token`. You can use the `force_use_graph_api` config option.

```
force_use_graph_api = true
```

### Map roles

By default, Azure AD authentication will map users to organization roles based on the most privileged application role assigned to the user in Entra ID.

If no application role is found, the user is assigned the role specified by
[the `auto_assign_org_role` option](../../../configure-grafana/#auto_assign_org_role).
You can disable this default role assignment by setting `role_attribute_strict = true`. This setting denies user access if no role or an invalid role is returned and the `org_mapping` expression evaluates to an empty mapping.

You can use the `org_mapping` configuration option to assign the user to multiple organizations and specify their role based on their Entra ID group membership. For more information, refer to [Org roles mapping example](#org-roles-mapping-example). If the org role mapping (`org_mapping`) is specified and Entra ID returns a valid role, then the user will get the highest of the two roles.

**On every login** the user organization role will be reset to match Entra ID's application role and
their organization membership will be reset to the default organization.

#### Org roles mapping example

The Entra ID integration uses the external users' groups in the `org_mapping` configuration to map organizations and roles based on their Entra ID group membership.

In this example, the user has been granted the role of a `Viewer` in the `org_foo` organization, and the role of an `Editor` in the `org_bar` and `org_baz` orgs.

The external user is part of the following Entra ID groups: `032cb8e0-240f-4347-9120-6f33013e817a` and `bce1c492-0679-4989-941b-8de5e6789cb9`.

Config:

```ini
org_mapping = ["032cb8e0-240f-4347-9120-6f33013e817a:org_foo:Viewer", "bce1c492-0679-4989-941b-8de5e6789cb9:org_bar:Editor", "*:org_baz:Editor"]
```

## Skip organization role sync

If Azure AD authentication is not intended to sync user roles and organization membership and prevent the sync of org roles from Entra ID, set `skip_org_role_sync` to `true`. This is useful if you want to manage the organization roles for your users from within Grafana or that your organization roles are synced from another provider.
See [Configure Grafana](../../../configure-grafana/#authazuread) for more details.

```ini
[auth.azuread]
# ..
# prevents the sync of org roles from AzureAD
skip_org_role_sync = true
```
