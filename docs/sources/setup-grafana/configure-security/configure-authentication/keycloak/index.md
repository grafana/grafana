---
aliases:
  - ../../../auth/keycloak/
description: Keycloak Grafana OAuthentication Guide
keywords:
  - grafana
  - keycloak
  - configuration
  - documentation
  - oauth
title: Configure Keycloak OAuth2 authentication
menuTitle: Keycloak OAuth2
weight: 1300
---

# Configure Keycloak OAuth2 authentication

Keycloak OAuth2 authentication allows users to log in to Grafana using their Keycloak credentials. This guide explains how to set up Keycloak as an authentication provider in Grafana.

Refer to [Generic OAuth authentication]({{< relref "../generic-oauth" >}}) for extra configuration options available for this provider.

You may have to set the `root_url` option of `[server]` for the callback URL to be
correct. For example in case you are serving Grafana behind a proxy.

Example config:

```ini
[auth.generic_oauth]
enabled = true
name = Keycloak-OAuth
allow_sign_up = true
client_id = YOUR_APP_CLIENT_ID
client_secret = YOUR_APP_CLIENT_SECRET
scopes = openid email profile offline_access roles
email_attribute_path = email
login_attribute_path = username
name_attribute_path = full_name
auth_url = https://<PROVIDER_DOMAIN>/realms/<REALM_NAME>/protocol/openid-connect/auth
token_url = https://<PROVIDER_DOMAIN>/realms/<REALM_NAME>/protocol/openid-connect/token
api_url = https://<PROVIDER_DOMAIN>/realms/<REALM_NAME>/protocol/openid-connect/userinfo
role_attribute_path = contains(roles[*], 'admin') && 'Admin' || contains(roles[*], 'editor') && 'Editor' || 'Viewer'
```

As an example, `<PROVIDER_DOMAIN>` can be `keycloak-demo.grafana.org`
and `<REALM_NAME>` can be `grafana`.

{{% admonition type="note" %}}
api_url is not required if the id_token contains all the necessary user information and can add latency to the login process.
It is useful as a fallback or if the user has more than 150 group memberships.
{{% /admonition %}}

## Keycloak configuration

1. Create a client in Keycloak with the following settings:

- Client ID: `grafana-oauth`
- Enabled: `ON`
- Client Protocol: `openid-connect`
- Access Type: `confidential`
- Standard Flow Enabled: `ON`
- Implicit Flow Enabled: `OFF`
- Direct Access Grants Enabled: `ON`
- Root URL: `<grafana_root_url>`
- Valid Redirect URIs: `<grafana_root_url>/*`
- Web Origins: `<grafana_root_url>`
- Admin URL: `<grafana_root_url>`
- Base URL: `<grafana_root_url>`

As an example, `<grafana_root_url>` can be `https://play.grafana.org`.
Non-listed configuration options can be left at their default values.

2. In the client scopes configuration, _Assigned Default Client Scopes_ should match:

```
email
offline_access
profile
roles
```

{{% admonition type="warning" %}}
these scopes do not add group claims to the id_token. Without group claims, teamsync will not work. Teamsync is covered further down in this document.
{{% /admonition %}}

3. For role mapping to work with the example configuration above,
   you need to create the following roles and assign them to users:

```
admin
editor
viewer
```

## Teamsync

{{% admonition type="note" %}}
Available in [Grafana Enterprise]({{< relref "../../../../introduction/grafana-enterprise" >}}) and [Grafana Cloud](/docs/grafana-cloud/).
{{% /admonition %}}

[Teamsync]({{< relref "../../configure-team-sync" >}}) is a feature that allows you to map groups from your identity provider to Grafana teams. This is useful if you want to give your users access to specific dashboards or folders based on their group membership.

To enable teamsync, you need to add a `groups` mapper to the client configuration in Keycloak.
This will add the `groups` claim to the id_token. You can then use the `groups` claim to map groups to teams in Grafana.

1. In the client configuration, head to `Mappers` and create a mapper with the following settings:

- Name: `Group Mapper`
- Mapper Type: `Group Membership`
- Token Claim Name: `groups`
- Full group path: `OFF`
- Add to ID token: `ON`
- Add to access token: `OFF`
- Add to userinfo: `ON`

2. In Grafana's configuration add the following option:

```ini
[auth.generic_oauth]
groups_attribute_path = groups
```

If you use nested groups containing special characters such as quotes or colons, the JMESPath parser can perform a harmless reverse function so Grafana can properly evaluate nested groups. The following example shows a parent group named `Global` with nested group `department` that contains a list of groups:

```ini
[auth.generic_oauth]
groups_attribute_path = reverse("Global:department")
```

## Enable Single Logout

To enable Single Logout, you need to add the following option to the configuration of Grafana:

```ini
[auth]
signout_redirect_url = https://<PROVIDER_DOMAIN>/auth/realms/<REALM_NAME>/protocol/openid-connect/logout?redirect_uri=https%3A%2F%2<GRAFANA_DOMAIN>%2Flogin
```

As an example, `<PROVIDER_DOMAIN>` can be `keycloak-demo.grafana.org`,
`<REALM_NAME>` can be `grafana` and `<GRAFANA_DOMAIN>` can be `play.grafana.org`.

> **Note**: Grafana does not support `id_token_hints`. From keycloak 18, it is necessary to disable `id_token_hints` enforcement in keycloak for
> single logout to work. [Documentation reference](https://www.keycloak.org/2022/04/keycloak-1800-released#_openid_connect_logout).

## Allow assigning Grafana Admin

> Available in Grafana v9.2 and later versions.

If the application role received by Grafana is `GrafanaAdmin` , Grafana grants the user server administrator privileges.

This is useful if you want to grant server administrator privileges to a subset of users.  
Grafana also assigns the user the `Admin` role of the default organization.

```ini
role_attribute_path = contains(roles[*], 'grafanaadmin') && 'GrafanaAdmin' || contains(roles[*], 'admin') && 'Admin' || contains(roles[*], 'editor') && 'Editor' || 'Viewer'
allow_assign_grafana_admin = true
```

### Configure refresh token

> Available in Grafana v9.3 and later versions.

> **Note:** This feature is behind the `accessTokenExpirationCheck` feature toggle.

When a user logs in using an OAuth provider, Grafana verifies that the access token has not expired. When an access token expires, Grafana uses the provided refresh token (if any exists) to obtain a new access token.

Grafana uses a refresh token to obtain a new access token without requiring the user to log in again. If a refresh token doesn't exist, Grafana logs the user out of the system after the access token has expired.

To enable a refresh token for Keycloak, extend the `scopes` in `[auth.generic_oauth]` with `offline_access`.
