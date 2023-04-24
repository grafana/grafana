---
aliases:
  - ../../../auth/grafana/
description: Grafana OAuthentication Guide
title: Configure Grafana authentication
weight: 1000
---

## Configuring Authentication in Grafana

Grafana has a built in user authentication system with password authentication enabled by default. You can 
disable authentication by enabling anonymous access in the configuration file. You can also hide the login form and only allow login through an authentication
provider (listed above). There are also options for allowing self sign-up.

### Login and short-lived tokens

> The following applies when using Grafana's built in user authentication, LDAP (without Auth proxy) or OAuth integration.

Grafana uses using short-lived tokens as a mechanism for verifying authenticated users.
These short-lived tokens are rotated every `token_rotation_interval_minutes` for an active authenticated user.

When an active authenticated user's token is rotated the duration that Grafana will remember the user is extended from 'now' for the `login_maximum_inactive_lifetime_duration`.
This means that a user can close their browser and return before `now + login_maximum_inactive_lifetime_duration` elapses and still be authenticated.

#### Remote logout

You can log out of other devices by removing login sessions from the bottom of your profile page. If you are
an admin user in Grafana you can also do the same for any user from the Server Admin / Edit User view.

## Settings

Example:

```bash
[auth]

# Login cookie name
login_cookie_name = grafana_session

# The lifetime (days) an authenticated user can be inactive before being required to login at next visit. Default is 7 days.
login_maximum_inactive_lifetime_duration = 7d

# The maximum lifetime (days) an authenticated user can be logged in since login time before being required to login. Default is 30 days.
login_maximum_lifetime_duration = 30d

# How often should auth tokens be rotated for authenticated users when being active. The default is each 10 minutes.
token_rotation_interval_minutes = 10

# The maximum lifetime (seconds) an api key can be used. If it is set all the api keys should have limited lifetime that is lower than this value.
api_key_max_seconds_to_live = -1
```

### Anonymous authentication

You can make Grafana accessible without any login required by enabling anonymous access in the configuration file. For more information, see [Implications of allowing anonymous access to dashboards]({{< relref "../#implications-of-enabling-anonymous-access-to-dashboards" >}}).

Example:

```bash
[auth.anonymous]
enabled = true

# Organization name that should be used for unauthenticated users
org_name = Main Org.

# Role for unauthenticated users, other valid values are `Editor` and `Admin`
org_role = Viewer

# Hide the Grafana version text from the footer and help tooltip for unauthenticated users (default: false)
hide_version = true
```

If you change your organization name in the Grafana UI this setting needs to be updated to match the new name.

### Basic authentication

Basic auth is enabled by default and works with the built in Grafana user password authentication system and LDAP
authentication integration.

To disable basic auth:

```bash
[auth.basic]
enabled = false
```

### Disable login form

You can hide the Grafana login form using the following configuration settings:

```bash
[auth]
disable_login_form = true
```

### Automatic OAuth login

Set to true to attempt automatic login with specific OAuth providers, skipping the login screen.
This setting is ignored if multiple auth providers are configured to use auto login.
Defaults to `false`.

```bash
[auth.generic_oauth]
auto_login = true
```

### Hide sign-out menu

Set the option detailed below to true to hide sign-out menu link. Useful if you use an auth proxy or JWT authentication.

```bash
[auth]
disable_signout_menu = true
```

### URL redirect after signing out

URL to redirect the user to after signing out from Grafana. This can for example be used to enable signout from oauth provider.

```bash
[auth]
signout_redirect_url =
```

### Protected roles

> **Note:** Available in [Grafana Enterprise]({{< relref "../../../../introduction/grafana-enterprise" >}}) and [Grafana Cloud Advanced]({{< relref "../../../../introduction/grafana-cloud" >}}).

By default, after configuring an authorization provider, Grafana will automatically switch existing users to the new authentication scheme. For instance, if you have created a user with basic authentication and the login `jsmith@example.com, and then set up SAML authentication where `jsmith@example.com` is an account, the user's authentication type will be changed to SAML if they perform a SAML sign-in.

You can disable this user adoption for certain roles using the `protected_roles` property:

```bash
[auth.security]
protected_roles = server_admins org_admins
```

The `protected_roles` property should contain a list of roles to protect, separated by spaces. Valid roles are `viewers`, `editors`, `org_admins`, `server_admins`, and `all` (a superset of the other roles).
