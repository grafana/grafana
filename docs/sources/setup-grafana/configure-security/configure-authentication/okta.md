---
aliases:
  - /docs/grafana/latest/auth/okta/
  - /docs/grafana/latest/setup-grafana/configure-security/configure-authentication/okta/
description: Grafana Okta OAuth Guide
title: Configure Okta OAuth2 authentication
weight: 1200
---

# Configure Okta OAuth2 authentication

> Only available in Grafana v7.0+

The Okta authentication allows your Grafana users to log in by using an external Okta authorization server.

## Create an Okta application

Before you can sign a user in, you need to create an Okta application from the Okta Developer Console.

1. Log in to the [Okta portal](https://login.okta.com/).

1. Go to Admin and then select **Developer Console**.

1. Select **Applications**, then **Add Application**.

1. Pick **Web** as the platform.

1. Enter a name for your application (or leave the default value).

1. Add the **Base URI** of your application, such as https://grafana.example.com.

1. Enter values for the **Login redirect URI**. Use **Base URI** and append it with `/login/okta`, for example: https://grafana.example.com/login/okta.

1. Click **Done** to finish creating the Okta application.

## Enable Okta OAuth in Grafana

1. Add the following to the [Grafana configuration file]({{< relref "../../configure-grafana/#config-file-locations" >}}):

```ini
[auth.okta]
name = Okta
icon = okta
enabled = true
allow_sign_up = true
client_id = some_id
client_secret = some_secret
scopes = openid profile email groups
auth_url = https://<tenant-id>.okta.com/oauth2/v1/authorize
token_url = https://<tenant-id>.okta.com/oauth2/v1/token
api_url = https://<tenant-id>.okta.com/oauth2/v1/userinfo
allowed_domains =
allowed_groups =
role_attribute_path =
```

### Configure allowed groups and domains

To limit access to authenticated users that are members of one or more groups, set `allowed_groups`
to a comma- or space-separated list of Okta groups.

```ini
allowed_groups = Developers, Admins
```

The `allowed_domains` option limits access to the users belonging to the specific domains. Domains should be separated by space or comma.

```ini
allowed_domains = mycompany.com mycompany.org
```

### Map roles

Grafana can attempt to do role mapping through Okta OAuth. In order to achieve this, Grafana checks for the presence of a role using the [JMESPath](http://jmespath.org/examples.html) specified via the `role_attribute_path` configuration option.

Grafana uses JSON obtained from querying the `/userinfo` endpoint for the path lookup. The result after evaluating the `role_attribute_path` JMESPath expression needs to be a valid Grafana role, i.e. `Viewer`, `Editor` or `Admin`. For more information about roles and permissions in Grafana, refer to [Roles and permissions]({{< relref "../../../administration/roles-and-permissions/" >}}).

Read about how to [add custom claims](https://developer.okta.com/docs/guides/customize-tokens-returned-from-okta/add-custom-claim/) to the user info in Okta. Also, check Generic OAuth page for [JMESPath examples]({{< relref "generic-oauth/#jmespath-examples" >}}).

#### Map server administrator privileges

> Available in Grafana v9.2 and later versions.

If the application role received by Grafana is `GrafanaAdmin`, Grafana grants the user server administrator privileges.  
This is useful if you want to grant server administrator privileges to a subset of users.  
Grafana also assigns the user the `Admin` role of the default organization.

The setting `allow_assign_grafana_admin` under `[auth.okta]` must be set to `true` for this to work.  
If the setting is set to `false`, the user is assigned the role of `Admin` of the default organization, but not server administrator privileges.

```ini
allow_assign_grafana_admin = true
```

Example:

```ini
role_attribute_path = contains(groups[*], 'admin') && 'GrafanaAdmin' || contains(groups[*], 'editor') && 'Editor' || 'Viewer'
```

### Team Sync (Enterprise only)

Map your Okta groups to teams in Grafana so that your users will automatically be added to
the correct teams.

Okta groups can be referenced by group name, like `Admins`.

[Learn more about Team Sync]({{< relref "../configure-team-sync/" >}})
