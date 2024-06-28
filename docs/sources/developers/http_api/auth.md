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
HTTP/1.1 200
Content-Type: application/json

[
  {
    "id": 3,
    "name": "API",
    "role": "Admin"
  },
  {
    "id": 1,
    "name": "TestAdmin",
    "role": "Admin",
    "expiration": "2019-06-26T10:52:03+03:00"
  }
]
```

## Create API Key

`POST /api/auth/keys`

**Required permissions**

See note in the [introduction]({{< ref "#authentication-api" >}}) for an explanation.

| Action           | Scope |
| ---------------- | ----- |
| `apikeys:create` | n/a   |

**Example Request**:

```http
POST /api/auth/keys HTTP/1.1
Accept: application/json
Content-Type: application/json
Authorization: Bearer eyJrIjoiT0tTcG1pUlY2RnVKZTFVaDFsNFZXdE9ZWmNrMkZYbk

{
  "name": "mykey",
  "role": "Admin",
  "secondsToLive": 86400
}
```

JSON Body schema:

- **name** – The key name
- **role** – Sets the access level/Grafana Role for the key. Can be one of the following values: `None`, `Viewer`, `Editor` or `Admin`.
- **secondsToLive** – Sets the key expiration in seconds. It is optional. If it is a positive number an expiration date for the key is set. If it is null, zero or is omitted completely (unless `api_key_max_seconds_to_live` configuration option is set) the key will never expire.

Error statuses:

- **400** – `api_key_max_seconds_to_live` is set but no `secondsToLive` is specified or `secondsToLive` is greater than this value.
- **500** – The key was unable to be stored in the database.

**Example Response**:

```http
HTTP/1.1 200
Content-Type: application/json

{"name":"mykey","key":"eyJrIjoiWHZiSWd3NzdCYUZnNUtibE9obUpESmE3bzJYNDRIc0UiLCJuIjoibXlrZXkiLCJpZCI6MX1=","id":1}
```

## Delete API Key

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
HTTP/1.1 200
Content-Type: application/json

{"message":"API key deleted"}
```
