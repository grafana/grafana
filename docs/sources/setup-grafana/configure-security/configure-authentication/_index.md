---
aliases:
  - ../../auth/
  - ../../auth/overview/
description: Learn about all the ways in which you can configure Grafana to authenticate
  users.
labels:
  products:
    - cloud
    - enterprise
title: Configure authentication
weight: 100
---

# Configure authentication

Grafana provides many ways to authenticate users. Some authentication integrations also enable syncing user permissions and org memberships.

The following table shows all supported authentication providers and the features available for them. [Team sync]({{< relref "../configure-team-sync" >}}) and [active sync]({{< relref "./enhanced-ldap#active-ldap-synchronization" >}}) are only available in Grafana Enterprise.

| Provider                                          | Support | Role mapping | Team sync<br> _(Enterprise only)_ | Active sync<br> _(Enterprise only)_ |
| ------------------------------------------------- | :-----: | :----------: | :-------------------------------: | :---------------------------------: |
| [Auth Proxy]({{< relref "./auth-proxy" >}})       |  v2.1+  |      -       |               v6.3+               |                  -                  |
| [Azure AD OAuth]({{< relref "./azuread" >}})      |  v6.7+  |    v6.7+     |               v6.7+               |                  -                  |
| [Generic OAuth]({{< relref "./generic-oauth" >}}) |  v4.0+  |    v6.5+     |                 -                 |                  -                  |
| [GitHub OAuth]({{< relref "./github" >}})         |  v2.0+  |      -       |               v6.3+               |                  -                  |
| [GitLab OAuth]({{< relref "./gitlab" >}})         |  v5.3+  |      -       |               v6.4+               |                  -                  |
| [Google OAuth]({{< relref "./google" >}})         |  v2.0+  |      -       |                 -                 |                  -                  |
| [JWT]({{< relref "./jwt" >}})                     |  v8.0+  |      -       |                 -                 |                  -                  |
| [LDAP]({{< relref "./ldap" >}})                   |  v2.1+  |    v2.1+     |               v5.3+               |                v6.3+                |
| [Okta OAuth]({{< relref "./okta" >}})             |  v7.0+  |    v7.0+     |               v7.0+               |                  -                  |
| [SAML]({{< relref "./saml" >}}) (Enterprise only) |  v6.3+  |    v7.0+     |               v7.0+               |                  -                  |

## Grafana Auth

Grafana of course has a built in user authentication system with password authentication enabled by default. You can
disable authentication by enabling anonymous access. You can also hide the login form and only allow login through an auth
provider (listed above). There are also options for allowing self sign up.

### Login and short-lived tokens

> The following applies when using Grafana's built in user authentication, LDAP (without Auth proxy) or OAuth integration.

Grafana uses short-lived tokens as a mechanism for verifying authenticated users.
These short-lived tokens are rotated on an interval specified by `token_rotation_interval_minutes` for active authenticated users.

Inactive authenticated users will remain logged in for a duration specified by `login_maximum_inactive_lifetime_duration`.
This means that a user can close a Grafana window and return before `now + login_maximum_inactive_lifetime_duration` to continue their session.
This is true as long as the time since last user login is less than `login_maximum_lifetime_duration`.

#### Remote logout

You can logout from other devices by removing login sessions from the bottom of your profile page. If you are
a Grafana admin user, you can also do the same for any user from the Server Admin / Edit User view.

## Settings

Example:

```bash
[auth]

# Login cookie name
login_cookie_name = grafana_session

# The maximum lifetime (duration) an authenticated user can be inactive before being required to login at next visit. Default is 7 days (7d). This setting should be expressed as a duration, e.g. 5m (minutes), 6h (hours), 10d (days), 2w (weeks), 1M (month). The lifetime resets at each successful token rotation (token_rotation_interval_minutes).
login_maximum_inactive_lifetime_duration =

# The maximum lifetime (duration) an authenticated user can be logged in since login time before being required to login. Default is 30 days (30d). This setting should be expressed as a duration, e.g. 5m (minutes), 6h (hours), 10d (days), 2w (weeks), 1M (month).
login_maximum_lifetime_duration =

# How often should auth tokens be rotated for authenticated users when being active. The default is every 10 minutes.
token_rotation_interval_minutes = 10

# The maximum lifetime (seconds) an API key can be used. If it is set all the API keys should have limited lifetime that is lower than this value.
api_key_max_seconds_to_live = -1

# Enforce user lookup based on email instead of the unique ID provided by the IdP.
oauth_allow_insecure_email_lookup = false
```

### Anonymous authentication

You can make Grafana accessible without any login required by enabling anonymous access in the configuration file.

Example:

```bash
[auth.anonymous]
enabled = true

# Organization name that should be used for unauthenticated users
org_name = Main Org.

# Role for unauthenticated users, other valid values are `Editor` and `Admin`
org_role = Viewer
```

If you change your organization name in the Grafana UI, this setting needs to be updated to match the new name.

### Basic authentication

Basic auth is enabled by default and works with the built-in Grafana user-password authentication system and LDAP
authentication integration.

To disable basic auth:

```bash
[auth.basic]
enabled = false
```

### Disable login form

Hide the Grafana login form using the below configuration settings.

```bash
[auth]
disable_login_form = true
```

### Enable email lookup

Enable user lookup based on email in addition to using unique ID provided by IdPs.

By default, Grafana relies on the user unique ID provided by the identity provider.
Looking up users by email can be safe for some identity providers (for example, when they are single tenants and unique non-editable, validated emails are provided), as well as in some infrastructures.

We strongly recommend against enabling email lookups, however it is possible to do with the following configuration.

```bash
[auth]
oauth_allow_insecure_email_lookup = true
```

### Automatic OAuth login

Set to true to attempt login with specific OAuth provider automatically, skipping the login screen.
This setting is ignored if multiple auth providers are configured to use auto login.
Defaults to `false`.

```bash
[auth.generic_oauth]
auto_login = true
```

### Avoid automatic OAuth login

To sign in with a username and password and avoid automatic OAuth login, add the `disableAutoLogin` parameter to your login URL.
For example: `grafana.example.com/login?disableAutoLogin` or `grafana.example.com/login?disableAutoLogin=true`

### Hide sign-out menu

Set the option detailed below to true to hide sign-out menu link. Useful if you use an auth proxy or JWT authentication.

```bash
[auth]
disable_signout_menu = true
```

### URL redirect after signing out

URL to redirect the user to after signing out from Grafana. This can for example be used to enable signout from OAuth provider.

```bash
[auth]
signout_redirect_url =
```

### Protected roles

{{% admonition type="note" %}}
Available in [Grafana Enterprise]({{< relref "../../../introduction/grafana-enterprise" >}}) and [Grafana Cloud]({{< relref "../../../introduction/grafana-cloud" >}}).
{{% /admonition %}}

By default, after you configure an authorization provider, Grafana will adopt existing users into the new authentication scheme. For example, if you have created a user with basic authentication having the login `jsmith@example.com`, then set up SAML authentication where `jsmith@example.com` is an account, the user's authentication type will be changed to SAML if they perform a SAML sign-in.

You can disable this user adoption for certain roles using the `protected_roles` property:

```bash
[auth.security]
protected_roles = server_admins org_admins
```

The value of `protected_roles` should be a list of roles to protect, separated by spaces. Valid roles are `viewers`, `editors`, `org_admins`, `server_admins`, and `all` (a superset of the other roles).
