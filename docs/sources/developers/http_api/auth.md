---
aliases:
  - ../../http_api/auth/
  - ../../http_api/authentication/
canonical: /docs/grafana/latest/developers/http_api/auth/
description: Grafana Authentication HTTP API
keywords:
  - grafana
  - http
  - documentation
  - api
  - authentication
labels:
  products:
    - enterprise
    - oss
title: 'Authentication HTTP API '
---

# Authentication API

The Authentication HTTP API is used to manage API keys.

{{% admonition type="note" %}}
If you use Grafana v9.1 or newer, use service accounts instead of API keys. For more information, refer to [Grafana service account API reference]({{< relref "./serviceaccount/" >}}).
{{% /admonition %}}

> If you are running Grafana Enterprise, for some endpoints you would need to have relevant permissions. Refer to [Role-based access control permissions]({{< relref "../../administration/roles-and-permissions/access-control/custom-role-actions-scopes/" >}}) for more information.

## List API keys

### DEPRECATED

`GET /api/auth/keys`

**Required permissions**

See note in the [introduction]({{< ref "#authentication-api" >}}) for an explanation.

| Action         | Scope       |
| -------------- | ----------- |
| `apikeys:read` | `apikeys:*` |

**Example Request**:

```http
GET /api/auth/keys HTTP/1.1
Accept: application/json
Content-Type: application/json
Authorization: Bearer eyJrIjoiT0tTcG1pUlY2RnVKZTFVaDFsNFZXdE9ZWmNrMkZYbk
```

Query Parameters:

- `includeExpired`: boolean. enable listing of expired keys. Optional.

**Example Response**:

```http
HTTP/1.1 301
Content-Type: application/json

""
```

## Create API Key

### DEPRECATED

`POST /api/auth/keys`

- **301** – `api_key_max_seconds_to_live` is set but no `secondsToLive` is specified or `secondsToLive` is greater than this value.

## Delete API Key

### DEPRECATED

`DELETE /api/auth/keys/:id`

**Required permissions**

See note in the [introduction]({{< ref "#authentication-api" >}}) for an explanation.

| Action           | Scope      |
| ---------------- | ---------- |
| `apikeys:delete` | apikeys:\* |

**Example Request**:

```http
DELETE /api/auth/keys/3 HTTP/1.1
Accept: application/json
Content-Type: application/json
Authorization: Bearer eyJrIjoiT0tTcG1pUlY2RnVKZTFVaDFsNFZXdE9ZWmNrMkZYbk
```

**Example Response**:

```http
HTTP/1.1 301
Content-Type: application/json

""
```
