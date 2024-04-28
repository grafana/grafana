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

{{% admonition type="note" %}}
If Users use the same email address in Okta that they use with other authentication providers (such as Grafana.com), you need to do additional configuration to ensure that the users are matched correctly. Please refer to the [Using the same email address to login with different identity providers]({{< relref "../../configure-authentication#using-the-same-email-address-to-login-with-different-identity-providers" >}}) documentation for more information.
{{% /admonition %}}

## Before you begin

To follow this guide, ensure you have permissions in your Okta workspace to create an OIDC app.

## Configure Okta authentication client using the Grafana UI

{{% admonition type="note" %}}
Available in Public Preview in Grafana 10.4 behind the `ssoSettingsApi` feature toggle.
{{% /admonition %}}

As a Grafana Admin, you can configure Okta OAuth2 client from within Grafana using the Okta UI. To do this, navigate to **Administration > Authentication > Okta** page and fill in the form. If you have a current configuration in the Grafana configuration file then the form will be pre-populated with those values otherwise the form will contain default values.

After you have filled in the form, click **Save**. If the save was successful, Grafana will apply the new configurations.

If you need to reset changes you made in the UI back to the default values, click **Reset**. After you have reset the changes, Grafana will apply the configuration from the Grafana configuration file (if there is any configuration) or the default values.

{{% admonition type="note" %}}
If you run Grafana in high availability mode, configuration changes may not get applied to all Grafana instances immediately. You may need to wait a few minutes for the configuration to propagate to all Grafana instances.
{{% /admonition %}}

Refer to [configuration options]({{< relref "#configuration-options" >}}) for more information.

## Configure Okta authentication client using the Terraform provider

{{% admonition type="note" %}}
Available in Public Preview in Grafana 10.4 behind the `ssoSettingsApi` feature toggle. Supported in the Terraform provider since v2.12.0.
{{% /admonition %}}

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

Ensure that you have access to the [Grafana configuration file]({{< relref "../../../configure-grafana#configuration-file-location" >}}).

### Steps

To integrate your Okta OIDC provider with Grafana using our Okta OIDC integration, follow these steps:

