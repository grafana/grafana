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
    - oss
title: Configure authentication
weight: 200
---

# Configure authentication

Grafana provides many ways to authenticate users. Some authentication integrations also enable syncing user permissions and org memberships.

The following table shows all supported authentication providers and the features available for them. [Team sync](../configure-team-sync/) and [active sync](enhanced-ldap/#active-ldap-synchronization) are only available in Grafana Enterprise.

| Provider                            | Multi Org Mapping | Enforce Sync | Role Mapping | Grafana Admin Mapping | Team Sync | Allowed groups | Active Sync | Skip OrgRole mapping | Auto Login | Single Logout |
| :---------------------------------- | :---------------- | :----------- | :----------- | :-------------------- | :-------- | :------------- | :---------- | :------------------- | :--------- | :------------ |
| [Auth Proxy](auth-proxy/)           | no                | yes          | yes          | no                    | yes       | no             | N/A         | no                   | N/A        | N/A           |
| [Azure AD OAuth](azuread/)          | yes               | yes          | yes          | yes                   | yes       | yes            | N/A         | yes                  | yes        | yes           |
| [Generic OAuth](generic-oauth/)     | yes               | yes          | yes          | yes                   | yes       | no             | N/A         | yes                  | yes        | yes           |
| [GitHub OAuth](github/)             | yes               | yes          | yes          | yes                   | yes       | yes            | N/A         | yes                  | yes        | yes           |
| [GitLab OAuth](gitlab/)             | yes               | yes          | yes          | yes                   | yes       | yes            | N/A         | yes                  | yes        | yes           |
| [Google OAuth](google/)             | yes               | no           | no           | no                    | yes       | no             | N/A         | no                   | yes        | yes           |
| [Grafana.com OAuth](grafana-cloud/) | no                | no           | yes          | no                    | N/A       | N/A            | N/A         | yes                  | yes        | yes           |
| [Okta OAuth](okta/)                 | yes               | yes          | yes          | yes                   | yes       | yes            | N/A         | yes                  | yes        | yes           |
| [SAML](saml/) (Enterprise only)     | yes               | yes          | yes          | yes                   | yes       | yes            | N/A         | yes                  | yes        | yes           |
| [LDAP](ldap/)                       | yes               | yes          | yes          | yes                   | yes       | yes            | yes         | no                   | N/A        | N/A           |
| [JWT Proxy](jwt/)                   | no                | yes          | yes          | yes                   | no        | no             | N/A         | no                   | N/A        | N/A           |

N/A = Not applicable

## Auth Proxy

| Feature           | Supported? |
| :---------------- | :--------- |
| Multi Org Mapping | no         |
| Enforce Sync      | N/A        |
| Role Mapping      | yes        |

**Multi Org Mapping:** Able to add a user and role map him to multiple orgs

**Enforce Sync:** If the information provided by the identity provider is empty, does the integration skip setting that user’s field or does it enforce a default.

**Role Mapping:** Able to map a user’s role in the default org

**Grafana Admin Mapping:** Able to map a user’s admin role in the default org

**Team Sync:** Able to sync teams from a predefined group/team in a your IdP

**Allowed Groups:** Only allow members of certain groups to login

**Active Sync:** Add users to teams and update their profile without requiring them to log in

**Skip OrgRole Sync:** Able to modify org role for users and not sync it back to the IdP

**Auto Login:** Automatically redirects to provider login page if user is not logged in \* for OAuth; Only works if it's the only configured provider

**Single Logout:** Logging out from Grafana also logs you out of provider session

## Configuring multiple identity providers

Grafana allows you to configure more than one authentication provider, however it is not possible to configure the same type of authentication provider twice.
For example, you can have [SAML](saml/) (Enterprise only) and [Generic OAuth](generic-oauth/) configured, but you can not have two different [Generic OAuth](generic-oauth/) configurations.

> Note: Grafana does not support multiple identity providers resolving the same user. Ensure there are no user account overlaps between the different providers

In scenarios where you have multiple identity providers of the same type, there are a couple of options:

- Use different Grafana instances each configured with a given identity provider.
- Check if the identity provider supports account federation. In such cases, you can configure it once and let your identity provider federate the accounts from different providers.
- If SAML is supported by the identity provider, you can configure one [Generic OAuth](generic-oauth/) and one [SAML](saml/) (Enterprise only).

## Using the same email address to login with different identity providers

If users want to use the same email address with multiple identity providers (for example, Grafana.Com OAuth and Google OAuth), you can configure Grafana to use the email address as the unique identifier for the user. This is done by enabling the `oauth_allow_insecure_email_lookup` option, which is disabled by default. Please note that enabling this option can lower the security of your Grafana instance. If you enable this option, you should also ensure that the `Allowed organization`, `Allowed groups` and `Allowed domains` settings are configured correctly to prevent unauthorized access.

To enable this option, refer to the [Enable email lookup](#enable-email-lookup) section.

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

{{< admonition type="note" >}}
Enabling anonymous access is a disallowed configuration setting on Hosted Grafana and not recommended due [security implications](https://grafana.com/docs/grafana/latest/setup-grafana/configure-security/#implications-of-enabling-anonymous-access-to-dashboards).
For sharing dashboards with a wider audience, consider using the [public dashboard feature](https://grafana.com/docs/grafana/latest/dashboards/dashboard-public/) instead.
{{< /admonition >}}

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

You can also enable email lookup using the API:

{{% admonition type="note" %}}
Available in [Grafana Enterprise](../../../introduction/grafana-enterprise/) and [Grafana Cloud](../../../introduction/grafana-cloud/) since Grafana v10.4.
{{% /admonition %}}

```
curl --request PUT \
  --url http://{slug}.grafana.com/api/admin/settings \
  --header 'Authorization: Bearer glsa_yourserviceaccounttoken' \
  --header 'Content-Type: application/json' \
  --data '{ "updates": { "auth": { "oauth_allow_insecure_email_lookup": "true" }}}'
```

Finally, you can also enable it using the UI by going to **Administration -> Authentication -> Auth settings**.

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

URL to redirect the user to after signing out from Grafana. This can for example be used to enable signout from an OAuth provider.

Example for Generic OAuth:

```bash
[auth.generic_oauth]
signout_redirect_url =
```

### Protected roles

{{% admonition type="note" %}}
Available in [Grafana Enterprise](../../../introduction/grafana-enterprise/) and [Grafana Cloud](../../../introduction/grafana-cloud/).
{{% /admonition %}}

By default, after you configure an authorization provider, Grafana will adopt existing users into the new authentication scheme. For example, if you have created a user with basic authentication having the login `jsmith@example.com`, then set up SAML authentication where `jsmith@example.com` is an account, the user's authentication type will be changed to SAML if they perform a SAML sign-in.

You can disable this user adoption for certain roles using the `protected_roles` property:

```bash
[auth.security]
protected_roles = server_admins org_admins
```

The value of `protected_roles` should be a list of roles to protect, separated by spaces. Valid roles are `viewers`, `editors`, `org_admins`, `server_admins`, and `all` (a superset of the other roles).
