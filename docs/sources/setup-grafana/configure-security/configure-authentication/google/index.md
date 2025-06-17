---
aliases:
  - ../../../auth/google/
description: Grafana OAuthentication Guide
labels:
  products:
    - cloud
    - enterprise
    - oss
menuTitle: Google OAuth2
title: Configure Google OAuth2 authentication
weight: 1100
---

# Configure Google OAuth2 authentication

To enable Google OAuth2 you must register your application with Google. Google will generate a client ID and secret key for you to use.

{{% admonition type="note" %}}
If Users use the same email address in Google that they use with other authentication providers (such as Grafana.com), you need to do additional configuration to ensure that the users are matched correctly. Please refer to the [Using the same email address to login with different identity providers](../#using-the-same-email-address-to-login-with-different-identity-providers) documentation for more information.
{{% /admonition %}}

## Create Google OAuth keys

First, you need to create a Google OAuth Client:

1. Go to https://console.developers.google.com/apis/credentials.
1. Click **Create Credentials**, then click **OAuth Client ID** in the drop-down menu
1. Enter the following:
   - Application Type: Web Application
   - Name: Grafana
   - Authorized JavaScript Origins: https://grafana.mycompany.com
   - Authorized Redirect URLs: https://grafana.mycompany.com/login/google
   - Replace https://grafana.mycompany.com with the URL of your Grafana instance.
1. Click Create
1. Copy the Client ID and Client Secret from the 'OAuth Client' modal

## Configure Google authentication client using the Grafana UI

{{% admonition type="note" %}}
Available in Public Preview in Grafana 10.4 behind the `ssoSettingsApi` feature toggle.
{{% /admonition %}}

As a Grafana Admin, you can configure Google OAuth2 client from within Grafana using the Google UI. To do this, navigate to **Administration > Authentication > Google** page and fill in the form. If you have a current configuration in the Grafana configuration file then the form will be pre-populated with those values otherwise the form will contain default values.

After you have filled in the form, click **Save**. If the save was successful, Grafana will apply the new configurations.

If you need to reset changes made in the UI back to the default values, click **Reset**. After you have reset the changes, Grafana will apply the configuration from the Grafana configuration file (if there is any configuration) or the default values.

{{% admonition type="note" %}}
If you run Grafana in high availability mode, configuration changes may not get applied to all Grafana instances immediately. You may need to wait a few minutes for the configuration to propagate to all Grafana instances.
{{% /admonition %}}

## Configure Google authentication client using the Terraform provider

{{% admonition type="note" %}}
Available in Public Preview in Grafana 10.4 behind the `ssoSettingsApi` feature toggle. Supported in the Terraform provider since v2.12.0.
{{% /admonition %}}

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
correct. For example in case you are serving Grafana behind a proxy.

Restart the Grafana back-end. You should now see a Google login button
on the login page. You can now login or sign up with your Google
accounts. The `allowed_domains` option is optional, and domains were separated by space.

You may allow users to sign-up via Google authentication by setting the
`allow_sign_up` option to `true`. When this option is set to `true`, any
user successfully authenticating via Google authentication will be
automatically signed up.

You may specify a domain to be passed as `hd` query parameter accepted by Google's
OAuth 2.0 authentication API. Refer to Google's OAuth [documentation](https://developers.google.com/identity/openid-connect/openid-connect#hd-param).

{{% admonition type="note" %}}
Since Grafana 10.3.0, the `hd` parameter retrieved from Google ID token is also used to determine the user's hosted domain. The Google Oauth `allowed_domains` configuration option is used to restrict access to users from a specific domain. If the `allowed_domains` configuration option is set, the `hd` parameter from the Google ID token must match the `allowed_domains` configuration option. If the `hd` parameter from the Google ID token does not match the `allowed_domains` configuration option, the user is denied access.

When an account does not belong to a google workspace, the hd claim will not be available.

This validation is enabled by default. To disable this validation, set the `validate_hd` configuration option to `false`. The `allowed_domains` configuration option will use the email claim to validate the domain.
{{% /admonition %}}

#### PKCE

IETF's [RFC 7636](https://datatracker.ietf.org/doc/html/rfc7636)
introduces "proof key for code exchange" (PKCE) which provides
additional protection against some forms of authorization code
interception attacks. PKCE will be required in [OAuth 2.1](https://datatracker.ietf.org/doc/html/draft-ietf-oauth-v2-1-03).

> You can disable PKCE in Grafana by setting `use_pkce` to `false` in the`[auth.google]` section.

#### Configure refresh token

> Available in Grafana v9.3 and later versions.

When a user logs in using an OAuth provider, Grafana verifies that the access token has not expired. When an access token expires, Grafana uses the provided refresh token (if any exists) to obtain a new access token.

Grafana uses a refresh token to obtain a new access token without requiring the user to log in again. If a refresh token doesn't exist, Grafana logs the user out of the system after the access token has expired.

By default, Grafana includes the `access_type=offline` parameter in the authorization request to request a refresh token.

Refresh token fetching and access token expiration check is enabled by default for the Google provider since Grafana v10.1.0. If you would like to disable access token expiration check then set the `use_refresh_token` configuration value to `false`.

{{% admonition type="note" %}}
The `accessTokenExpirationCheck` feature toggle has been removed in Grafana v10.3.0 and the `use_refresh_token` configuration value will be used instead for configuring refresh token fetching and access token expiration check.
{{% /admonition %}}

#### Configure automatic login

Set `auto_login` option to true to attempt login automatically, skipping the login screen.
This setting is ignored if multiple auth providers are configured to use auto login.

```
auto_login = true
```

### Configure team sync for Google OAuth

> Available in Grafana v10.1.0 and later versions.

With team sync, you can easily add users to teams by utilizing their Google groups. To set up team sync for Google OAuth, refer to the following example.

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

To learn more about Team Sync, refer to [Configure Team Sync](../../configure-team-sync/).

#### Configure allowed groups

> Available in Grafana v10.2.0 and later versions.

To limit access to authenticated users that are members of one or more groups, set `allowed_groups`
to a comma or space separated list of groups.

Google groups are referenced by the group email key. For example, `developers@google.com`.

> Note: Add the `https://www.googleapis.com/auth/cloud-identity.groups.readonly` scope to your Grafana `[auth.google]` scopes configuration to retrieve groups

#### Configure role mapping

> Available in Grafana v10.2.0 and later versions.

Unless `skip_org_role_sync` option is enabled, the user's role will be set to the role mapped from Google upon user login. If no mapping is set the default instance role is used.

The user's role is retrieved using a [JMESPath](http://jmespath.org/examples.html) expression from the `role_attribute_path` configuration option.
To map the server administrator role, use the `allow_assign_grafana_admin` configuration option.

If no valid role is found, the user is assigned the role specified by [the `auto_assign_org_role` option](../../../configure-grafana/#auto_assign_org_role).
You can disable this default role assignment by setting `role_attribute_strict = true`. This setting denies user access if no role or an invalid role is returned after evaluating the `role_attribute_path` and the `org_mapping` expressions.

To ease configuration of a proper JMESPath expression, go to [JMESPath](http://jmespath.org/) to test and evaluate expressions with custom payloads.

> By default skip_org_role_sync is enabled. skip_org_role_sync will default to false in Grafana v10.3.0 and later versions.

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

> Note: Add the `https://www.googleapis.com/auth/cloud-identity.groups.readonly` scope to your Grafana `[auth.google]` scopes configuration to retrieve groups

###### Map server administrator role

In this example, the user with email `admin@company.com` has been granted the `Admin` organization role as well as the Grafana server admin role.
All other users are granted the `Viewer` role.

```ini
allow_assign_grafana_admin = true
skip_org_role_sync = false
role_attribute_path = email=='admin@company.com' && 'GrafanaAdmin' || 'Viewer'
```

###### Map one role to all users

In this example, all users will be assigned `Viewer` role regardless of the user information received from the identity provider.

```ini
role_attribute_path = "'Viewer'"
skip_org_role_sync = false
```
