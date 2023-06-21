---
aliases:
  - ../../../auth/github/
description: Configure GitHub OAuth2 authentication
keywords:
  - grafana
  - configuration
  - documentation
  - oauth
title: Configure GitHub OAuth2 authentication
weight: 1400
---

# Configure GitHub OAuth2 authentication

To enable the GitHub OAuth2 you must register your application with GitHub. GitHub will generate a client ID and secret key for you to use.

## Steps

Follow these steps to set up GitHub OAuth2 authentication with Grafana:

1. Create a GitHub OAuth application.
1. Set the callback URL for your GitHub app to `http://<my_grafana_server_name_or_ip>:<grafana_server_port>/login/github`.
1. Update `[auth.github]` section of Grafana configuration file with client ID and client secret from you GitHub app. You must specify the following configuration options:

   - `enabled`
   - `client_id`
   - `client_secret`

1. (Optional) Look at the list of optional Grafana GitHub OAuth configuration options and fill in the desired ones.
1. Configure [role mapping]({{< relref "#role-mapping" >}}).
1. (Optional) Configure [team synchronization]({{< relref "#team-synchronization" >}}).
1. Restart Grafana. You should now see a GitHub login button
   on the login page and be able to login or sign up with your GitHub accounts.

Continue reading this documentation to learn more about how to [configure GitHub OAuth application]({{< relref "#configure-github-oauth-application" >}}) and [enable GitHub in Grafana]({{< relref "#enable-github-in-grafana" >}}).

## Configure GitHub OAuth application

You need to create a GitHub OAuth application (you will find this under the GitHub settings page). When you create the application you will need to specify
a callback URL. Specify this as callback:

```bash
http://<my_grafana_server_name_or_ip>:<grafana_server_port>/login/github
```

> Note: <my_grafana_server_name_or_ip>'s value should match your grafana server's `root_url`, the URL used to access grafana.

This callback URL must match the full HTTP address that you use in your browser to access Grafana, but with the suffix path of `/login/github`.

You may have to set the `root_url` option of `[server]` for the callback URL to be
correct. For example in case you are serving Grafana behind a proxy.

When the GitHub OAuth application is created you will get a Client ID and a
Client Secret. Specify these in the Grafana configuration file.

## Enable GitHub in Grafana

On Grafana's side GitHub OAuth integration is configured through Grafana configuration file. See an example configuration below.

Continue reading this document for more details on GitHub OAuth [configuration options]({{< relref "#configuration-options" >}}).

```bash
[auth.github]
enabled = true
allow_sign_up = true
auto_login = false
client_id = YOUR_GITHUB_APP_CLIENT_ID
client_secret = YOUR_GITHUB_APP_CLIENT_SECRET
scopes = user:email,read:org
auth_url = https://github.com/login/oauth/authorize
token_url = https://github.com/login/oauth/access_token
api_url = https://api.github.com/user
team_ids = 150,300
allowed_organizations = ["My Organization", "Octocats"]
allowed_domains = mycompany.com mycompany.org
```

## Configuration options

The table below describes all GitHub OAuth configuration options. Continue reading below for details on specific options. Like any other Grafana configuration, you can apply these options as environment variables.

