---

aliases:
  - ../../http_api/lbac/
canonical: /docs/grafana/latest/developers/http_api/lbac/
description: Grafana LBAC for Datasources HTTP API
keywords:
  - grafana
  - http
  - documentation
  - api
  - lbac
labels:
  products:
    - enterprise
title: 'LBAC for Datasources HTTP API'

---

# LBAC for Datasources API

The LBAC for Datasources HTTP API is used to manage Label-Based Access Control (LBAC) rules for datasources.

> If you are running Grafana Enterprise, for some endpoints you will need to have relevant permissions. Refer to [Role-based access control permissions]({{< relref "../../administration/roles-and-permissions/access-control/custom-role-actions-scopes/" >}}) for more information.

## Get LBAC Rules for a Datasource

`GET /api/datasources/uid/{uid}/lbac/teams`

**Required permissions**

| Action               | Scope          |
| -------------------- | -------------- |
| `datasources:read`   | `datasources:*` |

**Example Request**:

```http
GET /api/datasources/uid/datasource-uid/lbac/teams HTTP/1.1
Accept: application/json
Content-Type: application/json
Authorization: Bearer eyJrIjoiT0tTcG1pUlY2RnVKZTFVaDFsNFZXdE9ZWmNrMkZYbk
```

**Example Response**:

```http
HTTP/1.1 200
Content-Type: application/json

{
  "rules": [
    {
      "teamId": 1,
      "permissions": ["read", "write"]
    }
  ]
}
```

## Update LBAC Rules for a Datasource

`PUT /api/datasources/uid/{uid}/lbac/teams`

**Required permissions**

| Action                         | Scope          |
| ------------------------------ | -------------- |
| `datasources:write`            | `datasources:*` |
| `datasources:permissions:write` | `datasources:*` |

**Example Request**:

```http
PUT /api/datasources/uid/datasource-uid/lbac/teams HTTP/1.1
Accept: application/json
Content-Type: application/json
Authorization: Bearer eyJrIjoiT0tTcG1pUlY2RnVKZTFVaDFsNFZXdE9ZWmNrMkZYbk

{
  "rules": [
    {
      "teamId": 1,
      "permissions": ["read", "write"]
    }
  ]
}
```

JSON Body schema:

- **teamId** – The ID of the team.
- **permissions** – An array of permissions that can be one or more of the following values: `read`, `write`.

**Example Response**:

```http
HTTP/1.1 200
Content-Type: application/json

{
  "message": "Data source LBAC rules updated",
  "id": 1,
  "uid": "datasource-uid",
  "name": "Datasource Name",
  "lbacRules": [
    {
      "teamId": 1,
      "permissions": ["read", "write"]
    }
  ]
}
```

Error statuses:

- **400** – Invalid LBAC rule format.
- **403** – Cannot update a read-only datasource.
- **404** – Datasource not found.
- **500** – Failed to query or update LBAC rules.

---

This documentation follows the format of Grafana's HTTP API documentation, tailored for managing LBAC rules for datasources.