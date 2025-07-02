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

The following table shows all supported authentication methods and the features available for them. [Team sync](../configure-team-sync/) and [active sync](enhanced-ldap/#active-ldap-synchronization) are only available in Grafana Enterprise.

| Authentication method               | Multi Org Mapping | Enforce Sync | Role Mapping | Grafana Admin Mapping | Team Sync | Allowed groups | Active Sync | Skip OrgRole mapping | Auto Login | Single Logout | SCIM support |
| :---------------------------------- | :---------------- | :----------- | :----------- | :-------------------- | :-------- | :------------- | :---------- | :------------------- | :--------- | :------------ | :----------- |
| [Anonymous access](anonymous-auth/) | N/A               | N/A          | N/A          | N/A                   | N/A       | N/A            | N/A         | N/A                  | N/A        | N/A           | N/A          |
| [Auth Proxy](auth-proxy/)           | no                | yes          | yes          | no                    | yes       | no             | N/A         | no                   | N/A        | N/A           | N/A          |
| [Azure AD OAuth](azuread/)          | yes               | yes          | yes          | yes                   | yes       | yes            | N/A         | yes                  | yes        | yes           | N/A          |
| [Basic auth](grafana/)              | yes               | N/A          | yes          | yes                   | N/A       | N/A            | N/A         | N/A                  | N/A        | N/A           | N/A          |
| [Passwordless auth](passwordless/)  | yes               | N/A          | yes          | yes                   | N/A       | N/A            | N/A         | N/A                  | N/A        | N/A           | N/A          |
| [Generic OAuth](generic-oauth/)     | yes               | yes          | yes          | yes                   | yes       | no             | N/A         | yes                  | yes        | yes           | N/A          |
| [GitHub OAuth](github/)             | yes               | yes          | yes          | yes                   | yes       | yes            | N/A         | yes                  | yes        | yes           | N/A          |
| [GitLab OAuth](gitlab/)             | yes               | yes          | yes          | yes                   | yes       | yes            | N/A         | yes                  | yes        | yes           | N/A          |
| [Google OAuth](google/)             | yes               | no           | no           | no                    | yes       | no             | N/A         | no                   | yes        | yes           | N/A          |
| [Grafana.com OAuth](grafana-cloud/) | no                | no           | yes          | no                    | N/A       | N/A            | N/A         | yes                  | yes        | yes           | N/A          |
| [Okta OAuth](okta/)                 | yes               | yes          | yes          | yes                   | yes       | yes            | N/A         | yes                  | yes        | yes           | N/A          |
| [SAML](saml/) (Enterprise only)     | yes               | yes          | yes          | yes                   | yes       | yes            | N/A         | yes                  | yes        | yes           | yes          |
| [LDAP](ldap/)                       | yes               | yes          | yes          | yes                   | yes       | yes            | yes         | no                   | N/A        | N/A           | N/A          |
| [JWT Proxy](jwt/)                   | no                | yes          | yes          | yes                   | no        | no             | N/A         | no                   | N/A        | N/A           | N/A          |

Fields explanation:

**Multi Org Mapping:** Able to add a user and map roles to multiple organizations

**Enforce Sync:** If the information provided by the identity provider is empty, does the integration skip setting that user’s field or does it enforce a default.

**Role Mapping:** Able to map a user’s role in the default org

**Grafana Admin Mapping:** Able to map a user’s admin role in the default org

**Team Sync:** Able to sync teams from a predefined group/team in a your IdP

**Allowed Groups:** Only allow members of certain groups to login

**Active Sync:** Add users to teams and update their profile without requiring them to log in

**Skip OrgRole Sync:** Able to modify org role for users and not sync it back to the IdP

**Auto Login:** Automatically redirects to provider login page if user is not logged in \* for OAuth; Only works if it's the only configured provider

**Single Logout:** Logging out from Grafana also logs you out of provider session

**SCIM support:** Support for SCIM provisioning. Supported Identity Providers are Azure AD and Okta.

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

## Multi-factor authentication (MFA/2FA)

Grafana and the Grafana Cloud portal currently do not include built-in support for multi-factor authentication (MFA).

We strongly recommend integrating an external identity provider (IdP) that supports MFA, such as Okta, Azure AD, or Google Workspace. By configuring your Grafana instances to use an external IdP, you can leverage MFA to protect your accounts and resources effectively.

## Login and short-lived tokens

> The following applies when using Grafana's basic authentication, LDAP (without Auth proxy) or OAuth integration.

Grafana uses short-lived tokens as a mechanism for verifying authenticated users.
These short-lived tokens are rotated on an interval specified by `token_rotation_interval_minutes` for active authenticated users.

Inactive authenticated users will remain logged in for a duration specified by `login_maximum_inactive_lifetime_duration`.
This means that a user can close a Grafana window and return before `now + login_maximum_inactive_lifetime_duration` to continue their session.
This is true as long as the time since last user login is less than `login_maximum_lifetime_duration`.

## Session handling with SSO

When using SSO (Single Sign-On) authentication methods, Grafana handles sessions differently based on the configuration:

### OAuth/OpenID Connect

- Without refresh tokens (default):
  - Grafana creates a session valid for up to `login_maximum_lifetime_duration` (default: 30 days).
  - During this time, the session remains valid even if the user loses access at the IdP.
- With refresh tokens enabled:
  - The user receives a JWT refresh token. When the JWT expires and the refresh token is used to obtain a new token, Grafana will revalidate access with the IdP.
  - If the user has been removed from required groups or access has been revoked, the refresh will fail and the session will be invalidated.

### SAML

- After successful SAML authentication, Grafana creates a session with the default session lifetime.
- If SAML Single Logout (SLO) is properly configured, the session will be revoked when the user's access is revoked on the IdP side.
- If SAML Single Logout (SLO) is properly configured, the session will be revoked when the user's access is revoked on the IdP side. For more information on configuring SAML and SLO, refer to the [SAML configuration documentation](./saml/#configure-single-logout).

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

## Extended authentication settings

### Enable email lookup

By default, Grafana identifies users based on the unique ID provided by the identity provider (IdP).
In certain cases, however, enabling user lookups by email can be a feasible option, such as when:

- The identity provider is a single-tenant setup.
- Unique, validated, and non-editable emails are provided by the IdP.
- The infrastructure allows email-based identification without compromising security.

**Important note**: While it is possible to configure Grafana to allow email-based user lookups, we strongly recommend against this approach in most cases due to potential security risks.
If you still choose to proceed, the following configuration can be applied to enable email lookup.

```bash
[auth]
oauth_allow_insecure_email_lookup = true
```

You can also enable email lookup using the API:

{{< admonition type="note" >}}
Available in [Grafana Enterprise](../../../introduction/grafana-enterprise/) and [Grafana Cloud](../../../introduction/grafana-cloud/) since Grafana v10.4.
{{< /admonition >}}

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

### Avoid automatic login

The `disableAutoLogin=true` URL parameter allows users to bypass the automatic login feature in scenarios where incorrect configuration changes prevent normal login functionality.
This feature is especially helpful when you need to access the login screen to troubleshoot and fix misconfigurations.

#### How to use

1. Add `disableAutoLogin=true` as a query parameter to your Grafana URL.
   - Example: `grafana.example.net/login?disableAutoLogin=true` or `grafana.example.net/login?disableAutoLogin`
1. This will redirect you to the standard login screen, bypassing the automatic login mechanism.
1. Fix any configuration issues and test your login setup.

This feature is available for both for OAuth and SAML. Ensure that after fixing the issue, you remove the parameter or revert the configuration to re-enable the automatic login feature, if desired.

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

### Remote logout

You can log out from other devices by removing login sessions from the bottom of your profile page. If you are
a Grafana admin user, you can also do the same for any user from the Server Admin / Edit User view.

### Protected roles

{{< admonition type="note" >}}
Available in [Grafana Enterprise](../../../introduction/grafana-enterprise/) and [Grafana Cloud](../../../introduction/grafana-cloud/).
{{< /admonition >}}

By default, after you configure an authorization provider, Grafana will adopt existing users into the new authentication scheme. For example, if you have created a user with basic authentication having the login `jsmith@example.com`, then set up SAML authentication where `jsmith@example.com` is an account, the user's authentication type will be changed to SAML if they perform a SAML sign-in.

You can disable this user adoption for certain roles using the `protected_roles` property:

```bash
[auth.security]
protected_roles = server_admins org_admins
```

The value of `protected_roles` should be a list of roles to protect, separated by spaces. Valid roles are `viewers`, `editors`, `org_admins`, `server_admins`, and `all` (a superset of the other roles).
