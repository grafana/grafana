---
aliases:
  - ../../../auth/generic-oauth/
description: Configure generic OAuth2 authentication
keywords:
  - grafana
  - configuration
  - documentation
  - oauth
title: Configure generic OAuth2 authentication
menuTitle: Generic OAuth2
weight: 700
---

# Configure generic OAuth2 authentication

{{< docs/shared "auth/intro.md" >}}

Grafana has specialised OAuth2 integrations for the following auth providers:

- [Azure AD OAuth]({{< relref "../azuread" >}})
- [GitHub OAuth]({{< relref "../github" >}})
- [GitLab OAuth]({{< relref "../gitlab" >}})
- [Google OAuth]({{< relref "../google" >}})
- [Grafana Com OAuth]({{< relref "../grafana-com" >}})
- [KeyCloak OAuth]({{< relref "../keycloak" >}})
- [Okta OAuth]({{< relref "../okta" >}})

If your OAuth2 provider is not among them, you can use generic OAuth2 authentication to integrate it with Grafana.

## Before you begin

- Ensure that you have access to the [Grafana configuration file]({{< relref "/docs/grafana/latest/setup-grafana/configure-grafana/#configuration-file-location" >}}).
- Learn how to create an OAuth2 application with your chosen OAuth2 provider. Consult the documentation of your OAuth2 provider for more information.

## Steps

To integrate your OAuth2 provider with Grafana using our generic OAuth2 authentication, follow these steps:

1. Create an OAuth2 application in your chosen OAuth2 provider.
1. Set the callback URL for your OAuth2 app to `http://<my_grafana_server_name_or_ip>:<grafana_server_port>/login/generic_oauth`.

This callback URL must match the full HTTP address that you use in your browser to access Grafana, but with the suffixed path of `/login/generic_oauth`.
You may need to set the `root_url` option of `[server]` for the callback URL to be correct. For example, in case you are serving Grafana behind a proxy.

