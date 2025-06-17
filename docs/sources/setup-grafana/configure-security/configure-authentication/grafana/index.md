---
aliases:
  - ../../../auth/grafana/
description: Grafana OAuthentication Guide
labels:
  products:
    - enterprise
    - oss
menuTitle: Basic auth
title: Configure Grafana authentication
weight: 200
---

## Configure Grafana authentication

Grafana of course has a built in user authentication system with password authentication enabled by default. You can
disable authentication by enabling anonymous access. You can also hide login form and only allow login through an auth
provider (listed above). There is also options for allowing self sign up.

### Login and short-lived tokens

> The following applies when using Grafana's built in user authentication, LDAP (without Auth proxy) or OAuth integration.

Grafana uses short-lived tokens as a mechanism for verifying authenticated users.
These short-lived tokens are rotated each `token_rotation_interval_minutes` for an active authenticated user.

An active authenticated user that gets it token rotated will extend the `login_maximum_inactive_lifetime_duration` time from "now" that Grafana will remember the user.
This means that a user can close its browser and come back before `now + login_maximum_inactive_lifetime_duration` and still being authenticated.
This is true as long as the time since user login is less than `login_maximum_lifetime_duration`.

#### Remote logout

You can logout from other devices by removing login sessions from the bottom of your profile page. If you are
a Grafana admin user you can also do the same for any user from the Server Admin / Edit User view.

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

You can make Grafana accessible without any login required by enabling anonymous access in the configuration file. For more information, refer to [Anonymous authentication](../#anonymous-authentication).

#### Anonymous devices

The anonymous devices feature enhances the management and monitoring of anonymous access within your Grafana instance. This feature is part of ongoing efforts to provide more control and transparency over anonymous usage.

Users can now view anonymous usage statistics, including the count of devices and users over the last 30 days.

- Go to **Administration -> Users** to access the anonymous devices tab.
- A new stat for the usage stats page -> Usage & Stats page shows the active anonymous devices last 30 days.

The number of anonymous devices is not limited by default. The configuration option `device_limit` allows you to enforce a limit on the number of anonymous devices. This enables you to have greater control over the usage within your Grafana instance and keep the usage within the limits of your environment. Once the limit is reached, any new devices that try to access Grafana will be denied access.

To display anonymous users and devices for versions 10.2, 10.3, 10.4, you need to enable the feature toggle `displayAnonymousStats`

```bash
[feature_toggles]
enable = displayAnonymousStats
```

#### Anonymous users

{{< admonition type="note" >}}
Anonymous users are charged as active users in Grafana Enterprise
{{< /admonition >}}

#### Configuration

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

# Setting this limits the number of anonymous devices in your instance. Any new anonymous devices added after the limit has been reached will be denied access.
device_limit =
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

### Strong password policy

By default, the password policy for all basic auth users is set to a minimum of four characters. You can enable a stronger password policy with the `password_policy` configuration option.

With the `password_policy` option enabled, new and updated passwords must meet the following criteria:

- At least 12 characters
- At least one uppercase letter
- At least one lowercase letter
- At least one number
- At least one special character

```bash
[auth.basic]
password_policy = true
```

{{% admonition type="note" %}}
Existing passwords that don't comply with the new password policy will not be impacted until the user updates their password.
{{% /admonition %}}

### Disable login form

You can hide the Grafana login form using the below configuration settings.

```bash
[auth]
disable_login_form = true
```

### Automatic OAuth login

Set to true to attempt login with specific OAuth provider automatically, skipping the login screen.
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

The URL to redirect the user to after signing out from Grafana can be configured under `[auth]` or under a specific OAuth provider section (for example, `[auth.generic_oauth]`). The URL configured under a specific OAuth provider section takes precedence over the URL configured in `[auth]` section. This can, for example, enable signout from the OAuth provider.

```bash
[auth.generic_oauth]
signout_redirect_url =

[auth]
signout_redirect_url =
```

### Protected roles

{{% admonition type="note" %}}
Available in [Grafana Enterprise](../../../../introduction/grafana-enterprise/) and [Grafana Cloud](../../../../introduction/grafana-cloud/).
{{% /admonition %}}

By default, after you configure an authorization provider, Grafana will adopt existing users into the new authentication scheme. For example, if you have created a user with basic authentication having the login `jsmith@example.com`, then set up SAML authentication where `jsmith@example.com` is an account, the user's authentication type will be changed to SAML if they perform a SAML sign-in.

You can disable this user adoption for certain roles using the `protected_roles` property:

```bash
[auth.security]
protected_roles = server_admins org_admins
```

The value of `protected_roles` should be a list of roles to protect, separated by spaces. Valid roles are `viewers`, `editors`, `org_admins`, `server_admins`, and `all` (a superset of the other roles).
