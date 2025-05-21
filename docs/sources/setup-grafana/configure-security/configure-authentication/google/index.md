---
aliases:
  - ../../../auth/google/
description: Grafana Google OAuth Guide
labels:
  products:
    - cloud
    - enterprise
    - oss
menuTitle: Google OAuth
title: Configure Google OAuth authentication
weight: 1100
---

# Configure Google OAuth authentication

To enable Google OAuth you must register your application with Google. Google will generate a client ID and secret key for you to use.

{{< admonition type="note" >}}
If Users use the same email address in Google that they use with other authentication providers (such as Grafana.com), you need to do additional configuration to ensure that the users are matched correctly. Please refer to the [Using the same email address to login with different identity providers](../#using-the-same-email-address-to-login-with-different-identity-providers) documentation for more information.
{{< /admonition >}}

## Create Google OAuth keys

First, you need to create a Google OAuth Client:

1. Go to https://console.developers.google.com/apis/credentials.
1. Create a new project if you don't have one already.
   1. Enter a project name. The **Organization** and **Location** fields should both be set to your organization's information.
   1. In **OAuth consent screen** select the **External** User Type. Click **CREATE**.
   1. Fill out the requested information using the URL of your Grafana Cloud instance.
   1. Accept the defaults, or customize the consent screen options.
1. Click **Create Credentials**, then click **OAuth Client ID** in the drop-down menu
1. Enter the following:
   - **Application Type**: Web application
   - **Name**: Grafana
   - **Authorized JavaScript origins**: `https://<YOUR_GRAFANA_URL>`
   - **Authorized redirect URIs**: `https://<YOUR_GRAFANA_URL>/login/google`
   - Replace `<YOUR_GRAFANA_URL>` with the URL of your Grafana instance.
     {{< admonition type="note" >}}
     The URL you enter is the one for your Grafana instance home page, not your Grafana Cloud portal URL.
     {{< /admonition >}}
1. Click Create
1. Copy the Client ID and Client Secret from the 'OAuth Client' modal

## Configure Google authentication client using the Grafana UI

{{< admonition type="note" >}}
Available behind the `ssoSettingsAPI` feature toggle, which is enabled by default.
{{< /admonition >}}

As a Grafana Admin, you can configure Google OAuth client from within Grafana using the Google UI. To do this, navigate to **Administration > Authentication > Google** page and fill in the form. If you have a current configuration in the Grafana configuration file then the form will be pre-populated with those values otherwise the form will contain default values.

After you have filled in the form, click **Save**. If the save was successful, Grafana will apply the new configurations.

If you need to reset changes made in the UI back to the default values, click **Reset**. After you have reset the changes, Grafana will apply the configuration from the Grafana configuration file (if there is any configuration) or the default values.

{{< admonition type="note" >}}
If you run Grafana in high availability mode, configuration changes may not get applied to all Grafana instances immediately. You may need to wait a few minutes for the configuration to propagate to all Grafana instances.
{{< /admonition >}}

## Configure Google authentication client using the Terraform provider

{{< admonition type="note" >}}
Available behind the `ssoSettingsAPI` feature toggle, which is enabled by default. Supported in the Terraform provider since v2.12.0.
{{< /admonition >}}

```terraform
resource "grafana_sso_settings" "google_sso_settings" {
  provider_name = "google"
  oauth2_settings {
    name            = "Google"
    client_id       = "CLIENT_ID"
    client_secret   = "CLIENT_SECRET"
    allow_sign_up   = true
    auto_login      = false
    scopes          = "openid email profile"
    allowed_domains = "mycompany.com mycompany.org"
    hosted_domain   = "mycompany.com"
    use_pkce        = true
  }
}
```

Go to [Terraform Registry](https://registry.terraform.io/providers/grafana/grafana/latest/docs/resources/sso_settings) for a complete reference on using the `grafana_sso_settings` resource.

## Configure Google authentication client using the Grafana configuration file

Ensure that you have access to the [Grafana configuration file](../../../configure-grafana/#configuration-file-location).

### Enable Google OAuth in Grafana

Specify the Client ID and Secret in the [Grafana configuration file](../../../configure-grafana/#configuration-file-location). For example:

```bash
[auth.google]
enabled = true
allow_sign_up = true
auto_login = false
client_id = CLIENT_ID
client_secret = CLIENT_SECRET
scopes = openid email profile
auth_url = https://accounts.google.com/o/oauth2/v2/auth
token_url = https://oauth2.googleapis.com/token
api_url = https://openidconnect.googleapis.com/v1/userinfo
allowed_domains = mycompany.com mycompany.org
hosted_domain = mycompany.com
use_pkce = true
```

You may have to set the `root_url` option of `[server]` for the callback URL to be
correct. For example, in case you are serving Grafana behind a proxy.

Restart the Grafana backend. You should now see a Google login button
on the login page. You can now login or sign up with your Google
accounts. The `allowed_domains` option is optional, and domains were separated by space.

You may allow users to sign-up via Google authentication by setting the
`allow_sign_up` option to `true`. When this option is set to `true`, any
user successfully authenticating via Google authentication will be
automatically signed up.

You may specify a domain to be passed as `hd` query parameter accepted by Google's
OAuth 2.0 authentication API. Refer to Google's OAuth [documentation](https://developers.google.com/identity/openid-connect/openid-connect#hd-param).

{{< admonition type="note" >}}
Since Grafana 10.3.0, the `hd` parameter retrieved from Google ID token is also used to determine the user's hosted domain. The Google Oauth `allowed_domains` configuration option is used to restrict access to users from a specific domain. If the `allowed_domains` configuration option is set, the `hd` parameter from the Google ID token must match the `allowed_domains` configuration option. If the `hd` parameter from the Google ID token does not match the `allowed_domains` configuration option, the user is denied access.

When an account does not belong to a google workspace, the `hd` claim will not be available.

This validation is enabled by default. To disable this validation, set the `validate_hd` configuration option to `false`. The `allowed_domains` configuration option will use the email claim to validate the domain.
{{< /admonition >}}

#### PKCE

IETF's [RFC 7636](https://datatracker.ietf.org/doc/html/rfc7636)
introduces "proof key for code exchange" (PKCE) which provides
additional protection against some forms of authorization code
interception attacks. PKCE will be required in [OAuth 2.1](https://datatracker.ietf.org/doc/html/draft-ietf-oauth-v2-1-03).

{{< admonition type="note" >}}
You can disable PKCE in Grafana by setting `use_pkce` to `false` in the`[auth.google]` section.
{{< /admonition >}}

#### Configure refresh token

When a user logs in using an OAuth provider, Grafana verifies that the access token has not expired. When an access token expires, Grafana uses the provided refresh token (if any exists) to obtain a new access token.

Grafana uses a refresh token to obtain a new access token without requiring the user to log in again. If a refresh token doesn't exist, Grafana logs the user out of the system after the access token has expired.

By default, Grafana includes the `access_type=offline` parameter in the authorization request to request a refresh token.

Refresh token fetching and access token expiration check is enabled by default for the Google provider since Grafana v10.1.0. If you would like to disable access token expiration check then set the `use_refresh_token` configuration value to `false`.

{{% admonition type="note" %}}
The `accessTokenExpirationCheck` feature toggle has been removed in Grafana v10.3.0 and the `use_refresh_token` configuration value will be used instead for configuring refresh token fetching and access token expiration check.
{{% /admonition %}}

#### Configure automatic login

Set the `auto_login` option to true to attempt log in automatically, skipping the login screen.
This setting is ignored if multiple auth providers are configured to use auto login.

```
auto_login = true
```

### Configure team synchronization

With team sync, you can easily add users to teams by utilizing their Google groups. To set up team sync for Google OAuth, refer to the following example.

To set up team sync for Google OAuth:

1. Enable the Google Cloud Identity API on your [organization's dashboard](https://console.cloud.google.com/apis/api/cloudidentity.googleapis.com/).

1. Add the `https://www.googleapis.com/auth/cloud-identity.groups.readonly` scope to your Grafana `[auth.google]` configuration:

   Example:

   ```ini
   [auth.google]
   # ..
   scopes = openid email profile https://www.googleapis.com/auth/cloud-identity.groups.readonly
   ```

1. Configure team sync in your Grafana team's `External group sync` tab.
   The external group ID for a Google group is the group's email address, such as `dev@grafana.com`.

To learn more about Team Sync, refer to [Configure Team Sync](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/setup-grafana/configure-security/configure-team-sync/).

#### Configure allowed groups

To limit access to authenticated users that are members of one or more groups, set `allowed_groups`
to a comma or space separated list of groups.

Google groups are referenced by the group email key. For example, `developers@google.com`.

{{< admonition type="note" >}}
Add the `https://www.googleapis.com/auth/cloud-identity.groups.readonly` scope to your Grafana `[auth.google]` scopes configuration to retrieve groups.
{{< /admonition >}}

#### Configure role mapping

Unless the `skip_org_role_sync` option is enabled, the user's role will be set to the role mapped from Google upon user login. If no mapping is set the default instance role is used.

The user's role is retrieved using a [JMESPath](http://jmespath.org/examples.html) expression from the `role_attribute_path` configuration option.
To map the server administrator role, use the `allow_assign_grafana_admin` configuration option.

If no valid role is found, the user is assigned the role specified by [the `auto_assign_org_role` option](../../../configure-grafana/#auto_assign_org_role).
You can disable this default role assignment by setting `role_attribute_strict = true`. This setting denies user access if no role or an invalid role is returned after evaluating the `role_attribute_path` and the `org_mapping` expressions.

To ease configuration of a proper JMESPath expression, go to [JMESPath](http://jmespath.org/) to test and evaluate expressions with custom payloads.
{{< admonition type="note" >}}
By default the `skip_org_role_sync` option is enabled. The `skip_org_role_sync` option defaults to false in Grafana v10.3.0 and later versions.
{{< /admonition >}}

##### Role mapping examples

This section includes examples of JMESPath expressions used for role mapping.

##### Org roles mapping example

The Google integration uses the external users' groups in the `org_mapping` configuration to map organizations and roles based on their Google group membership.

In this example, the user has been granted the role of a `Viewer` in the `org_foo` organization, and the role of an `Editor` in the `org_bar` and `org_baz` orgs.

The external user is part of the following Google groups: `group-1` and `group-2`.

Config:

```ini
org_mapping = group-1:org_foo:Viewer group-2:org_bar:Editor *:org_baz:Editor
```

###### Map roles using user information from OAuth token

In this example, the user with email `admin@company.com` has been granted the `Admin` role.
All other users are granted the `Viewer` role.

```ini
role_attribute_path = email=='admin@company.com' && 'Admin' || 'Viewer'
skip_org_role_sync = false
```

###### Map roles using groups

In this example, the user from Google group 'example-group@google.com' have been granted the `Editor` role.
All other users are granted the `Viewer` role.

```ini
role_attribute_path = contains(groups[*], 'example-group@google.com') && 'Editor' || 'Viewer'
skip_org_role_sync = false
```

{{< admonition type="note" >}}
Add the `https://www.googleapis.com/auth/cloud-identity.groups.readonly` scope to your Grafana `[auth.google]` scopes configuration to retrieve groups.
{{< /admonition >}}

###### Map server administrator role

In this example, the user with email `admin@company.com` is granted the `Admin` organization role as well as the Grafana server admin role.
All other users are granted the `Viewer` role.

```ini
allow_assign_grafana_admin = true
skip_org_role_sync = false
role_attribute_path = email=='admin@company.com' && 'GrafanaAdmin' || 'Viewer'
```

###### Map one role to all users

In this example, all users are assigned the `Viewer` role regardless of the user information received from the identity provider.

```ini
role_attribute_path = "'Viewer'"
skip_org_role_sync = false
```

## Configuration options

The following table outlines the various Google OAuth configuration options. You can apply these options as environment variables, similar to any other configuration within Grafana. For more information, refer to [Override configuration with environment variables](../../../configure-grafana/#override-configuration-with-environment-variables).

| Setting                      | Required | Supported on Cloud | Description                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     | Default                                            |
| ---------------------------- | -------- | ------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------- |
| `enabled`                    | No       | Yes                | Enables Google authentication.                                                                                                                                                                                                                                                                                                                                                                                                                                                                  | `false`                                            |
| `name`                       | No       | Yes                | Name that refers to the Google authentication from the Grafana user interface.                                                                                                                                                                                                                                                                                                                                                                                                                  | `Google`                                           |
| `icon`                       | No       | Yes                | Icon used for the Google authentication in the Grafana user interface.                                                                                                                                                                                                                                                                                                                                                                                                                          | `google`                                           |
| `client_id`                  | Yes      | Yes                | Client ID of the App.                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |                                                    |
| `client_secret`              | Yes      | Yes                | Client secret of the App.                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |                                                    |
| `auth_url`                   | Yes      | Yes                | Authorization endpoint of the Google OAuth provider.                                                                                                                                                                                                                                                                                                                                                                                                                                            | `https://accounts.google.com/o/oauth2/v2/auth`     |
| `token_url`                  | Yes      | Yes                | Endpoint used to obtain the OAuth2 access token.                                                                                                                                                                                                                                                                                                                                                                                                                                                | `https://oauth2.googleapis.com/token`              |
| `api_url`                    | Yes      | Yes                | Endpoint used to obtain user information compatible with [OpenID UserInfo](https://connect2id.com/products/server/docs/api/userinfo).                                                                                                                                                                                                                                                                                                                                                           | `https://openidconnect.googleapis.com/v1/userinfo` |
| `auth_style`                 | No       | Yes                | Name of the [OAuth2 AuthStyle](https://pkg.go.dev/golang.org/x/oauth2#AuthStyle) to be used when ID token is requested from OAuth2 provider. It determines how `client_id` and `client_secret` are sent to Oauth2 provider. Available values are `AutoDetect`, `InParams` and `InHeader`.                                                                                                                                                                                                       | `AutoDetect`                                       |
| `scopes`                     | No       | Yes                | List of comma- or space-separated OAuth2 scopes.                                                                                                                                                                                                                                                                                                                                                                                                                                                | `openid email profile`                             |
| `allow_sign_up`              | No       | Yes                | Controls Grafana user creation through the Google login. Only existing Grafana users can log in with Google if set to `false`.                                                                                                                                                                                                                                                                                                                                                                  | `true`                                             |
| `auto_login`                 | No       | Yes                | Set to `true` to enable users to bypass the login screen and automatically log in. This setting is ignored if you configure multiple auth providers to use auto-login.                                                                                                                                                                                                                                                                                                                          | `false`                                            |
| `hosted_domain`              | No       | Yes                | Specifies the domain to restrict access to users from that domain. This value is appended to the authorization request using the `hd` parameter.                                                                                                                                                                                                                                                                                                                                                |                                                    |
| `validate_hd`                | No       | Yes                | Set to `false` to disable the validation of the `hd` parameter from the Google ID token. For more informatiion, refer to [Enable Google OAuth in Grafana](#enable-google-oauth-in-grafana).                                                                                                                                                                                                                                                                                                     | `true`                                             |
| `role_attribute_strict`      | No       | Yes                | Set to `true` to deny user login if the Grafana org role cannot be extracted using `role_attribute_path` or `org_mapping`. For more information on user role mapping, refer to [Configure role mapping](#configure-role-mapping).                                                                                                                                                                                                                                                               | `false`                                            |
| `org_attribute_path`         | No       | No                 | [JMESPath](http://jmespath.org/examples.html) expression to use for Grafana org to role lookup. Grafana will first evaluate the expression using the OAuth2 ID token. If no value is returned, the expression will be evaluated using the user information obtained from the UserInfo endpoint. The result of the evaluation will be mapped to org roles based on `org_mapping`. For more information on org to role mapping, refer to [Org roles mapping example](#org-roles-mapping-example). |                                                    |
| `org_mapping`                | No       | No                 | List of comma- or space-separated `<ExternalOrgName>:<OrgIdOrName>:<Role>` mappings. Value can be `*` meaning "All users". Role is optional and can have the following values: `None`, `Viewer`, `Editor` or `Admin`. For more information on external organization to role mapping, refer to [Org roles mapping example](#org-roles-mapping-example).                                                                                                                                          |                                                    |
| `allow_assign_grafana_admin` | No       | No                 | Set to `true` to automatically sync the Grafana server administrator role. When enabled, if the Google user's App role is `GrafanaAdmin`, Grafana grants the user server administrator privileges and the organization administrator role. If disabled, the user will only receive the organization administrator role. For more details on user role mapping, refer to [Map roles](#map-roles).                                                                                                | `false`                                            |
| `skip_org_role_sync`         | No       | Yes                | Set to `true` to stop automatically syncing user roles. This will allow you to set organization roles for your users from within Grafana manually.                                                                                                                                                                                                                                                                                                                                              | `false`                                            |
| `allowed_groups`             | No       | Yes                | List of comma- or space-separated groups. The user should be a member of at least one group to log in. If you configure `allowed_groups`, you must also configure Google to include the `groups` claim following [Configure allowed groups](#configure-allowed-groups).                                                                                                                                                                                                                         |                                                    |
| `allowed_organizations`      | No       | Yes                | List of comma- or space-separated Azure tenant identifiers. The user should be a member of at least one tenant to log in.                                                                                                                                                                                                                                                                                                                                                                       |                                                    |
| `allowed_domains`            | No       | Yes                | List of comma- or space-separated domains. The user should belong to at least one domain to log in.                                                                                                                                                                                                                                                                                                                                                                                             |                                                    |
| `tls_skip_verify_insecure`   | No       | No                 | If set to `true`, the client accepts any certificate presented by the server and any host name in that certificate. _You should only use this for testing_, because this mode leaves SSL/TLS susceptible to man-in-the-middle attacks.                                                                                                                                                                                                                                                          | `false`                                            |
| `tls_client_cert`            | No       | No                 | The path to the certificate.                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |                                                    |
| `tls_client_key`             | No       | No                 | The path to the key.                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |                                                    |
| `tls_client_ca`              | No       | No                 | The path to the trusted certificate authority list.                                                                                                                                                                                                                                                                                                                                                                                                                                             |                                                    |
| `use_pkce`                   | No       | Yes                | Set to `true` to use [Proof Key for Code Exchange (PKCE)](https://datatracker.ietf.org/doc/html/rfc7636). Grafana uses the SHA256 based `S256` challenge method and a 128 bytes (base64url encoded) code verifier.                                                                                                                                                                                                                                                                              | `true`                                             |
| `use_refresh_token`          | No       | Yes                | Enables the use of refresh tokens and checks for access token expiration. When enabled, Grafana automatically adds the `promp=consent` and `access_type=offline` parameters to the authorization request.                                                                                                                                                                                                                                                                                       | `true`                                             |
| `signout_redirect_url`       | No       | Yes                | URL to redirect to after the user logs out.                                                                                                                                                                                                                                                                                                                                                                                                                                                     |                                                    |
