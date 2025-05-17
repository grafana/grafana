---
aliases:
  - ../../../auth/okta/
description: Grafana Okta OIDC Guide
labels:
  products:
    - cloud
    - enterprise
    - oss
menuTitle: Okta OIDC
title: Configure Okta OIDC authentication
weight: 1400
---

# Configure Okta OIDC authentication

{{< docs/shared lookup="auth/intro.md" source="grafana" version="<GRAFANA VERSION>" >}}

{{< admonition type="note" >}}
If Users use the same email address in Okta that they use with other authentication providers (such as Grafana.com), you need to do additional configuration to ensure that the users are matched correctly. Please refer to the [Using the same email address to login with different identity providers](../#using-the-same-email-address-to-login-with-different-identity-providers) documentation for more information.
{{< /admonition >}}

## Before you begin

To follow this guide, ensure you have permissions in your Okta workspace to create an OIDC app.

## Create an Okta app

1. From the Okta Admin Console, select **Create App Integration** from the **Applications** menu.
1. For **Sign-in method**, select **OIDC - OpenID Connect**.
1. For **Application type**, select **Web Application** and click **Next**.
1. Configure **New Web App Integration Operations**:

   - **App integration name**: Choose a name for the app.
   - **Logo (optional)**: Add a logo.
   - **Grant type**: Select **Authorization Code** and **Refresh Token**.
   - **Sign-in redirect URIs**: Replace the default setting with the Grafana Cloud Okta path, replacing <YOUR_ORG> with the name of your Grafana organization: https://<YOUR_ORG>.grafana.net/login/okta. For on-premises installation, use the Grafana server URL: http://<my_grafana_server_name_or_ip>:<grafana_server_port>/login/okta.
   - **Sign-out redirect URIs (optional)**: Replace the default setting with the Grafana Cloud Okta path, replacing <YOUR_ORG> with the name of your Grafana organization: https://<YOUR_ORG>.grafana.net/logout. For on-premises installation, use the Grafana server URL: http://<my_grafana_server_name_or_ip>:<grafana_server_port>/logout.
   - **Base URIs (optional)**: Add any base URIs
   - **Controlled access**: Select whether to assign the app integration to everyone in your organization, or only selected groups. You can assign this option after you create the app.

1. Make a note of the following:
   - **ClientID**
   - **Client Secret**
   - **Auth URL**
     For example: https://<TENANT_ID>.okta.com/oauth2/v1/authorize
   - **Token URL**
     For example: https://<TENANT_ID>.okta.com/oauth2/v1/token
   - **API URL**
     For example: https://<TENANT_ID>.okta.com/oauth2/v1/userinfo

### Configure Okta to Grafana role mapping

1. In the **Okta Admin Console**, select **Directory > Profile Editor**.
1. Select the Okta Application Profile you created previously (the default name for this is `<App name> User`).
1. Select **Add Attribute** and fill in the following fields:

   - **Data Type**: string
   - **Display Name**: Meaningful name. For example, `Grafana Role`.
   - **Variable Name**: Meaningful name. For example, `grafana_role`.
   - **Description (optional)**: A description of the role.
   - **Enum**: Select **Define enumerated list of values** and add the following:
     - Display Name: Admin Value: Admin
     - Display Name: Editor Value: Editor
     - Display Name: Viewer Value: Viewer

   The remaining attributes are optional and can be set as needed.

1. Click **Save**.
1. (Optional) You can add the role attribute to the default User profile. To do this, please follow the steps in the [Optional: Add the role attribute to the User (default) Okta profile](#optional-add-the-role-attribute-to-the-user-default-okta-profile) section.

### Configure Groups claim

1. In the **Okta Admin Console**, select **Application > Applications**.
1. Select the OpenID Connect application you created.
1. Go to the **Sign On** tab and click **Edit** in the **OpenID Connect ID Token** section.
1. In the **Group claim type** section, select **Filter**.
1. In the **Group claim filter** section, leave the default name `groups` (or add it if the box is empty), then select **Matches regex** and add the following regex: `.*`.
1. Click **Save**.
1. Click the **Back to applications** link at the top of the page.
1. From the **More** button dropdown menu, click **Refresh Application Data**.
1. Include the `groups` scope in the **Scopes** field in Grafana of the Okta integration.
   For Terraform or in the Grafana configuration file, include the `groups` scope in `scopes` field.

{{< admonition type="note" >}}
If you configure the `groups` claim differently, ensure that the `groups` claim is a string array.
{{< /admonition >}}

#### Optional: Add the role attribute to the User (default) Okta profile

If you want to configure the role for all users in the Okta directory, you can add the role attribute to the User (default) Okta profile.

1. Return to the **Directory** section and select **Profile Editor**.
1. Select the User (default) Okta profile, and click **Add Attribute**.
1. Set all of the attributes in the same way you did in **Step 3**.
1. Select **Add Mapping** to add your new attributes.
   For example, **user.grafana_role -> grafana_role**.
1. To add a role to a user, select the user from the **Directory**, and click **Profile -> Edit**.
1. Select an option from your new attribute and click **Save**.
1. Update the Okta integration by setting the `Role attribute path` (`role_attribute_path` in Terraform and config file) to `<YOUR_ROLE_VARIABLE>`. For example: `role_attribute_path = grafana_role` (using the configuration).

## Configure Okta authentication client using the Grafana UI

{{< admonition type="note" >}}
Available behind the `ssoSettingsAPI` feature toggle, which is enabled by default.
{{< /admonition >}}

As a Grafana Admin, you can configure Okta OAuth2 client from within Grafana using the Okta UI. To do this, navigate to **Administration > Authentication > Okta** page and fill in the form. If you have a current configuration in the Grafana configuration file then the form will be pre-populated with those values otherwise the form will contain default values.

After you have filled in the form, click **Save**. If the save was successful, Grafana will apply the new configurations.

If you need to reset changes you made in the UI back to the default values, click **Reset**. After you have reset the changes, Grafana will apply the configuration from the Grafana configuration file (if there is any configuration) or the default values.

{{< admonition type="note" >}}
If you run Grafana in high availability mode, configuration changes may not get applied to all Grafana instances immediately. You may need to wait a few minutes for the configuration to propagate to all Grafana instances.
{{< /admonition >}}

Refer to [configuration options](#configuration-options) for more information.

## Configure Okta authentication client using the Terraform provider

{{< admonition type="note" >}}
Available behind the `ssoSettingsAPI` feature toggle, which is enabled by default. Supported in the Terraform provider since v2.12.0.
{{< /admonition >}}

```terraform
resource "grafana_sso_settings" "okta_sso_settings" {
  provider_name = "okta"
  oauth2_settings {
    name                  = "Okta"
    auth_url              = "https://<okta tenant id>.okta.com/oauth2/v1/authorize"
    token_url             = "https://<okta tenant id>.okta.com/oauth2/v1/token"
    api_url               = "https://<okta tenant id>.okta.com/oauth2/v1/userinfo"
    client_id             = "CLIENT_ID"
    client_secret         = "CLIENT_SECRET"
    allow_sign_up         = true
    auto_login            = false
    scopes                = "openid profile email offline_access"
    role_attribute_path   = "contains(groups[*], 'Example::DevOps') && 'Admin' || 'None'"
    role_attribute_strict = true
    allowed_groups        = "Example::DevOps,Example::Dev,Example::QA"
  }
}
```

Go to [Terraform Registry](https://registry.terraform.io/providers/grafana/grafana/latest/docs/resources/sso_settings) for a complete reference on using the `grafana_sso_settings` resource.

## Configure Okta authentication client using the Grafana configuration file

Ensure that you have access to the [Grafana configuration file](../../../configure-grafana/#configuration-file-location).

### Steps

To integrate your Okta OIDC provider with Grafana using our Okta OIDC integration, follow these steps:

1. Follow the [Create an Okta app](#create-an-okta-app) steps to create an OIDC app in Okta.

1. Refer to the following table to update field values located in the `[auth.okta]` section of the Grafana configuration file:

   | Field       | Description                                                                                                 |
   | ----------- | ----------------------------------------------------------------------------------------------------------- |
   | `client_id` | These values must match the client ID from your Okta OIDC app.                                              |
   | `auth_url`  | The authorization endpoint of your OIDC provider. `https://<okta-tenant-id>.okta.com/oauth2/v1/authorize`   |
   | `token_url` | The token endpoint of your Okta OIDC provider. `https://<okta-tenant-id>.okta.com/oauth2/v1/token`          |
   | `api_url`   | The user information endpoint of your Okta OIDC provider. `https://<tenant-id>.okta.com/oauth2/v1/userinfo` |
   | `enabled`   | Enables Okta OIDC authentication. Set this value to `true`.                                                 |

1. Review the list of other Okta OIDC [configuration options](#configuration-options) and complete them as necessary.

1. Optional: [Configure a refresh token](#configure-a-refresh-token).
1. [Configure role mapping](#configure-role-mapping).
1. Optional: [Configure team synchronization](#configure-team-synchronization-enterprise-only).
1. Restart Grafana.

   You should now see a Okta OIDC login button on the login page and be able to log in or sign up with your OIDC provider.

The following is an example of a minimally functioning integration when
configured with the instructions above:

```ini
[auth.okta]
name = Okta
icon = okta
enabled = true
allow_sign_up = true
client_id = <client id>
scopes = openid profile email offline_access
auth_url = https://<okta tenant id>.okta.com/oauth2/v1/authorize
token_url = https://<okta tenant id>.okta.com/oauth2/v1/token
api_url = https://<okta tenant id>.okta.com/oauth2/v1/userinfo
role_attribute_path = grafana_role
role_attribute_strict = true
allowed_groups = "Example::DevOps" "Example::Dev" "Example::QA"
```

### Configure a refresh token

When a user logs in using an OAuth provider, Grafana verifies that the access token has not expired. When an access token expires, Grafana uses the provided refresh token (if any exists) to obtain a new access token without requiring the user to log in again.

If a refresh token doesn't exist, Grafana logs the user out of the system after the access token has expired.

To enable the `Refresh Token` head over the Okta application settings and:

1. Under `General` tab, find the `General Settings` section.
1. Within the `Grant Type` options, enable the `Refresh Token` checkbox.

At the configuration file, extend the `scopes` in `[auth.okta]` section with `offline_access` and set `use_refresh_token` to `true`.

### Configure role mapping

{{< admonition type="note" >}}
Unless `skip_org_role_sync` option is enabled, the user's role will be set to the role retrieved from the auth provider upon user login.
{{< /admonition >}}

The user's role is retrieved using a [JMESPath](http://jmespath.org/examples.html) expression from the `role_attribute_path` configuration option against the `api_url` (`/userinfo` OIDC endpoint) endpoint payload.

If no valid role is found, the user is assigned the role specified by [the `auto_assign_org_role` option](../../../configure-grafana/#auto_assign_org_role).
You can disable this default role assignment by setting `role_attribute_strict = true`. This setting denies user access if no role or an invalid role is returned after evaluating the `role_attribute_path` and the `org_mapping` expressions.

You can use the `org_attribute_path` and `org_mapping` configuration options to assign the user to organizations and specify their role. For more information, refer to [Org roles mapping example](#org-roles-mapping-example). If both org role mapping (`org_mapping`) and the regular role mapping (`role_attribute_path`) are specified, then the user will get the highest of the two mapped roles.

To allow mapping Grafana server administrator role, use the `allow_assign_grafana_admin` configuration option.
Refer to [configuration options](../generic-oauth/#configuration-options) for more information.

In [Create an Okta app](#create-an-okta-app), you created a custom attribute in Okta to store the role. You can use this attribute to map the role to a Grafana role by setting the `role_attribute_path` configuration option to the custom attribute name: `role_attribute_path = grafana_role`.

If you want to map the role based on the user's group, you can use the `groups` attribute from the user info endpoint. An example of this is `role_attribute_path = contains(groups[*], 'Example::DevOps') && 'Admin' || 'None'`. You can find more examples of JMESPath expressions on the Generic OAuth page for [JMESPath examples](../generic-oauth/#role-mapping-examples).

To learn about adding custom claims to the user info in Okta, refer to [add custom claims](https://developer.okta.com/docs/guides/customize-tokens-returned-from-okta/main/#add-a-custom-claim-to-a-token).

#### Org roles mapping example

{{< admonition type="note" >}}
Available in self-managed Grafana installations.
{{< /admonition >}}

In this example, the `org_mapping` uses the `groups` attribute as the source (`org_attribute_path`) to map the current user to different organizations and roles. The user has been granted the role of a `Viewer` in the `org_foo` org if they are a member of the `Group 1` group, the role of an `Editor` in the `org_bar` org if they are a member of the `Group 2` group, and the role of an `Editor` in the `org_baz`(OrgID=3) org.

Config:

```ini
org_attribute_path = groups
org_mapping = ["Group 1:org_foo:Viewer", "Group 2:org_bar:Editor", "*:3:Editor"]
```

### Configure team synchronization (Enterprise only)

{{% admonition type="note" %}}
Available in [Grafana Enterprise](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/introduction/grafana-enterprise/) and [Grafana Cloud](../../../../introduction/grafana-cloud).
{{% /admonition %}}

By using Team Sync, you can link your Okta groups to teams within Grafana. This will automatically assign users to the appropriate teams.

Map your Okta groups to teams in Grafana so that your users will automatically be added to
the correct teams.

Okta groups can be referenced by group names, like `Admins` or `Editors`.

To learn more about Team Sync, refer to [Configure Team Sync](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/setup-grafana/configure-security/configure-team-sync/).

## Configuration options

The following table outlines the various Okta OIDC configuration options. You can apply these options as environment variables, similar to any other configuration within Grafana. For more information, refer to [Override configuration with environment variables](../../../configure-grafana/#override-configuration-with-environment-variables).

{{< admonition type="note" >}}
If the configuration option requires a JMESPath expression that includes a colon, enclose the entire expression in quotes to prevent parsing errors. For example `role_attribute_path: "role:view"`
{{< /admonition >}}

| Setting                 | Required | Supported on Cloud | Description                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         | Default                       |
| ----------------------- | -------- | ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------- |
| `enabled`               | No       | Yes                | Enables Okta OIDC authentication.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   | `false`                       |
| `name`                  | No       | Yes                | Name that refers to the Okta OIDC authentication from the Grafana user interface.                                                                                                                                                                                                                                                                                                                                                                                                                                   | `Okta`                        |
| `icon`                  | No       | Yes                | Icon used for the Okta OIDC authentication in the Grafana user interface.                                                                                                                                                                                                                                                                                                                                                                                                                                           | `okta`                        |
| `client_id`             | Yes      | Yes                | Client ID provided by your Okta OIDC app.                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |                               |
| `client_secret`         | Yes      | Yes                | Client secret provided by your Okta OIDC app.                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |                               |
| `auth_url`              | Yes      | Yes                | Authorization endpoint of your Okta OIDC provider.                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |                               |
| `token_url`             | Yes      | Yes                | Endpoint used to obtain the Okta OIDC access token.                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |                               |
| `api_url`               | Yes      | Yes                | Endpoint used to obtain user information.                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |                               |
| `scopes`                | No       | Yes                | List of comma- or space-separated Okta OIDC scopes.                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | `openid profile email groups` |
| `allow_sign_up`         | No       | Yes                | Controls Grafana user creation through the Okta OIDC login. Only existing Grafana users can log in with Okta OIDC if set to `false`.                                                                                                                                                                                                                                                                                                                                                                                | `true`                        |
| `auto_login`            | No       | Yes                | Set to `true` to enable users to bypass the login screen and automatically log in. This setting is ignored if you configure multiple auth providers to use auto-login.                                                                                                                                                                                                                                                                                                                                              | `false`                       |
| `role_attribute_path`   | No       | Yes                | [JMESPath](http://jmespath.org/examples.html) expression to use for Grafana role lookup. Grafana will first evaluate the expression using the Okta OIDC ID token. If no role is found, the expression will be evaluated using the user information obtained from the UserInfo endpoint. The result of the evaluation should be a valid Grafana role (`None`, `Viewer`, `Editor`, `Admin` or `GrafanaAdmin`). For more information on user role mapping, refer to [Configure role mapping](#configure-role-mapping). |                               |
| `role_attribute_strict` | No       | Yes                | Set to `true` to deny user login if the Grafana org role cannot be extracted using `role_attribute_path` or `org_mapping`. For more information on user role mapping, refer to [Configure role mapping](#configure-role-mapping).                                                                                                                                                                                                                                                                                   | `false`                       |
| `org_attribute_path`    | No       | No                 | [JMESPath](http://jmespath.org/examples.html) expression to use for Grafana org to role lookup. The result of the evaluation will be mapped to org roles based on `org_mapping`. For more information on org to role mapping, refer to [Org roles mapping example](#org-roles-mapping-example).                                                                                                                                                                                                                     |                               |
| `org_mapping`           | No       | No                 | List of comma- or space-separated `<ExternalOrgName>:<OrgIdOrName>:<Role>` mappings. Value can be `*` meaning "All users". Role is optional and can have the following values: `None`, `Viewer`, `Editor` or `Admin`. For more information on external organization to role mapping, refer to [Org roles mapping example](#org-roles-mapping-example).                                                                                                                                                              |                               |
| `skip_org_role_sync`    | No       | Yes                | Set to `true` to stop automatically syncing user roles. This will allow you to set organization roles for your users from within Grafana manually.                                                                                                                                                                                                                                                                                                                                                                  | `false`                       |
| `allowed_groups`        | No       | Yes                | List of comma- or space-separated groups. The user should be a member of at least one group to log in.                                                                                                                                                                                                                                                                                                                                                                                                              |                               |
| `allowed_domains`       | No       | Yes                | List of comma- or space-separated domains. The user should belong to at least one domain to log in.                                                                                                                                                                                                                                                                                                                                                                                                                 |                               |
| `use_pkce`              | No       | Yes                | Set to `true` to use [Proof Key for Code Exchange (PKCE)](https://datatracker.ietf.org/doc/html/rfc7636). Grafana uses the SHA256 based `S256` challenge method and a 128 bytes (base64url encoded) code verifier.                                                                                                                                                                                                                                                                                                  | `true`                        |
| `use_refresh_token`     | No       | Yes                | Set to `true` to use refresh token and check access token expiration.                                                                                                                                                                                                                                                                                                                                                                                                                                               | `false`                       |
| `signout_redirect_url`  | No       | Yes                | URL to redirect to after the user logs out.                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |                               |
