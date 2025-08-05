---
aliases:
  - ../../http_api/sso-settings/
  - ../../http_api/ssosettings/
canonical: /docs/grafana/latest/developers/http_api/sso-settings/
description: Grafana SSO Settings API
keywords:
  - grafana
  - http
  - documentation
  - api
  - sso
  - sso-settings
labels:
  products:
    - enterprise
    - oss
title: SSO Settings API
---

# SSO Settings API

> If you are running Grafana Enterprise, for some endpoints you'll need to have specific permissions. Refer to [Role-based access control permissions](/docs/grafana/latest/administration/roles-and-permissions/access-control/custom-role-actions-scopes/) for more information.

{{% admonition type="note" %}}
Available since Grafana 11. SAML support is in public preview behind the `ssoSettingsSAML` feature flag.
{{% /admonition %}}

The API can be used to create, update, delete, get, and list SSO Settings for OAuth2 and SAML.

The settings managed by this API are stored in the database and override
[settings from other sources](../../../setup-grafana/configure-security/configure-authentication/)
(arguments, environment variables, settings file, etc).
Therefore, every time settings for a specific provider are removed or reset to the default settings at runtime,
the settings are inherited from the other sources in the reverse order of precedence
(`arguments > environment variables > settings file`).

## List SSO Settings

`GET /api/v1/sso-settings`

Lists the SSO Settings for all providers.

The providers or SSO keys that are not managed by this API are retrieved from the other sources (settings file, environment variables, default values).

**Required permissions**

See note in the [introduction]({{< ref "#sso-settings" >}}) for an explanation.

| Action          | Scope                        |
| --------------- | ---------------------------- |
| `settings:read` | `settings:auth.{provider}:*` |

**Example Request**:

```http
GET /api/v1/sso-settings HTTP/1.1
Accept: application/json
Content-Type: application/json
Authorization: Bearer eyJrIjoiT0tTcG1pUlY2RnVKZTFVaDFsNFZXdE9ZWmNrMkZYbk
```

**Example Response**:

```http
HTTP/1.1 200
Content-Type: application/json
[
  {
    "id":        "1",
    "provider":  "github",
    "settings": {
      "apiUrl": "https://api.github.com/user",
      "clientId": "my_github_client",
      "clientSecret": "*********",
      "enabled": true,
      "scopes": "user:email,read:org"
      // rest of the settings
    },
    "source":    "system",
  },
  {
    "id":        "2",
    "provider":  "azuread",
    "settings": {
      "authUrl": "https://login.microsoftonline.com/00000000-0000-0000-0000-000000000000/oauth2/v2.0/authorize",
      "clientId": "my_azuread_client",
      "clientSecret": "*********",
      "enabled": true,
      "scopes": "openid,email,profile"
      // rest of the settings
    },
    "source":    "system",
  }
]
```

Status Codes:

- **200** – SSO Settings found
- **400** – Bad Request
- **401** – Unauthorized
- **403** – Access Denied

## Get SSO Settings

`GET /api/v1/sso-settings/:provider`

Gets the SSO Settings for a provider.

The SSO keys that are not managed by this API are retrieved from the other sources (settings file, environment variables, default values).

**Required permissions**

See note in the [introduction]({{< ref "#sso-settings" >}}) for an explanation.

| Action          | Scope                        |
| --------------- | ---------------------------- |
| `settings:read` | `settings:auth.{provider}:*` |

**Example Request**:

```http
GET /api/v1/sso-settings/github HTTP/1.1
Accept: application/json
Content-Type: application/json
Authorization: Bearer eyJrIjoiT0tTcG1pUlY2RnVKZTFVaDFsNFZXdE9ZWmNrMkZYbk
```

**Example Response**:

```http
HTTP/1.1 200
Content-Type: application/json
ETag: db87f729761898ee
{
  "id":        "1",
  "provider":  "github",
  "settings": {
    "apiUrl": "https://api.github.com/user",
    "clientId": "my_github_client",
    "clientSecret": "*********",
    "enabled": true,
    "scopes": "user:email,read:org"
    // rest of the settings
  },
  "source":    "system",
}
```

Status Codes:

- **200** – SSO Settings found
- **400** – Bad Request
- **401** – Unauthorized
- **403** – Access Denied
- **404** – SSO Settings not found

## Update SSO Settings

`PUT /api/v1/sso-settings/:provider`

Updates the SSO Settings for a provider.

When you submit new settings for a provider via API,
Grafana verifies whether the given settings are allowed and valid.
If they are, then Grafana stores the settings in the database and reloads
Grafana services with no need to restart the instance.

{{% admonition type="note" %}}
If you run Grafana in high availability mode, configuration changes
may not get applied to all Grafana instances immediately. You may need
to wait a few minutes for the configuration to propagate to all Grafana instances.
{{% /admonition %}}

**Required permissions**

See note in the [introduction]({{< ref "#sso-settings" >}}) for an explanation.

| Action           | Scope                        |
| ---------------- | ---------------------------- |
| `settings:write` | `settings:auth.{provider}:*` |

**Example Request**:

```http
PUT /api/v1/sso-settings/github HTTP/1.1
Accept: application/json
Content-Type: application/json
Authorization: Bearer eyJrIjoiT0tTcG1pUlY2RnVKZTFVaDFsNFZXdE9ZWmNrMkZYbk

{
  "settings": {
    "apiUrl": "https://api.github.com/user",
    "clientId": "my_github_client",
    "clientSecret": "my_github_secret",
    "enabled": true,
    "scopes": "user:email,read:org"
  }
}
```

**Example Response**:

```http
HTTP/1.1 204
Content-Type: application/json
```

Status Codes:

- **204** – SSO Settings updated
- **400** – Bad Request
- **401** – Unauthorized
- **403** – Access Denied

## Delete SSO Settings

`DELETE /api/v1/sso-settings/:provider`

Deletes an existing SSO Settings entry for a provider.

**Required permissions**

See note in the [introduction]({{< ref "#sso-settings" >}}) for an explanation.

| Action           | Scope                        |
| ---------------- | ---------------------------- |
| `settings:write` | `settings:auth.{provider}:*` |

**Example Request**:

```http
DELETE /api/v1/sso-settings/azuread HTTP/1.1
Accept: application/json
Content-Type: application/json
Authorization: Bearer eyJrIjoiT0tTcG1pUlY2RnVKZTFVaDFsNFZXdE9ZWmNrMkZYbk
```

**Example Response**:

```http
HTTP/1.1 204
Content-Type: application/json
```

Status Codes:

- **204** – SSO Settings deleted
- **400** – Bad Request
- **401** – Unauthorized
- **403** – Access Denied
- **404** – SSO Settings not found