1. Update `[auth.generic_oauth]` section of Grafana configuration file:
  1. Update `client_id` and `client_secret` fields to match client ID and client secret from your OAuth2 app.
  1. Set `auth_url` field to the authorization endpoint of your OAuth2 provider.
  1. Set `token_url` field to the token endpoint of your OAuth2 provider.
  1. Set `api_url` field to the user information endpoint of your OAuth2 provider. Information returned by this endpoint has to be compatible with [OpenID UserInfo](https://connect2id.com/products/server/docs/api/userinfo).
  1. Update `enabled` field to `true`.
  1. Look at the list of other generic OAuth2 [configuration options]({{< relref "#configuration-options" >}}) and fill in the desired ones.
1. Configure [role mapping]({{< relref "#role-mapping" >}}).
1. (Optional) Configure [team synchronization]({{< relref "#team-synchronization" >}}).
1. Restart Grafana. You should now see a generic OAuth2 login button on the login page and be able to login or sign up with your OAuth2 provider.

## Configuration options

The table below describes all generic OAuth2 configuration options. Continue reading below for details on specific options. Like any other Grafana configuration, you can apply these options as environment variables.

| Setting                      | Required | Description                                                                                                                                                                                    | Default         |
| ---------------------------- | -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------- |
| `enabled`                    | No       | Whether generic OAuth2 authentication is allowed.                                                                                                                                               | `false`         |
| `name`                       | No       | Name used to refer to the generic OAuth2 authentication from Grafana's user interface.                                                                                                         | `OAuth`         |
| `icon`                       | No       | Icon used for the generic OAuth2 authentication in Grafana's user interface.                                                                                                                   | `signin`        |
| `client_id`                  | Yes      | Client ID provided by your OAuth2 app.                                                                                                                                                         |                 |
| `client_secret`              | Yes      | Client secret provided by your OAuth2 app.                                                                                                                                                     |                 |
| `auth_url`                   | Yes      | Authorization endpoint of your OAuth2 provider.                                                                                                                                                 |                 |
| `token_url`                  | Yes      | Endpoint used to obtain OAuth2 access token.                                                                                                                                                    |                 |
| `api_url`                    | Yes      | Endpoint used to obtain user information compatible with [OpenID UserInfo](https://connect2id.com/products/server/docs/api/userinfo).                                                          |                 |
| `auth_style`                 | No       | Name of the [OAuth2 AuthStyle](https://pkg.go.dev/golang.org/x/oauth2#AuthStyle) to be used when ID token is requested from OAuth2 provider.                                                    | `AutoDetect`    |
| `scopes`                     | No       | List of comma- or space-separated OAuth2 scopes.                                                                                                                                                | `user:email`    |
| `empty_scopes`               | No       | Set to `true` to use an empty scope during authentication.                                                                                                                                     | `false`         |
| `allow_sign_up`              | No       | Whether to allow new Grafana user creation through generic OAuth2 login. If set to `false`, then only existing Grafana users can log in with generic OAuth.                                     | `true`          |
| `auto_login`                 | No       | Whether generic OAuth2 auto login is enabled. If set to `true`, then users will be able to log in skipping the login screen.                                                                    | `false`         |
| `id_token_attribute_name`    | No       | Name of the key used to extract the ID token from the returned OAuth2 token.                                                                                                                    | `id_token`      |
| `login_attribute_path`       | No       | [JMESPath](http://jmespath.org/examples.html) expression to use for user login lookup from the user ID token.                                                                                  |                 |
| `name_attribute_path`        | No       | [JMESPath](http://jmespath.org/examples.html) expression to use for user name lookup from the user ID token. This name will be used as user's display name.                                    |                 |
| `email_attribute_name`       | No       | Name of the key to use for user email lookup within the generic OAuth2 attribute map.                                                                                                           | `email:primary` |
| `role_attribute_path`        | No       | [JMESPath](http://jmespath.org/examples.html) expression to use for Grafana role lookup.                                                                                                       |                 |
| `role_attribute_strict`      | No       | Set to `true` to deny user login if Grafana role cannot be extracted using `role_attribute_path`.                                                                                              | `false`         |
| `allow_assign_grafana_admin` | No       | Set to `true` to enable automatic sync of Grafana server administrator role.                                                                                                                   | `false`         |
| `skip_org_role_sync`         | No       | Set to `true` to stop automatically syncing user roles.                                                                                                                                        | `false`         |
| `groups_attribute_path`      | No       | [JMESPath](http://jmespath.org/examples.html) expression to use for user group lookup.                                                                                                         |                 |
| `allowed_groups`             | No       | List of comma- or space-separated groups. User should be a member of at least one group to log in.                                                                                             |                 |
| `allowed_organizations`      | No       | List of comma- or space-separated organizations. User should be a member of at least one organization to log in.                                                                               |                 |
| `allowed_domains`            | No       | List of comma- or space-separated domains. User should belong to at least one domain to log in.                                                                                                |                 |
| `team_ids`                   | No       | String list of team IDs. If set, user has to be a member of one of the given teams to log in. Used together with `teams_url` and `team_ids_attribute_path`.                                    |                 |
| `team_ids_attribute_path`    | No       | [JMESPath](http://jmespath.org/examples.html) expression to use for Grafana team ID lookup within the results returned by `teams_url` endpoint. Used together with `team_ids` and `teams_url`. |                 |
| `teams_url`                  | No       | URL used to query for team IDs. If not set, defaults to `/teams`. Used together with `team_ids` and `team_ids_attribute_path`.                                                                 |                 |
| `tls_skip_verify_insecure`   | No       | If set to `true`, client will not verify the server's certificate chain and host name. Should only be set to `true` for testing purposes.                                                      | `false`         |
| `tls_client_cert`            | No       | Path of the certificate.                                                                                                                                                                       |                 |
| `tls_client_key`             | No       | Path to the key.                                                                                                                                                                               |                 |
| `tls_client_ca`              | No       | Path to the trusted certificate authority list.                                                                                                                                                |                 |
| `use_pkce`                   | No       | Set to `true` to use "proof key for code exchange" (PKCE).                                                                                                                                     | `false`         |

## Auth style

`auth_style` controls which [OAuth2 AuthStyle](https://pkg.go.dev/golang.org/x/oauth2#AuthStyle) is used when token is requested from OAuth2 provider. It determines how `client_id` and `client_secret` are sent to Oauth2 provider.
Available values are `AutoDetect`, `InParams` and `InHeader`. By default, `AutoDetect` is used.

### Email address

Grafana determines a user's email address by following the steps below until it finds and e-mail address:

1. Check for the presence of an e-mail address via the `email` field encoded in the OAuth2 ID token.
1. Check for the presence of an e-mail address using the [JMESPath](http://jmespath.org/examples.html) specified via the `email_attribute_path` configuration option. The JSON used for the path lookup is the HTTP response obtained from querying the UserInfo endpoint specified via the `api_url` configuration option.
1. Check for the presence of an e-mail address in the `attributes` map encoded in the OAuth2 ID token. By default Grafana will perform a lookup into the attributes map using the `email:primary` key, however, this is configurable and can be adjusted by using the `email_attribute_name` configuration option.
1. Query the `/emails` endpoint of the OAuth2 provider's API (configured with `api_url`), then check for the presence of an email address marked as a primary address.
1. If no email address is found in steps (1-4), then the email address of the user is set to an empty string.

### Login

Grafana determines a user's login by using the [JMESPath](http://jmespath.org/examples.html) specified via the `login_attribute_path` configuration option.
The order of operations is as follows:

1. Evaluate the `login_attribute_path` JMESPath expression against the OAuth2 ID token.
1. Evaluate the `login_attribute_path` JMESPath expression against the JSON data obtained from UserInfo endpoint, which is specified via the `api_url` configuration option.

### Display name

You can set a user's display name with [JMESPath](http://jmespath.org/examples.html) using the `name_attribute_path` configuration option. It operates the same way as the `login_attribute_path` option.

### Groups

Group mappings are made using [JMESPath](http://jmespath.org/examples.html) from the `groups_attribute_path` configuration option.
Grafana determines a user's groups by following the steps below until it finds the groups:

1. Evaluate the `groups_attribute_path` JMESPath expression against the OAuth2 ID token.
1. Evaluate the `groups_attribute_path` JMESPath expression against the JSON data obtained from UserInfo endpoint, which is specified via the `api_url` configuration option.

The result of the JMESPath expression should be a string array of groups.

You can limit access to Grafana to only members of a given group or list of groups by setting the `allowed_groups` option.

### Teams

OAuth2 provider teams are extracted using [JMESPath](http://jmespath.org/examples.html) expression from the `team_ids_attribute_path` configuration option.
The expression is evaluated against the JSON data obtained from Teams endpoint, which is specified via the `teams_url` configuration option.
The result should be a string array of OAuth2 provider team IDs.

If `team_ids` configuration option is set, only users who are members of at least one of the specified teams will be able to authenticate to Grafana using your OAuth2 provider.

### SSL/TLS configuration

You can specify the SSL/TLS configuration used by the client.

- Set `tls_client_cert` to the path of the certificate.
- Set `tls_client_key` to the path containing the key.
- Set `tls_client_ca` to the path containing a trusted certificate authority list.

`tls_skip_verify_insecure` controls whether a client verifies the server's certificate chain and host name. If it is true, then SSL/TLS accepts any certificate presented by the server and any host name in that certificate. _You should only use this for testing_, because this mode leaves SSL/TLS susceptible to man-in-the-middle attacks.

### PKCE

IETF's [RFC 7636](https://datatracker.ietf.org/doc/html/rfc7636)
introduces "proof key for code exchange" (PKCE) which provides
additional protection against some forms of authorization code
interception attacks. PKCE will be required in [OAuth 2.1](https://datatracker.ietf.org/doc/html/draft-ietf-oauth-v2-1-03).

You can enable PKCE in Grafana by setting `use_pkce` to `true` in the
`[auth.generic_oauth]` section.

```
use_pkce = true
```

Grafana always uses the SHA256 based `S256` challenge method and a 128 bytes (base64url encoded) code verifier.

### Configure refresh token

> **Note:** This feature is behind the `accessTokenExpirationCheck` feature toggle.

When a user logs in using an OAuth2 provider, Grafana verifies that the access token has not expired. When an access token expires, Grafana uses the provided refresh token (if any exists) to obtain a new access token.

Grafana uses a refresh token to obtain a new access token without requiring the user to log in again. If a refresh token doesn't exist, Grafana logs the user out of the system after the access token has expired.

To configure generic OAuth2 to use a refresh token, perform one or both of the following tasks, if required:

- Extend the `[auth.generic_oauth]` section with additional scopes
- Enable the refresh token on the provider

### Configure automatic login

Set `auto_login` option to true to attempt login automatically, skipping the login screen.
This setting is ignored if multiple auth providers are configured to use auto login.

### Skip organization role sync

To prevent the sync of organization roles from the OAuth2 provider, set `skip_org_role_sync` to `true`. This is useful if you want to manage the organization roles for your users from within Grafana.
This also impacts the `allow_assign_grafana_admin` setting by not syncing the Grafana admin role from the OAuth2 provider.

```ini
[auth.generic_oauth]
# ..
# prevents the sync of org roles from the Oauth2 provider
skip_org_role_sync = true
``
```

## Role Mapping

Unless [`skip_org_role_sync` option]({{< relref "#skip-organization-role-sync" >}}) is specified, user's role will be set to the role obtained from the auth provider upon user login.
User role is retrieved using [JMESPath](http://jmespath.org/examples.html) from the `role_attribute_path` configuration option.
Grafana determines a user's role by following the steps below until it finds a role:

1. Evaluate the `role_attribute_path` JMESPath expression against the OAuth2 ID token.
1. Evaluate the `role_attribute_path` JMESPath expression against the JSON data obtained from UserInfo endpoint, which is specified via the `api_url` configuration option.

The result after evaluation of the `role_attribute_path` JMESPath expression should be a valid Grafana role, for example, `Viewer`, `Editor` or `Admin`.

To ease configuration of a proper JMESPath expression, you can test/evaluate expressions with custom payloads at http://jmespath.org/.

For more information, refer to the [role mapping examples]({{< relref "#role-mapping-examples" >}}).

{{% admonition type="warning" %}}
Currently if no organization role mapping is found for a user, Grafana doesn't
update the user's organization role. This is going to change in Grafana 10. To avoid overriding manually set roles,
enable the `skip_org_role_sync` option.
See [Configure Grafana]({{< relref "../../../configure-grafana#authgeneric_oauth" >}}) for more information.
{{% /admonition %}}

On first login, if the `role_attribute_path` property does not return a role, then the user is assigned the role
specified by [the `auto_assign_org_role` option]({{< relref "../../../configure-grafana#auto_assign_org_role" >}}).
You can disable this default role assignment by setting `role_attribute_strict = true`.
It denies user access if no role or an invalid role is returned.

{{% admonition type="warning" %}}
With Grafana 10, **on every login**, if the`role_attribute_path` property does not return a role,
then the user is assigned the role specified by
[the `auto_assign_org_role` option]({{< relref "../../../configure-grafana#auto_assign_org_role" >}}).
{{% /admonition %}}

### Role mapping examples

#### Map user organization role

**Basic example:**

In the following example user will be granted `Editor` role. Role is determined by the value of the property `role` if it is a proper Grafana role, i.e. `Viewer`, `Editor` or `Admin`.

Payload:

```json
{
    ...
    "role": "Editor",
    ...
}
```

Config:

```bash
role_attribute_path = role
```

**Advanced example:**

In the following example user will be granted `Admin` role, since it has a role `admin`. If a user has a role `editor`, `Editor` role will be granted, otherwise `Viewer`.

Payload:

```json
{
    ...
    "info": {
        ...
        "roles": [
            "engineer",
            "admin",
        ],
        ...
    },
    ...
}
```

Config:

```bash
role_attribute_path = contains(info.roles[*], 'admin') && 'Admin' || contains(info.roles[*], 'editor') && 'Editor' || 'Viewer'
```

#### Map server administrator privileges

If the application role received by Grafana is `GrafanaAdmin`, Grafana grants the user server administrator privileges.  
This is useful if you want to grant server administrator privileges to a subset of users.  
Grafana also assigns the user the `Admin` role of the default organization.

The setting `allow_assign_grafana_admin` under `[auth.generic_oauth]` must be set to `true` for this to work.  
If the setting is set to `false`, the user is assigned the role of `Admin` of the default organization, but not server administrator privileges.

```ini
allow_assign_grafana_admin = true
```

Example:

```ini
role_attribute_path = contains(info.roles[*], 'admin') && 'GrafanaAdmin' || contains(info.roles[*], 'editor') && 'Editor' || 'Viewer'
```

## Team synchronization

> **Note:** Available in [Grafana Enterprise]({{< relref "../../../../introduction/grafana-enterprise" >}}) and [Grafana Cloud](/docs/grafana-cloud/).

With Team Sync you can map your generic OAuth2 groups to teams in Grafana so that the users are automatically added to the correct teams.

Generic OAuth2 groups can be referenced by group ID, like `8bab1c86-8fba-33e5-2089-1d1c80ec267d` or `myteam`.
Refer to [Groups]({{< relref "#groups" >}}) for information on how to configure OAuth2 groups with Grafana.

[Learn more about Team Sync]({{< relref "../../configure-team-sync" >}}).

### Team Sync example

Configuration:

```bash
groups_attribute_path = info.groups
```

Payload:

```json
{
    ...
    "info": {
        ...
        "groups": [
            "engineers",
            "analysts",
        ],
        ...
    },
    ...
}
```

## Examples of setting up generic OAuth

### Set up OAuth2 with Auth0

1. Create an application using the following parameters:

- Name: Grafana
- Type: Regular Web Application

1. Go to the `Settings` tab and set:

- Allowed Callback URLs: `https://<grafana domain>/login/generic_oauth`

1. Click `Save Changes`, then use the values from the `Settings` tab to configure Grafana:

   ```bash
   [auth.generic_oauth]
   enabled = true
   allow_sign_up = true
   auto_login = false
   team_ids =
   allowed_organizations =
   name = Auth0
   client_id = <client id>
   client_secret = <client secret>
   scopes = openid profile email offline_access
   auth_url = https://<domain>/authorize
   token_url = https://<domain>/oauth/token
   api_url = https://<domain>/userinfo
   use_pkce = true
   ```

### Set up OAuth2 with Bitbucket

1. Go to the `Settings` > `Workspace setting` > `OAuth consumers`

1. Create an application by selecting `Add consumer` and using the following parameters:

- Allowed Callback URLs: `https://<grafana domain>/login/generic_oauth`

1. Click `Save`, then use the `Key` and `Secret` from the consumer description to configure Grafana:

```bash
[auth.generic_oauth]
name = BitBucket
enabled = true
allow_sign_up = true
auto_login = false
client_id = <client key>
client_secret = <client secret>
scopes = account email
auth_url = https://bitbucket.org/site/oauth2/authorize
token_url = https://bitbucket.org/site/oauth2/access_token
api_url = https://api.bitbucket.org/2.0/user
teams_url = https://api.bitbucket.org/2.0/user/permissions/workspaces
team_ids_attribute_path = values[*].workspace.slug
team_ids =
allowed_organizations =
```

By default, a refresh token is included in the response for the **Authorization Code Grant**.

### Set up OAuth2 with OneLogin

1. Create a new Custom Connector with the following settings:

- Name: Grafana
- Sign On Method: OpenID Connect
- Redirect URI: `https://<grafana domain>/login/generic_oauth`
- Signing Algorithm: RS256
- Login URL: `https://<grafana domain>/login/generic_oauth`

1. Add an App to the Grafana Connector:

- Display Name: Grafana

1. Under the SSO tab on the Grafana App details page you'll find the Client ID and Client Secret.

   Your OneLogin Domain will match the URL you use to access OneLogin.

   Configure Grafana as follows:

   ```bash
   [auth.generic_oauth]
   name = OneLogin
   enabled = true
   allow_sign_up = true
   auto_login = false
   client_id = <client id>
   client_secret = <client secret>
   scopes = openid email name
   auth_url = https://<onelogin domain>.onelogin.com/oidc/2/auth
   token_url = https://<onelogin domain>.onelogin.com/oidc/2/token
   api_url = https://<onelogin domain>.onelogin.com/oidc/2/me
   team_ids =
   allowed_organizations =
   ```
