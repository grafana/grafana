---
aliases:
  - ../../../auth/gitlab/
description: Grafana OAuthentication Guide
keywords:
  - grafana
  - configuration
  - documentation
  - oauth
title: Configure GitLab OAuth2 authentication
menuTitle: GitLab OAuth2
weight: 1000
---

# Configure GitLab OAuth2 authentication

To enable GitLab OAuth2 you must register the application in GitLab. GitLab will generate a client ID and secret key for you to use.

## Create GitLab OAuth keys

You need to [create a GitLab OAuth application](https://docs.gitlab.com/ce/integration/oauth_provider.html).
Choose a descriptive _Name_, and use the following _Redirect URI_:

```
https://grafana.example.com/login/gitlab
```

where `https://grafana.example.com` is the URL you use to connect to Grafana.
Adjust it as needed if you don't use HTTPS or if you use a different port; for
instance, if you access Grafana at `http://203.0.113.31:3000`, you should use

```
http://203.0.113.31:3000/login/gitlab
```

Finally, select `openid`, `email` and `profile` as the scopes and submit the form.

You'll get an _Application Id_ and a _Secret_ in return; we'll call them
`GITLAB_APPLICATION_ID` and `GITLAB_SECRET` respectively for the rest of this
section.

## Enable GitLab in Grafana

In this example, we'll assume you use the public `gitlab.com` instance, but you
can use your own instance of GitLab instead by replacing `auth_url`, `token_url` with the URL of your instance.

You can find these URLs in the `well known` configuration file of your GitLab instance, for example `https://gitlab.com/.well-known/openid-configuration`.

Add the following to your Grafana configuration file to enable GitLab
authentication:

```bash
[auth.gitlab]
enabled = true
allow_sign_up = true
auto_login = false
client_id = GITLAB_APPLICATION_ID
client_secret = GITLAB_SECRET
scopes = openid email profile
auth_url = https://gitlab.com/oauth/authorize
token_url = https://gitlab.com/oauth/token
allowed_groups =
role_attribute_path =
role_attribute_strict = false
allow_assign_grafana_admin = false
tls_skip_verify_insecure = false
tls_client_cert =
tls_client_key =
tls_client_ca =
use_pkce = true
```

You may have to set the `root_url` option of `[server]` for the callback URL to be
correct. For example in case you are serving Grafana behind a proxy.

Restart the Grafana backend for your changes to take effect.

With `allow_sign_up` set to `false`, only existing users will be able to login
using their GitLab account, but with `allow_sign_up` set to `true`, _any_ user
who can authenticate on GitLab will be able to login on your Grafana instance;
if you use the public `gitlab.com`, it means anyone in the world would be able
to login on your Grafana instance.

You can limit access to only members of a given group or list of
groups by setting the `allowed_groups` option.

You can also specify the SSL/TLS configuration used by the client.

- Set `tls_client_cert` to the path of the certificate.
- Set `tls_client_key` to the path containing the key.
- Set `tls_client_ca` to the path containing a trusted certificate authority list.

`tls_skip_verify_insecure` controls whether a client verifies the server's certificate chain and host name. If it is true, then SSL/TLS accepts any certificate presented by the server and any host name in that certificate. _You should only use this for testing_, because this mode leaves SSL/TLS susceptible to man-in-the-middle attacks.

### Configure refresh token

> Available in Grafana v9.3 and later versions.

> **Note:** This feature is behind the `accessTokenExpirationCheck` feature toggle.

When a user logs in using an OAuth provider, Grafana verifies that the access token has not expired. When an access token expires, Grafana uses the provided refresh token (if any exists) to obtain a new access token.

Grafana uses a refresh token to obtain a new access token without requiring the user to log in again. If a refresh token doesn't exist, Grafana logs the user out of the system after the access token has expired.

By default, GitLab provides a refresh token.

### allowed_groups

To limit access to authenticated users that are members of one or more [GitLab
groups](https://docs.gitlab.com/ce/user/group/index.html), set `allowed_groups`
to a comma- or space-separated list of groups. For instance, if you want to
only give access to members of the `example` group, set

```ini
allowed_groups = example
```

If you want to also give access to members of the subgroup `bar`, which is in
the group `foo`, set

```ini
allowed_groups = example, foo/bar
```

To put values containing spaces in the list, use the following JSON syntax:

```ini
allowed_groups = ["Admins", "Software Engineers"]
```

Note that in GitLab, the group or subgroup name doesn't always match its
display name, especially if the display name contains spaces or special
characters. Make sure you always use the group or subgroup name as it appears
in the URL of the group or subgroup.

Here's a complete example with `allow_sign_up` enabled, with access limited to
the `example` and `foo/bar` groups. The example also promotes all GitLab Admins to Grafana organization admins:

```ini
[auth.gitlab]
enabled = true
allow_sign_up = true
auto_login = false
client_id = GITLAB_APPLICATION_ID
client_secret = GITLAB_SECRET
scopes = openid email profile
auth_url = https://gitlab.com/oauth/authorize
token_url = https://gitlab.com/oauth/token
allowed_groups = example, foo/bar
role_attribute_path = is_admin && 'Admin' || 'Viewer'
role_attribute_strict = true
allow_assign_grafana_admin = false
tls_skip_verify_insecure = false
tls_client_cert =
tls_client_key =
tls_client_ca =
use_pkce = true
```

### PKCE

IETF's [RFC 7636](https://datatracker.ietf.org/doc/html/rfc7636)
introduces "proof key for code exchange" (PKCE) which provides
additional protection against some forms of authorization code
interception attacks. PKCE will be required in [OAuth 2.1](https://datatracker.ietf.org/doc/html/draft-ietf-oauth-v2-1-03).

> You can disable PKCE in Grafana by setting `use_pkce` to `false` in the`[auth.gitlab]` section.

```
use_pkce = true
```

Grafana always uses the SHA256 based `S256` challenge method and a 128 bytes (base64url encoded) code verifier.

### Configure automatic login

Set `auto_login` option to true to attempt login automatically, skipping the login screen.
This setting is ignored if multiple auth providers are configured to use auto login.

```
auto_login = true
```

### Map roles

You can use GitLab OAuth to map roles. During mapping, Grafana checks for the presence of a role using the [JMESPath](http://jmespath.org/examples.html) specified via the `role_attribute_path` configuration option.

For the path lookup, Grafana uses JSON obtained from querying GitLab's API [`/api/v4/user`](https://docs.gitlab.com/ee/api/users.html#list-current-user-for-normal-users) endpoint and a `groups` key containing all of the user's teams. The result of evaluating the `role_attribute_path` JMESPath expression must be a valid Grafana role, for example, `Viewer`, `Editor` or `Admin`. For more information about roles and permissions in Grafana, refer to [Roles and permissions]({{< relref "../../../../administration/roles-and-permissions" >}}).

{{% admonition type="warning" %}}
Currently if no organization role mapping is found for a user, Grafana doesn't
update the user's organization role. This is going to change in Grafana 10. To avoid overriding manually set roles,
enable the `skip_org_role_sync` option.
See [Configure Grafana]({{< relref "../../../configure-grafana#authgitlab" >}}) for more information.
{{% /admonition %}}

On first login, if the`role_attribute_path` property does not return a role, then the user is assigned the role
specified by [the `auto_assign_org_role` option]({{< relref "../../../configure-grafana#auto_assign_org_role" >}}).
You can disable this default role assignment by setting `role_attribute_strict = true`.
It denies user access if no role or an invalid role is returned.

{{% admonition type="warning" %}}
With Grafana 10, **on every login**, if the`role_attribute_path` property does not return a role,
then the user is assigned the role specified by
[the `auto_assign_org_role` option]({{< relref "../../../configure-grafana#auto_assign_org_role" >}}).
{{% /admonition %}}

An example Query could look like the following:

```ini
role_attribute_path = is_admin && 'Admin' || 'Viewer'
```

This allows every GitLab Admin to be an Admin in Grafana.

#### Map roles using groups

Groups can also be used to map roles. Group name (lowercased and unique) is used instead of display name for identifying groups

For instance, if you have a group with display name 'Example-Group' you can use the following snippet to
ensure those members inherit the role 'Editor'.

```ini
role_attribute_path = contains(groups[*], 'example-group') && 'Editor' || 'Viewer'
```

Note: If a match is found in other fields, groups will be ignored.

#### Map server administrator privileges

> Available in Grafana v9.2 and later versions.

If the application role received by Grafana is `GrafanaAdmin`, Grafana grants the user server administrator privileges.  
This is useful if you want to grant server administrator privileges to a subset of users.  
Grafana also assigns the user the `Admin` role of the default organization.

The setting `allow_assign_grafana_admin` under `[auth.gitlab]` must be set to `true` for this to work.  
If the setting is set to `false`, the user is assigned the role of `Admin` of the default organization, but not server administrator privileges.

```ini
allow_assign_grafana_admin = true
```

Example:

```ini
role_attribute_path = is_admin && 'GrafanaAdmin' || 'Viewer'
```

### Team Sync (Enterprise only)

> Only available in Grafana Enterprise v6.4+

With Team Sync you can map your GitLab groups to teams in Grafana so that your users will automatically be added to
the correct teams.

Your GitLab groups can be referenced in the same way as `allowed_groups`, like `example` or `foo/bar`.

[Learn more about Team Sync]({{< relref "../../configure-team-sync" >}})

## Skip organization role sync

To prevent the sync of organization roles from GitLab, set `skip_org_role_sync` to `true`. This is useful if you want to manage the organization roles for your users from within Grafana.
This also impacts the `allow_assign_grafana_admin` setting by not syncing the Grafana admin role from GitLab.

```ini
[auth.gitlab]
# ..
# prevents the sync of org roles from Github
skip_org_role_sync = true
``
```