1. Follow the [OIDC app integration guide](https://help.okta.com/en-us/content/topics/apps/apps_app_integration_wizard_oidc.htm)
   to reach the OIDC new application configuration wizard.

1. Select `OIDC - OpenID Connect` as the sign-in method and `Single-Page Application`.

1. Select `Authorization Code` and `Refresh Token` as the grant types.

1. Set the `Sign-in redirect URI` to `http://<my_grafana_server_name_or_ip>:<grafana_server_port>/login/okta`.

   Ensure that the sign-in redirect URI is the complete HTTP address that you use to access Grafana via your browser, but with the appended path of `/login/okta`.

   For the sign-in redirect URI to be correct, it might be necessary to set the root_url option to [server], for example, if you are serving Grafana behind a proxy.

1. Set the `Sign-out redirect URI` to `http://<my_grafana_server_name_or_ip>:<grafana_server_port>/logout`.

1. Refer to the following table to update field values located in the `[auth.okta]` section of the Grafana configuration file:

   | Field       | Description                                                                                                 |
   | ----------- | ----------------------------------------------------------------------------------------------------------- |
   | `client_id` | These values must match the client ID from your Okta OIDC app.                                              |
   | `auth_url`  | The authorization endpoint of your OIDC provider. `https://<okta-tenant-id>.okta.com/oauth2/v1/authorize`   |
   | `token_url` | The token endpoint of your Okta OIDC provider. `https://<okta-tenant-id>.okta.com/oauth2/v1/token`          |
   | `api_url`   | The user information endpoint of your Okta OIDC provider. `https://<tenant-id>.okta.com/oauth2/v1/userinfo` |
   | `enabled`   | Enables Okta OIDC authentication. Set this value to `true`.                                                 |

1. Review the list of other Okta OIDC [configuration options]({{< relref "#configuration-options" >}}) and complete them as necessary.

1. Optional: [Configure a refresh token]({{< relref "#configure-a-refresh-token" >}}):

   a. Enable the `accessTokenExpirationCheck` feature toggle.

   b. Extend the `scopes` field of `[auth.okta]` section in Grafana configuration file with the refresh token scope used by your OIDC provider.

   c. Enable the [refresh token]({{< relref "#configure-a-refresh-token" >}}) at the Okta application settings.

1. [Configure role mapping]({{< relref "#configure-role-mapping" >}}).
1. Optional: [Configure team synchronization]({{< relref "#configure-team-synchronization-enterprise-only" >}}).
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
client_id = 0oads6ziaaiiz4zz45d7
scopes = openid profile email offline_access
auth_url = https://<okta tenant id>.okta.com/oauth2/v1/authorize
token_url = https://<okta tenant id>.okta.com/oauth2/v1/token
api_url = https://<okta tenant id>.okta.com/oauth2/v1/userinfo
role_attribute_path = contains(groups[*], 'Example::DevOps') && 'Admin' || 'None'
role_attribute_strict = true
allowed_groups = "Example::DevOps" "Example::Dev" "Example::QA"
```

### Configure a refresh token

> Available in Grafana v9.3 and later versions.

When a user logs in using an OAuth provider, Grafana verifies that the access token has not expired. When an access token expires, Grafana uses the provided refresh token (if any exists) to obtain a new access token without requiring the user to log in again.

If a refresh token doesn't exist, Grafana logs the user out of the system after the access token has expired.

To enable the `Refresh Token` head over the Okta application settings and:

1. Under `General` tab, find the `General Settings` section.
1. Within the `Grant Type` options, enable the `Refresh Token` checkbox.

At the configuration file, extend the `scopes` in `[auth.okta]` section with `offline_access`.

{{% admonition type="note" %}}
The `accessTokenExpirationCheck` feature toggle has been removed in Grafana v10.3.0 and the `use_refresh_token` configuration value will be used instead for configuring refresh token fetching and access token expiration check.
{{% /admonition %}}

### Configure role mapping

> **Note:** Unless `skip_org_role_sync` option is enabled, the user's role will be set to the role retrieved from the auth provider upon user login.

The user's role is retrieved using a [JMESPath](http://jmespath.org/examples.html) expression from the `role_attribute_path` configuration option against the `api_url` endpoint payload.
To map the server administrator role, use the `allow_assign_grafana_admin` configuration option.
Refer to [configuration options]({{< relref "../generic-oauth/index.md#configuration-options" >}}) for more information.

If no valid role is found, the user is assigned the role specified by [the `auto_assign_org_role` option]({{< relref "../../../configure-grafana#auto_assign_org_role" >}}).
You can disable this default role assignment by setting `role_attribute_strict = true`.
This setting denies user access if no role or an invalid role is returned.

To learn about adding custom claims to the user info in Okta, refer to [add custom claims](https://developer.okta.com/docs/guides/customize-tokens-returned-from-okta/main/#add-a-custom-claim-to-a-token). Refer to the generic OAuth page for [JMESPath examples]({{< relref "../generic-oauth/index.md#role-mapping-examples" >}}).

### Configure team synchronization (Enterprise only)

> **Note:** Available in [Grafana Enterprise]({{< relref "../../../../introduction/grafana-enterprise" >}}) and [Grafana Cloud]({{< relref "../../../../introduction/grafana-cloud" >}}).

By using Team Sync, you can link your Okta groups to teams within Grafana. This will automatically assign users to the appropriate teams.

Map your Okta groups to teams in Grafana so that your users will automatically be added to
the correct teams.

Okta groups can be referenced by group names, like `Admins` or `Editors`.

To learn more about Team Sync, refer to [Configure Team Sync]({{< relref "../../configure-team-sync" >}}).

## Configuration options

The following table outlines the various Okta OIDC configuration options. You can apply these options as environment variables, similar to any other configuration within Grafana.

| Setting                 | Required | Description                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  | Default                       |
| ----------------------- | -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------- |
| `enabled`               | No       | Enables Okta OIDC authentication.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            | `false`                       |
| `name`                  | No       | Name that refers to the Okta OIDC authentication from the Grafana user interface.                                                                                                                                                                                                                                                                                                                                                                                                                                            | `Okta`                        |
| `icon`                  | No       | Icon used for the Okta OIDC authentication in the Grafana user interface.                                                                                                                                                                                                                                                                                                                                                                                                                                                    | `okta`                        |
| `client_id`             | Yes      | Client ID provided by your Okta OIDC app.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |                               |
| `client_secret`         | Yes      | Client secret provided by your Okta OIDC app.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |                               |
| `auth_url`              | Yes      | Authorization endpoint of your Okta OIDC provider.                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |                               |
| `token_url`             | Yes      | Endpoint used to obtain the Okta OIDC access token.                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |                               |
| `api_url`               | Yes      | Endpoint used to obtain user information.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |                               |
| `scopes`                | No       | List of comma- or space-separated Okta OIDC scopes.                                                                                                                                                                                                                                                                                                                                                                                                                                                                          | `openid profile email groups` |
| `allow_sign_up`         | No       | Controls Grafana user creation through the Okta OIDC login. Only existing Grafana users can log in with Okta OIDC if set to `false`.                                                                                                                                                                                                                                                                                                                                                                                         | `true`                        |
| `auto_login`            | No       | Set to `true` to enable users to bypass the login screen and automatically log in. This setting is ignored if you configure multiple auth providers to use auto-login.                                                                                                                                                                                                                                                                                                                                                       | `false`                       |
| `role_attribute_path`   | No       | [JMESPath](http://jmespath.org/examples.html) expression to use for Grafana role lookup. Grafana will first evaluate the expression using the Okta OIDC ID token. If no role is found, the expression will be evaluated using the user information obtained from the UserInfo endpoint. The result of the evaluation should be a valid Grafana role (`Viewer`, `Editor`, `Admin` or `GrafanaAdmin`). For more information on user role mapping, refer to [Configure role mapping]({{< relref "#configure-role-mapping" >}}). |                               |
| `role_attribute_strict` | No       | Set to `true` to deny user login if the Grafana role cannot be extracted using `role_attribute_path`. For more information on user role mapping, refer to [Configure role mapping]({{< relref "#configure-role-mapping" >}}).                                                                                                                                                                                                                                                                                                | `false`                       |
| `skip_org_role_sync`    | No       | Set to `true` to stop automatically syncing user roles. This will allow you to set organization roles for your users from within Grafana manually.                                                                                                                                                                                                                                                                                                                                                                           | `false`                       |
| `allowed_groups`        | No       | List of comma- or space-separated groups. The user should be a member of at least one group to log in.                                                                                                                                                                                                                                                                                                                                                                                                                       |                               |
| `allowed_domains`       | No       | List comma- or space-separated domains. The user should belong to at least one domain to log in.                                                                                                                                                                                                                                                                                                                                                                                                                             |                               |
| `use_pkce`              | No       | Set to `true` to use [Proof Key for Code Exchange (PKCE)](https://datatracker.ietf.org/doc/html/rfc7636). Grafana uses the SHA256 based `S256` challenge method and a 128 bytes (base64url encoded) code verifier.                                                                                                                                                                                                                                                                                                           | `true`                        |
| `use_refresh_token`     | No       | Set to `true` to use refresh token and check access token expiration.                                                                                                                                                                                                                                                                                                                                                                                                                                                        | `false`                       |
