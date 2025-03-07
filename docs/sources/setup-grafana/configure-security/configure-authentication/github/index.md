---
aliases:
  - ../../../auth/github/
description: Configure GitHub OAuth2 authentication
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
menuTitle: GitHub OAuth2
title: Configure GitHub OAuth2 authentication
weight: 900
---

# Configure GitHub OAuth2 authentication

{{< docs/shared lookup="auth/intro.md" source="grafana" version="<GRAFANA VERSION>" >}}

This topic describes how to configure GitHub OAuth2 authentication.

{{% admonition type="note" %}}
If Users use the same email address in GitHub that they use with other authentication providers (such as Grafana.com), you need to do additional configuration to ensure that the users are matched correctly. Please refer to the [Using the same email address to login with different identity providers](../#using-the-same-email-address-to-login-with-different-identity-providers) documentation for more information.
{{% /admonition %}}

## Before you begin

Ensure you know how to create a GitHub OAuth app. Consult GitHub's documentation on [creating an OAuth app](https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/creating-an-oauth-app) for more information.

## Configure GitHub authentication client using the Grafana UI

{{% admonition type="note" %}}
Available in Public Preview in Grafana 10.4 behind the `ssoSettingsApi` feature toggle.
{{% /admonition %}}

As a Grafana Admin, you can configure GitHub OAuth2 client from within Grafana using the GitHub UI. To do this, navigate to **Administration > Authentication > GitHub** page and fill in the form. If you have a current configuration in the Grafana configuration file, the form will be pre-populated with those values. Otherwise the form will contain default values.

After you have filled in the form, click **Save** . If the save was successful, Grafana will apply the new configurations.

If you need to reset changes you made in the UI back to the default values, click **Reset**. After you have reset the changes, Grafana will apply the configuration from the Grafana configuration file (if there is any configuration) or the default values.

{{% admonition type="note" %}}
If you run Grafana in high availability mode, configuration changes may not get applied to all Grafana instances immediately. You may need to wait a few minutes for the configuration to propagate to all Grafana instances.
{{% /admonition %}}

Refer to [configuration options](#configuration-options) for more information.

## Configure GitHub authentication client using the Terraform provider

{{% admonition type="note" %}}
Available in Public Preview in Grafana 10.4 behind the `ssoSettingsApi` feature toggle. Supported in the Terraform provider since v2.12.0.
{{% /admonition %}}

```terraform
resource "grafana_sso_settings" "github_sso_settings" {
  provider_name = "github"
  oauth2_settings {
    name                  = "Github"
    client_id             = "YOUR_GITHUB_APP_CLIENT_ID"
    client_secret         = "YOUR_GITHUB_APP_CLIENT_SECRET"
    allow_sign_up         = true
    auto_login            = false
    scopes                = "user:email,read:org"
    team_ids              = "150,300"
    allowed_organizations = "[\"My Organization\", \"Octocats\"]"
    allowed_domains       = "mycompany.com mycompany.org"
    role_attribute_path   = "[login=='octocat'][0] && 'GrafanaAdmin' || 'Viewer'"
  }
}
```

Go to [Terraform Registry](https://registry.terraform.io/providers/grafana/grafana/latest/docs/resources/sso_settings) for a complete reference on using the `grafana_sso_settings` resource.

## Configure GitHub authentication client using the Grafana configuration file

Ensure that you have access to the [Grafana configuration file](../../../configure-grafana/#configuration-file-location).

### Configure GitHub authentication

To configure GitHub authentication with Grafana, follow these steps:

1. Create an OAuth application in GitHub.
1. Set the callback URL for your GitHub OAuth app to `http://<my_grafana_server_name_or_ip>:<grafana_server_port>/login/github`.

   Ensure that the callback URL is the complete HTTP address that you use to access Grafana via your browser, but with the appended path of `/login/github`.

   For the callback URL to be correct, it might be necessary to set the `root_url` option in the `[server]`section of the Grafana configuration file. For example, if you are serving Grafana behind a proxy.

1. Refer to the following table to update field values located in the `[auth.github]` section of the Grafana configuration file:

   | Field                        | Description                                                                         |
   | ---------------------------- | ----------------------------------------------------------------------------------- |
   | `client_id`, `client_secret` | These values must match the client ID and client secret from your GitHub OAuth app. |
   | `enabled`                    | Enables GitHub authentication. Set this value to `true`.                            |

   Review the list of other GitHub [configuration options](#configuration-options) and complete them, as necessary.

1. [Configure role mapping](#configure-role-mapping).
1. Optional: [Configure team synchronization](#configure-team-synchronization).
1. Restart Grafana.

   You should now see a GitHub login button on the login page and be able to log in or sign up with your GitHub accounts.

### Configure role mapping

Unless `skip_org_role_sync` option is enabled, the user's role will be set to the role retrieved from GitHub upon user login.

The user's role is retrieved using a [JMESPath](http://jmespath.org/examples.html) expression from the `role_attribute_path` configuration option.
To map the server administrator role, use the `allow_assign_grafana_admin` configuration option.
Refer to [configuration options](#configuration-options) for more information.

If no valid role is found, the user is assigned the role specified by [the `auto_assign_org_role` option](../../../configure-grafana/#auto_assign_org_role).
You can disable this default role assignment by setting `role_attribute_strict = true`. This setting denies user access if no role or an invalid role is returned after evaluating the `role_attribute_path` and the `org_mapping` expressions.

You can use the `org_mapping` configuration options to assign the user to organizations and specify their role based on their GitHub team membership. For more information, refer to [Org roles mapping example](#org-roles-mapping-example). If both org role mapping (`org_mapping`) and the regular role mapping (`role_attribute_path`) are specified, then the user will get the highest of the two mapped roles.

To ease configuration of a proper JMESPath expression, go to [JMESPath](http://jmespath.org/) to test and evaluate expressions with custom payloads.

#### Role mapping examples

This section includes examples of JMESPath expressions used for role mapping.

##### Org roles mapping example

The GitHub integration uses the external users' teams in the `org_mapping` configuration to map organizations and roles based on their GitHub team membership.

In this example, the user has been granted the role of a `Viewer` in the `org_foo` organization, and the role of an `Editor` in the `org_bar` and `org_baz` orgs.

The external user is part of the following GitHub teams: `@my-github-organization/my-github-team-1` and `@my-github-organization/my-github-team-2`.

Config:

```ini
org_mapping = @my-github-organization/my-github-team-1:org_foo:Viewer @my-github-organization/my-github-team-2:org_bar:Editor *:org_baz:Editor
```

##### Map roles using GitHub user information

In this example, the user with login `octocat` has been granted the `Admin` role.
All other users are granted the `Viewer` role.

```bash
role_attribute_path = [login=='octocat'][0] && 'Admin' || 'Viewer'
```

##### Map roles using GitHub teams

In this example, the user from GitHub team `my-github-team` has been granted the `Editor` role.
All other users are granted the `Viewer` role.

```bash
role_attribute_path = contains(groups[*], '@my-github-organization/my-github-team') && 'Editor' || 'Viewer'
```

#### Map server administrator role

In this example, the user with login `octocat` has been granted the `Admin` organization role as well as the Grafana server admin role.
All other users are granted the `Viewer` role.

```bash
role_attribute_path = [login=='octocat'][0] && 'GrafanaAdmin' || 'Viewer'
```

##### Map one role to all users

In this example, all users will be assigned `Viewer` role regardless of the user information received from the identity provider.

```ini
role_attribute_path = "'Viewer'"
skip_org_role_sync = false
```

### Example of GitHub configuration in Grafana

This section includes an example of GitHub configuration in the Grafana configuration file.

```bash
[auth.github]
enabled = true
client_id = YOUR_GITHUB_APP_CLIENT_ID
client_secret = YOUR_GITHUB_APP_CLIENT_SECRET
scopes = user:email,read:org
auth_url = https://github.com/login/oauth/authorize
token_url = https://github.com/login/oauth/access_token
api_url = https://api.github.com/user
allow_sign_up = true
auto_login = false
team_ids = 150,300
allowed_organizations = ["My Organization", "Octocats"]
allowed_domains = mycompany.com mycompany.org
role_attribute_path = [login=='octocat'][0] && 'GrafanaAdmin' || 'Viewer'
```

## Configure team synchronization

{{< admonition type="note" >}}
Available in [Grafana Enterprise](../../../../introduction/grafana-enterprise/) and Grafana Cloud.
{{< /admonition >}}

By using Team Sync, you can map teams from your GitHub organization to teams within Grafana. This will automatically assign users to the appropriate teams.
Teams for each user are synchronized when the user logs in.

GitHub teams can be referenced in two ways:

- `https://github.com/orgs/<org>/teams/<slug>`
- `@<org>/<slug>`

Examples: `https://github.com/orgs/grafana/teams/developers` or `@grafana/developers`.

To learn more about Team Sync, refer to [Configure team sync](../../configure-team-sync/).

## Configuration options

The table below describes all GitHub OAuth configuration options. Like any other Grafana configuration, you can apply these options as environment variables.

| Setting                      | Required | Description                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           | Default                                       |
| ---------------------------- | -------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------- |
| `enabled`                    | No       | Whether GitHub OAuth authentication is allowed.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       | `false`                                       |
| `name`                       | No       | Name used to refer to the GitHub authentication in the Grafana user interface.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        | `GitHub`                                      |
| `icon`                       | No       | Icon used for GitHub authentication in the Grafana user interface.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    | `github`                                      |
| `client_id`                  | Yes      | Client ID provided by your GitHub OAuth app.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |                                               |
| `client_secret`              | Yes      | Client secret provided by your GitHub OAuth app.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |                                               |
| `auth_url`                   | Yes      | Authorization endpoint of your GitHub OAuth provider.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | `https://github.com/login/oauth/authorize`    |
| `token_url`                  | Yes      | Endpoint used to obtain GitHub OAuth access token.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    | `https://github.com/login/oauth/access_token` |
| `api_url`                    | Yes      | Endpoint used to obtain GitHub user information compatible with [OpenID UserInfo](https://connect2id.com/products/server/docs/api/userinfo).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          | `https://api.github.com/user`                 |
| `scopes`                     | No       | List of comma- or space-separated GitHub OAuth scopes.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                | `user:email,read:org`                         |
| `allow_sign_up`              | No       | Whether to allow new Grafana user creation through GitHub login. If set to `false`, then only existing Grafana users can log in with GitHub OAuth.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    | `true`                                        |
| `auto_login`                 | No       | Set to `true` to enable users to bypass the login screen and automatically log in. This setting is ignored if you configure multiple auth providers to use auto-login.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                | `false`                                       |
| `role_attribute_path`        | No       | [JMESPath](http://jmespath.org/examples.html) expression to use for Grafana role lookup. Grafana will first evaluate the expression using the user information obtained from the UserInfo endpoint. If no role is found, Grafana creates a JSON data with `groups` key that maps to GitHub teams obtained from GitHub's [`/api/user/teams`](https://docs.github.com/en/rest/teams/teams#list-teams-for-the-authenticated-user) endpoint, and evaluates the expression using this data. The result of the evaluation should be a valid Grafana role (`None`, `Viewer`, `Editor`, `Admin` or `GrafanaAdmin`). For more information on user role mapping, refer to [Configure role mapping](#org-roles-mapping-example). |                                               |
| `role_attribute_strict`      | No       | Set to `true` to deny user login if the Grafana org role cannot be extracted using `role_attribute_path` or `org_mapping`. For more information on user role mapping, refer to [Configure role mapping](#org-roles-mapping-example).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  | `false`                                       |
| `org_mapping`                | No       | List of comma- or space-separated `<ExternalGitHubTeamName>:<OrgIdOrName>:<Role>` mappings. Value can be `*` meaning "All users". Role is optional and can have the following values: `None`, `Viewer`, `Editor` or `Admin`. For more information on external organization to role mapping, refer to [Org roles mapping example](#org-roles-mapping-example).                                                                                                                                                                                                                                                                                                                                                         |                                               |
| `allow_assign_grafana_admin` | No       | Set to `true` to enable automatic sync of the Grafana server administrator role. If this option is set to `true` and the result of evaluating `role_attribute_path` for a user is `GrafanaAdmin`, Grafana grants the user the server administrator privileges and organization administrator role. If this option is set to `false` and the result of evaluating `role_attribute_path` for a user is `GrafanaAdmin`, Grafana grants the user only organization administrator role. For more information on user role mapping, refer to [Configure role mapping](#configure-role-mapping).                                                                                                                             | `false`                                       |
| `skip_org_role_sync`         | No       | Set to `true` to stop automatically syncing user roles.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               | `false`                                       |
| `allowed_organizations`      | No       | List of comma- or space-separated organizations. User must be a member of at least one organization to log in.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |                                               |
| `allowed_domains`            | No       | List of comma- or space-separated domains. User must belong to at least one domain to log in.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |                                               |
| `team_ids`                   | No       | Integer list of team IDs. If set, user has to be a member of one of the given teams to log in.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |                                               |
| `tls_skip_verify_insecure`   | No       | If set to `true`, the client accepts any certificate presented by the server and any host name in that certificate. _You should only use this for testing_, because this mode leaves SSL/TLS susceptible to man-in-the-middle attacks.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                | `false`                                       |
| `tls_client_cert`            | No       | The path to the certificate.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |                                               |
| `tls_client_key`             | No       | The path to the key.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |                                               |
| `tls_client_ca`              | No       | The path to the trusted certificate authority list.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |                                               |