| Setting                      | Required | Description                                                                                                                                              | Default                                       |
| ---------------------------- | -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------- |
| `enabled`                    | No       | Whether GitHub OAuth authentication is allowed.                                                                                                          | `false`                                       |
| `name`                       | No       | Name used to refer to the GitHub OAauth authentication from Grafana's user interface.                                                                    | `GitHub`                                      |
| `icon`                       | No       | Icon used for GitHub OAauth authentication in Grafana's user interface.                                                                                  | `github`                                      |
| `client_id`                  | Yes      | Client ID provided by your GitHub OAuth2 app.                                                                                                            |                                               |
| `client_secret`              | Yes      | Client secret provided by your GitHub OAuth2 app.                                                                                                        |                                               |
| `auth_url`                   | No       | Authorization endpoint of your GitHub OAuth provider.                                                                                                    | `https://github.com/login/oauth/authorize`    |
| `token_url`                  | No       | Endpoint used to obtain GitHub OAuth access token.                                                                                                       | `https://github.com/login/oauth/access_token` |
| `api_url`                    | No       | Endpoint used to obtain GitHub user information compatible with [OpenID UserInfo](https://connect2id.com/products/server/docs/api/userinfo).             | `https://api.github.com/user`                 |
| `scopes`                     | No       | List of comma- or space-separated GitHub OAuth scopes.                                                                                                   | `user:email,read:org`                         |
| `allow_sign_up`              | No       | Whether to allow new Grafana user creation through GitHub OAuth login. If set to `false`, then only existing Grafana users can log in with GitHub OAuth. | `true`                                        |
| `auto_login`                 | No       | Whether GitHub OAuth auto login is enabled. If set to `true`, then users will be able to log in skipping the login screen.                               | `false`                                       |
| `role_attribute_path`        | No       | [JMESPath](http://jmespath.org/examples.html) expression to use for Grafana role lookup.                                                                 |                                               |
| `role_attribute_strict`      | No       | Set to `true` to deny user login if Grafana role cannot be extracted using `role_attribute_path`.                                                        | `false`                                       |
| `allow_assign_grafana_admin` | No       | Set to `true` to enable automatic sync of Grafana server administrator role.                                                                             | `false`                                       |
| `skip_org_role_sync`         | No       | Set to `true` to stop automatically syncing user roles.                                                                                                  | `false`                                       |
| `allowed_organizations`      | No       | List of comma- or space-separated organizations. User should be a member of at least one organization to log in.                                         |                                               |
| `allowed_domains`            | No       | List of comma- or space-separated domains. User should belong to at least one domain to log in.                                                          |                                               |
| `team_ids`                   | No       | String list of team IDs. If set, user has to be a member of one of the given teams to log in.                                                            |                                               |
| `tls_skip_verify_insecure`   | No       | If set to `true`, client will not verify the server's certificate chain and host name. Should only be set to `true` for testing purposes.                | `false`                                       |
| `tls_client_cert`            | No       | Path of the certificate.                                                                                                                                 |                                               |
| `tls_client_key`             | No       | Path to the key.                                                                                                                                         |                                               |
| `tls_client_ca`              | No       | Path to the trusted certificate authority list.                                                                                                          |                                               |

### Configure automatic login

Set `auto_login` option to `true` to attempt login automatically, skipping the login screen.
This setting is ignored if multiple auth providers are configured to use auto login.

### Configuring sign up

You may allow new users to sign-up via GitHub authentication by setting the `allow_sign_up` option to `true`.
When this option is set to `true`, any user successfully authenticating via GitHub authentication will be automatically signed up.

### Skip organization role sync

To prevent the sync of organization roles from GitHub, set `skip_org_role_sync` to `true`. This is useful if you want to manage the organization roles for your users from within Grafana.
This also impacts the `allow_assign_grafana_admin` setting by not syncing the Grafana admin role from GitHub.

### Configure allowed teams

Use `team_ids` option to restrict access to Grafana only to members of some GitHub teams.

Grafana will require an active team membership for at least one of the given teams.
If the authenticated user isn't a member of at least one of the
teams they will not be able to register or authenticate with your
Grafana instance. For example:

```bash
[auth.github]
team_ids = 150,300
```

### Configure allowed organizations

Use `allowed_organizations` option to restrict access to Grafana only to members of some GitHub organizations.

Grafana will require an active organization membership for at least one of the given organizations.
If the authenticated user isn't a member of at least
one of the organizations they will not be able to register or authenticate with
your Grafana instance. For example

```bash
[auth.github]
# space-delimited organization names
allowed_organizations = ["My Organization", "Octocats"]
```

### Configure allowed domains

Use `allowed_domains` option to restrict access to Grafana only to users from one of the specified domains.

Grafana will require the user to come from one of the specified domains, otherwise they will not be able to register or authenticate with your
Grafana instance. For example:

```bash
[auth.github]
allowed_domains = mycompany.com mycompany.org
```

### GitHub refresh token

> **Note:** This feature is behind the `accessTokenExpirationCheck` feature toggle.

GitHub OAuth applications do not support refresh tokens because the provided access tokens do not expire.

## Role Mapping

When a user logs into Grafana using GitHub OAuth integration, Grafana will update their organization role to the role obtained from GitHub.

Grafana follows these steps to determine user's role until a role is found:

1. Check for the role using JSON data obtained from GitHub's [`/api/user`](https://docs.github.com/en/rest/users/users#get-the-authenticated-user=) endpoint by parsing it using the [JMESPath](http://jmespath.org/examples.html) expression specified via the `role_attribute_path` configuration option.
1. Create JSON data with `groups` key that maps to GitHub teams obtained from GitHub's [`/api/user/teams`](https://docs.github.com/en/rest/teams/teams#list-teams-for-the-authenticated-user) endpoint. Parse this JSON data using the [JMESPath](http://jmespath.org/examples.html) expression specified via the `role_attribute_path` configuration option.
1. Use the role specified by the `auto_assign_org_role` configuration option if `role_attribute_strict` configuration option is set to `false`.
1. Prevent the user from logging in if `role_attribute_strict` is set to `true`.

The result of evaluating the `role_attribute_path` JMESPath expression must be a valid Grafana role, for example, `Viewer`, `Editor` or `Admin`.
For more information about roles and permissions in Grafana, refer to [Roles and permissions]({{< relref "../../../../administration/roles-and-permissions" >}}).

To ease configuration of a proper JMESPath expression, you can test expressions with custom payloads at http://jmespath.org/.

If you don't want to sync user roles through GitHup provider, set [`skip_org_role_sync` option]({{< relref "#skip-organization-role-sync" >}}) config option to `true`.

If you want to restrict user login to only users that have a valid role in their GitHub user info or teams, set `role_attribute_strict` to `true`.

#### Map roles using information from GitHub's user data

This example query allows the user with login `octocat` to be mapped to the `Admin` role.
All other users will be mapped to the `Viewer` role.

```bash
role_attribute_path = [login==octocat] && 'Admin' || 'Viewer'
```

#### Map roles using teams

This example query maps users from team called `my-github-team` to the `Editor` role.
All other users will be mapped to the `Viewer` role.

```bash
role_attribute_path = contains(groups[*], '@my-github-organization/my-github-team') && 'Editor' || 'Viewer'
```

#### Map server administrator privileges

If the application role received by Grafana is `GrafanaAdmin`, Grafana grants the user server administrator privileges.  
This is useful if you want to grant server administrator privileges to a subset of users.  
Grafana also assigns the user the `Admin` role of the default organization.

The setting `allow_assign_grafana_admin` configuration option must be set to `true` for this to work.  
If the setting is set to `false`, the user is assigned the role of `Admin` of the default organization, but not server administrator privileges.

```ini
allow_assign_grafana_admin = true
```

Example:

```ini
role_attribute_path = [login==octocat] && 'GrafanaAdmin' || 'Viewer'
```

## Team synchronization

> **Note:** Available in [Grafana Enterprise]({{< relref "../../../../introduction/grafana-enterprise" >}}) and [Grafana Cloud](/docs/grafana-cloud/).

With Team Sync you can map your GitHub org teams to teams in Grafana so that your users will automatically be added to
the correct teams when they log in.

Your GitHub teams can be referenced in two ways:

- `https://github.com/orgs/<org>/teams/<slug>`
- `@<org>/<slug>`

Example: `@grafana/developers`

[Learn more about Team Sync]({{< relref "../../configure-team-sync" >}}).
