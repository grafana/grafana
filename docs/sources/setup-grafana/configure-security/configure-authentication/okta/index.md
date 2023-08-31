---
aliases:
  - ../../../auth/okta/
description: Grafana Okta OAuth Guide
title: Configure Okta OAuth2 authentication
menuTitle: Okta OAuth2
weight: 1400
---

# Configure Okta OAuth2 authentication

{{< docs/shared lookup="auth/intro.md" source="grafana" version="<GRAFANA VERSION>" >}}

## Before you begin

To follow this guide:

- Ensure that you have access to the [Grafana configuration file]({{< relref "../../../configure-grafana#configuration-file-location" >}}).
- Ensure you know how to create an OAuth2 application with your OAuth2 provider. Consult the [documentation of Okta OAuth2](https://help.okta.com/en-us/Content/Topics/Apps/Apps_App_Integration_Wizard.htm) for more information.
- If you are using refresh tokens, ensure you know how to set them up with your OAuth2 provider. Consult the documentation of your OAuth2 provider for more information.

## Steps

To integrate your Okta OAuth2 provider with Grafana using our Okta OAuth2 integration, follow these steps:

1. [Create an SWA app](https://help.okta.com/en-us/Content/Topics/Apps/Apps_App_Integration_Wizard_SWA.htm) or [OCID app](https://help.okta.com/en-us/Content/Topics/Apps/Apps_App_Integration_Wizard_OIDC.htm) at the Okta applications section.

1. Set the callback URL for your OAuth2 app to `http://<my_grafana_server_name_or_ip>:<grafana_server_port>/login/okta`.

   Ensure that the callback URL is the complete HTTP address that you use to access Grafana via your browser, but with the appended path of `/login/okta`.

   For the callback URL to be correct, it might be necessary to set the root_url option to [server], for example, if you are serving Grafana behind a proxy.

1. Refer to the following table to update field values located in the `[auth.okta]` section of the Grafana configuration file:

   | Field                        | Description                                                                                                   |
   | ---------------------------- | ------------------------------------------------------------------------------------------------------------- |
   | `client_id`, `client_secret` | These values must match the client ID and client secret from your Okta OAuth2 app.                            |
   | `auth_url`                   | The authorization endpoint of your OAuth2 provider. `https://<okta-tenant-id>.okta.com/oauth2v1authorize`     |
   | `token_url`                  | The token endpoint of your Okta OAuth2 provider. `https://<okta-tenant-id>.okta.com/token`                    |
   | `api_url`                    | The user information endpoint of your Okta OAuth2 provider. `https://<tenant-id>.okta.com/oauth2/v1/userinfo` |
   | `enabled`                    | Enables Okta OAuth2 authentication. Set this value to `true`.                                                 |

1. Review the list of other Okta OAuth2 [configuration options]({{< relref "#configuration-options" >}}) and complete them as necessary.

1. Optional: [Configure a refresh token]({{< relref "#configure-a-refresh-token" >}}):

   a. Enable the `accessTokenExpirationCheck` feature toggle.

   b. Extend the `scopes` field of `[auth.okta]` section in Grafana configuration file with the refresh token scope used by your OAuth2 provider.

   c. Enable the [refresh token]({{< relref "#configure-a-refresh-token" >}}) at the Okta application settings.

1. [Configure role mapping]({{< relref "#configure-role-mapping" >}}).
1. Optional: [Configure team synchronization]({{< relref "#configure-team-synchronization-enterprise-only" >}}).
1. Restart Grafana.

   You should now see a Okta OAuth2 login button on the login page and be able to log in or sign up with your OAuth2 provider.

## Configuration options

The following table outlines the various Okta OAuth2 configuration options. You can apply these options as environment variables, similar to any other configuration within Grafana.

| Setting                 | Required | Description                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    | Default                       |
| ----------------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------- |
| `enabled`               | No       | Enables Okta OAuth2 authentication.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            | `false`                       |
| `name`                  | No       | Name that refers to the Okta OAuth2 authentication from the Grafana user interface.                                                                                                                                                                                                                                                                                                                                                                                                                                            | `Okta`                        |
| `icon`                  | No       | Icon used for the Okta OAuth2 authentication in the Grafana user interface.                                                                                                                                                                                                                                                                                                                                                                                                                                                    | `okta`                        |
| `client_id`             | Yes      | Client ID provided by your Okta OAuth2 app.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |                               |
| `client_secret`         | Yes      | Client secret provided by your Okta OAuth2 app.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |                               |
| `auth_url`              | Yes      | Authorization endpoint of your Okta OAuth2 provider.                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |                               |
| `token_url`             | Yes      | Endpoint used to obtain the Okta OAuth2 access token.                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |                               |
| `api_url`               | Yes      | Endpoint used to obtain user information.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |                               |
| `scopes`                | No       | List of comma- or space-separated Okta OAuth2 scopes.                                                                                                                                                                                                                                                                                                                                                                                                                                                                          | `openid profile email groups` |
| `allow_sign_up`         | No       | Controls Grafana user creation through the Okta OAuth2 login. Only existing Grafana users can log in with Okta OAuth2 if set to `false`.                                                                                                                                                                                                                                                                                                                                                                                       | `true`                        |
| `auto_login`            | No       | Set to `true` to enable users to bypass the login screen and automatically log in. This setting is ignored if you configure multiple auth providers to use auto-login.                                                                                                                                                                                                                                                                                                                                                         | `false`                       |
| `role_attribute_path`   | No       | [JMESPath](http://jmespath.org/examples.html) expression to use for Grafana role lookup. Grafana will first evaluate the expression using the Okta OAuth2 ID token. If no role is found, the expression will be evaluated using the user information obtained from the UserInfo endpoint. The result of the evaluation should be a valid Grafana role (`Viewer`, `Editor`, `Admin` or `GrafanaAdmin`). For more information on user role mapping, refer to [Configure role mapping]({{< relref "#configure-role-mapping" >}}). |                               |
| `role_attribute_strict` | No       | Set to `true` to deny user login if the Grafana role cannot be extracted using `role_attribute_path`. For more information on user role mapping, refer to [Configure role mapping]({{< relref "#configure-role-mapping" >}}).                                                                                                                                                                                                                                                                                                  | `false`                       |
| `skip_org_role_sync`    | No       | Set to `true` to stop automatically syncing user roles. This will allow you to set organization roles for your users from within Grafana manually.                                                                                                                                                                                                                                                                                                                                                                             | `false`                       |
| `allowed_groups`        | No       | List of comma- or space-separated groups. The user should be a member of at least one group to log in.                                                                                                                                                                                                                                                                                                                                                                                                                         |                               |
| `allowed_domains`       | No       | List comma- or space-separated domains. The user should belong to at least one domain to log in.                                                                                                                                                                                                                                                                                                                                                                                                                               |                               |
| `use_pkce`              | No       | Set to `true` to use [Proof Key for Code Exchange (PKCE)](https://datatracker.ietf.org/doc/html/rfc7636). Grafana uses the SHA256 based `S256` challenge method and a 128 bytes (base64url encoded) code verifier.                                                                                                                                                                                                                                                                                                             | `false`                       |
| `use_refresh_token`     | No       | Set to `true` to use refresh token and check access token expiration. The `accessTokenExpirationCheck` feature toggle should also be enabled to use refresh token.                                                                                                                                                                                                                                                                                                                                                             | `false`                       |

### Configure a refresh token

> Available in Grafana v9.3 and later versions.

> **Note:** This feature is behind the `accessTokenExpirationCheck` feature toggle.

When a user logs in using an OAuth provider, Grafana verifies that the access token has not expired. When an access token expires, Grafana uses the provided refresh token (if any exists) to obtain a new access token without requiring the user to log in again.

If a refresh token doesn't exist, Grafana logs the user out of the system after the access token has expired.

To enable the `Refresh Token` head over the Okta application settings and:

1. Under `General` tab, find the `General Settings` section.
1. Within the `Grant Type` options, enable the `Refresh Token` checkbox.

At the configuration file, extend the `scopes` in `[auth.okta]` section with `offline_access`.

> **Note:** The `accessTokenExpirationCheck` feature toggle will be removed in Grafana v10.2.0 and the `use_refresh_token` configuration value will be used instead for configuring refresh token fetching and access token expiration check.

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

By using Team Sync, you can link your OAuth2 groups to teams within Grafana. This will automatically assign users to the appropriate teams.

Map your Okta groups to teams in Grafana so that your users will automatically be added to
the correct teams.

Okta groups can be referenced by group names, like `Admins` or `Editors`.

To learn more about Team Sync, refer to [Confgure Team Sync]({{< relref "../../configure-team-sync" >}}).
