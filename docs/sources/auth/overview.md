+++
title = "Overview"
description = "Overview for auth"
type = "docs"
[menu.docs]
name = "Overview"
identifier = "overview-auth"
parent = "authentication"
weight = 1
+++

# User Authentication Overview

Grafana provides many ways to authenticate users. Some authentication integrations also enable syncing user
permissions and org memberships.

## OAuth Integrations

- [Google OAuth]({{< relref "auth/google.md" >}})
- [GitHub OAuth]({{< relref "auth/github.md" >}})
- [Gitlab OAuth]({{< relref "auth/gitlab.md" >}})
- [Generic OAuth]({{< relref "auth/generic-oauth.md" >}}) (Okta2, BitBucket, Azure, OneLogin, Auth0)

## LDAP integrations

- [LDAP Authentication]({{< relref "auth/ldap.md" >}}) (OpenLDAP, ActiveDirectory, etc)

## Auth proxy

- [Auth Proxy]({{< relref "auth/auth-proxy.md" >}}) If you want to handle authentication outside Grafana using a reverse
    proxy.

## Grafana Auth

Grafana of course has a built in user authentication system with password authentication enabled by default. You can
disable authentication by enabling anonymous access. You can also hide login form and only allow login through an auth
provider (listed above). There is also options for allowing self sign up.

### Login and short-lived tokens

> The following applies when using Grafana's built in user authentication, LDAP (without Auth proxy) or OAuth integration.

Grafana are using short-lived tokens as a mechanism for verifying authenticated users.
These short-lived tokens are rotated each `token_rotation_interval_minutes` for an active authenticated user.

An active authenticated user that gets it token rotated will extend the `login_maximum_inactive_lifetime_days` time from "now" that Grafana will remember the user.
This means that a user can close its browser and come back before `now + login_maximum_inactive_lifetime_days` and still being authenticated.
 This is true as long as the time since user login is less than `login_maximum_lifetime_days`.

Example:

```bash
[auth]

# Login cookie name
login_cookie_name = grafana_session

# The lifetime (days) an authenticated user can be inactive before being required to login at next visit. Default is 7 days.
login_maximum_inactive_lifetime_days = 7

# The maximum lifetime (days) an authenticated user can be logged in since login time before being required to login. Default is 30 days.
login_maximum_lifetime_days = 30

# How often should auth tokens be rotated for authenticated users when being active. The default is each 10 minutes.
token_rotation_interval_minutes = 10
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

You can hide the Grafana login form using the below configuration settings.

```bash
[auth]
disable_login_form = true
```

### Automatic OAuth login

Set to true to attempt login with OAuth automatically, skipping the login screen.
This setting is ignored if multiple OAuth providers are configured.
Defaults to `false`.

```bash
[auth]
oauth_auto_login = true
```

### Hide sign-out menu

Set to the option detailed below to true to hide sign-out menu link. Useful if you use an auth proxy.

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
