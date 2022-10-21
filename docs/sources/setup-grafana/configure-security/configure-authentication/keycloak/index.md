---
aliases:
  - /docs/grafana/latest/auth/keycloak/
  - /docs/grafana/latest/setup-grafana/configure-security/configure-authentication/keycloak/
description: Keycloak Grafana OAuthentication Guide
keywords:
  - grafana
  - keycloak
  - configuration
  - documentation
  - oauth
title: Configure Keycloak OAuth2 authentication
weight: 200
---

# Configure Keycloak OAuth2 authentication

Refer to [Generic OAuth authentication](../generic-oauth) for extra configuration options available for this provider.

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
scopes = login email name offline_access roles
email_attribute_path = email
login_attribute_path = login
name_attribute_path = name
auth_url = https://<PROVIDER_DOMAIN>/auth/realms/<REALM_NAME>/protocol/openid-connect/auth
token_url = https://<PROVIDER_DOMAIN>/auth/realms/<REALM_NAME>/protocol/openid-connect/token
api_url = https://<PROVIDER_DOMAIN>/auth/realms/<REALM_NAME>/protocol/openid-connect/userinfo
role_attribute_path = contains(roles[*], 'admin') && 'Admin' || contains(roles[*], 'editor') && 'Editor' || 'Viewer'
```

As an example, `<PROVIDER_DOMAIN>` can be `keycloak-demo.grafana.org`
and `<REALM_NAME>` can be `grafana`.

## Keycloak configuration

1. Create a client in Keycloak with the following settings:

- Client ID: `grafana-oauth`
- Enabled: `ON`
- Client Protocol: `openid-connect`
- Access Type: `confidential`
- Standard Flow Enabled: `ON`
- Implicit Flow Enabled: `OFF`
- Direct Access Grants Enabled: `ON`
- Root URL: `<grafana root url>`
- Valid Redirect URIs: `<grafana root url>/*`
- Web Origins: `<grafana root url>`
- Admin URL: `<grafana root url>`
- Base URL: `<grafana root url>`

As an example, `<grafana_root_url>` can be `https://play.grafana.org`.
Non-listed configuration options can be left at their default values.

2. In the client roles configuration _Assigned Default Client Scopes_ should match:

```
email
login
name
offline_access
roles
```

3. For role mapping to work with the example configuration above,
   you need to create the following roles and assign them to users:

```
admin
editor
viewer
```

## Enable Single Logout

```ini
[auth]
signout_redirect_url = https://<PROVIDER_DOMAIN>/auth/realms/<REALM_NAME>/protocol/openid-connect/logout?redirect_uri=https%3A%2F%2<grafana_domain>ER_DOMAIN2Flogin
```

## Allow assigning Grafana Admin

> Available in Grafana v9.2 and later versions.

If the application role received by Grafana is `GrafanaAdmin` , Grafana grants the user server administrator privileges.

This is useful if you want to grant server administrator privileges to a subset of users.  
Grafana also assigns the user the `Admin` role of the default organization.

```ini
role_attribute_path = contains(roles[*], 'grafanaadmin') && 'GrafanaAdmin' || contains(roles[*], 'admin') && 'Admin' || contains(roles[*], 'editor') && 'Editor' || 'Viewer'
allow_assign_grafana_admin = true
```
