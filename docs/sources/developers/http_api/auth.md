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
If you use Grafana v9.1 or newer, use service accounts instead of API keys. For more information, refer to [Grafana service account API reference](../serviceaccount/).
{{% /admonition %}}

> If you are running Grafana Enterprise, for some endpoints you would need to have relevant permissions. Refer to [Role-based access control permissions](../../../administration/roles-and-permissions/access-control/custom-role-actions-scopes/) for more information.

## List API keys

{{% admonition type="warning" %}}
This endpoint is deprecated.

{{% /admonition %}}

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

{{% admonition type="warning" %}}
This endpoint has been made obsolete in Grafana 11.3.0.

{{% /admonition %}}

Endpoint is obsolete and has been moved to [Grafana service account API](../serviceaccount/). For more information, refer to [Migrate to Grafana service account API](/docs/grafana/<GRAFANA_VERSION>/administration/service-accounts/migrate-api-keys/).

`POST /api/auth/keys`

**Example Response**:

```http
HTTP/1.1 410
Content-Type: application/json

{"message":"this endpoint has been removed, please use POST /api/serviceaccounts and POST /api/serviceaccounts/{id}/tokens instead"}
```

## Delete API Key

{{% admonition type="warning" %}}

### DEPRECATED

{{% /admonition %}}

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
