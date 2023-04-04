---
aliases:
  - ../../../auth/okta/
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

2. Go to **Admin** and then select **Developer Console**.

3. Select **Applications** -> **Applications**, then **Create App Integration**.

4. Select the **Sign-in method** - “OIDC - OpenID Connect”

5. Select the **Application type** - “Web Application” and then select Next.

6. Configure the **Web App Integration Options**:
  * **App integration name** - Name of your application
  * **Logo** (Optional)
  * **Grant type** - “Authorization Code”
  * **Sign-in redirect URIs**
    * if cloud: `https://<org>.grafana.net/login/okta`
    * if self hosted: `https://<base grafana url>/login/okta`
  * **Sign-out redirect URIs** (Optional)
    * if cloud: `https://<org>.grafana.net/login/okta`
    * if self hosted: `https://<base grafana url>/login/okta`
  * **Base URIs** (Optional)
    * if cloud: `https://<org>.grafana.net`
    * if self hosted: `https://<base grafana url>`
  * **Controlled access** - Select whether to assign the app integration to everyone in your org, only selected group(s), or skip assignment until after app creation.

7. Click **Done** to finish creating the Okta application.

## Enable Okta OAuth in Grafana Instance

### Grafana Self-Hosted

> **Note:** If you are hosting your own Grafana instance ensure it is accessed over HTTPS. Okta requires secure communcation for exchanging authentication infomraiton between the browser and the idenitity provider.

1. Add the following to the [Grafana configuration file]({{< relref "../administration/configuration.md#config-file-locations" >}}):

```ini
[auth.okta]
name = Okta
icon = okta
enabled = true
allow_sign_up = true
client_id = Copy and paste Client ID from Okta Application created in previous steps
client_secret = Copy and paste Client Secret from Okta Application created in previous steps
scopes = openid profile email groups
auth_url = https://<tenant-id>.okta.com/oauth2/v1/authorize
token_url = https://<tenant-id>.okta.com/oauth2/v1/token
api_url = https://<tenant-id>.okta.com/oauth2/v1/userinfo
allowed_domains = Optional
allowed_groups = Optional
role_attribute_path = Optional
```

### Grafana Cloud
1. From your org Control Panel on grafana.com, under **Security** select **Advanced Auth**
2. Select the **Okta** icon
3. Fill in the Configuration options:
- **Client ID**: Copy and paste Client ID from Okta Application created in previous steps
- **Client Secret**:  Copy and paste Client Secret from Okta Application created in previous steps
- **Auth URL**: https://<tenant-id>.okta.com/oauth2/v1/authorize
- **Token URL**: https://<tenant-id>.okta.com/oauth2/v1/token
- **API URL**: https://<tenant-id>.okta.com/oauth2/v1/userinfo
- **Allowed Groups**: Optional
- **Allowed Domains**: Optional

> **Note:** At this point you should now be able to login via Okta`

### Configure refresh token

> Available in Grafana v9.3 and later versions.

> **Note:** This feature is behind the `accessTokenExpirationCheck` feature toggle.

When a user logs in using an OAuth provider, Grafana verifies that the access token has not expired. When an access token expires, Grafana uses the provided refresh token (if any exists) to obtain a new access token.

Grafana uses a refresh token to obtain a new access token without requiring the user to log in again. If a refresh token doesn't exist, Grafana logs the user out of the system after the access token has expired.

1. To enable the `Refresh Token`, grant type in the `General Settings` section.
1. Extend the `scopes` in `[auth.okta]` with `offline_access`.

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

To put values containing spaces in the list, use the following JSON syntax:

```ini
allowed_groups = ["Admins", "Software Engineers"]
```

### Map roles

Grafana can attempt to do role mapping through Okta OAuth. In order to achieve this, Grafana checks for the presence of a role using the [JMESPath](http://jmespath.org/examples.html) specified via the `role_attribute_path` configuration option.

Grafana uses JSON obtained from querying the `/userinfo` endpoint for the path lookup. The result after evaluating the `role_attribute_path` JMESPath expression needs to be a valid Grafana role, i.e. `Viewer`, `Editor` or `Admin`. For more information about roles and permissions in Grafana, refer to [Roles and permissions]({{< relref "../../../../administration/roles-and-permissions/" >}}).

> **Warning**: Currently if no organization role mapping is found for a user, Grafana doesn't
> update the user's organization role. This is going to change in Grafana 10. To avoid overriding manually set roles,
> enable the `skip_org_role_sync` option.
> See [configure-grafana]({{< relref "../../../configure-grafana#authokta-skip-org-role-sync" >}}) for more information.

On first login, if the`role_attribute_path` property does not return a role, then the user is assigned the role
specified by [the `auto_assign_org_role` option]({{< relref "../../../configure-grafana#auto_assign_org_role" >}}).
You can disable this default role assignment by setting `role_attribute_strict = true`.
It denies user access if no role or an invalid role is returned.

> **Warning**: With Grafana 10, **on every login**, if the`role_attribute_path` property does not return a role,
> then the user is assigned the role specified by
> [the `auto_assign_org_role` option]({{< relref "../../../configure-grafana#auto_assign_org_role" >}}).

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

## Skip organization role sync

To prevent the sync of org roles from Okta, set `skip_org_role_sync` to `true`. This is useful if you want to manage the organization roles for your users from within Grafana.

```ini
[auth.okta]
# ..
# prevents the sync of org roles from Okta
skip_org_role_sync = true
```

### Team Sync (Enterprise only)

Map your Okta groups to teams in Grafana so that your users will automatically be added to
the correct teams.

Okta groups can be referenced by group name, like `Admins`.

[Learn more about Team Sync]({{< relref "../../configure-team-sync/" >}})
