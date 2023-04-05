---
aliases:
  - ../../../auth/okta/
description: Grafana Okta OAuth Guide
title: Configure Okta OAuth2 authentication
weight: 1200
---

# Configure Okta OAuth2 authentication

The Okta authentication enables Grafana users to sign in by using an external Okta authorization server.

## Before you begin

To complete this guide, you need:

- [item 1]
- [item 2]

## Create an Okta application

Complete the following steps to create an Okta application.

1. Log in to the [Okta portal](https://login.okta.com/).

1. Click **Admin** and then click **Developer Console**.

1. Click **Applications > Applications**.

1. Click **Create App Integration**.

1. In the **Sign-in method** field, select `OIDC - OpenID Connect`.

1. In the **Application type** field, select `Web Application` and then click **Next**.

1. Complete the following **Web App Integration Options** fields:

   | Field                             | Description                                                                                                                                                 |
   | --------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
   | App integration name              | Enter an application name.                                                                                                                                  |
   | Logo (Optional)                   | Add a logo.                                                                                                                                                 |
   | Grant type                        | Select `Authorization Code`.                                                                                                                                |
   | Sign-in redirect URIs             | If you have a Grafana Cloud account, enter `https://<org>.grafana.net/login/okta`. If you self-host Grafana, enter `https://<base grafana url>/login/okta`. |
   | Sign-out redirect URIs (Optional) | If you have a Grafana Cloud account, enter `https://<org>.grafana.net/login/okta`. If you self-host Grafana, enter `https://<base grafana url>/login/okta`. |
   | Base URIs (Optional)              | If you have a Grafana Cloud account, enter `https://<org>.grafana.net`. If you self-host Grafana, enter `https://<base grafana url>`.                       |
   | Controlled access                 | Select whether to assign the app integration to everyone in your org, only selected group(s), or skip the assignment until after app creation.              |

1. Click **Done**.

## Enable Okta OAuth in a Grafana instance

This section includes tasks you must complete to enable Okta OAuth in self-hosted Grafana or Grafana Cloud.

### Enable Okta OAuth in self-hosted Grafana

If you are hosting your own Grafana instance, ensure it is [accessed over HTTPS]({{< relref "../../../set-up-https" >}}). Okta requires secure communcation for exchanging authentication information between the browser and the idenitity provider.

To enable Okta OAuth in self-hosted Grafana, add the following parameters to the [Grafana configuration file]({{< relref "../../../configure-grafana#configuration-file-location" >}}):

```ini
[auth.okta]
name = Okta
icon = okta
enabled = true
allow_sign_up = true
client_id = Copy and paste the Client ID from the Okta application you previously created
client_secret = Copy and paste the Client Secret from the Okta application you previously created
scopes = openid profile email groups
auth_url = https://<tenant-id>.okta.com/oauth2/v1/authorize
token_url = https://<tenant-id>.okta.com/oauth2/v1/token
api_url = https://<tenant-id>.okta.com/oauth2/v1/userinfo
allowed_domains = Optional
allowed_groups = Optional
role_attribute_path = Optional
```

### Enable Okta OAuth in Grafana Cloud

To enable Okta OAuth in Grafana Cloud, complete the following steps:

1. From your org Control Panel on grafana.com, under **Security**, click **Advanced Auth**
1. Click the **Okta** icon.
1. Complete the following configuration options:

   | Field                      | Description                                                                   |
   | -------------------------- | ----------------------------------------------------------------------------- |
   | Client ID                  | Copy and paste Client ID from Okta Application created in previous steps.     |
   | Client Secret              | Copy and paste Client Secret from Okta Application created in previous steps. |
   | Auth URL                   | Enter `https://<tenant-id>.okta.com/oauth2/v1/authorize`.                     |
   | Token URL                  | Enter `https://<tenant-id>.okta.com/oauth2/v1/token`.                         |
   | API URL                    | Enter `https://<tenant-id>.okta.com/oauth2/v1/userinfo`.                      |
   | Allowed Groups (Optional)  | Add Allowed Groups, as required.                                              |
   | Allowed Domains (Optional) | Add Allowed Domains, as required.                                             |

> **Note:** At this point you should now be able to login via Okta.

### Configure refresh token

When a user logs in using an OAuth provider, Grafana verifies that the access token has not expired. When an access token expires, Grafana uses the provided refresh token (if any exists) to obtain a new access token.

Grafana uses a refresh token to obtain a new access token without requiring the user to log in again. If a refresh token doesn't exist, Grafana logs the user out of the system after the access token has expired.

> **Note:** This feature is behind the `accessTokenExpirationCheck` feature toggle.

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
