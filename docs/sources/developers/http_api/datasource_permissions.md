---
aliases:
  - ../../http_api/datasource_permissions/
  - ../../http_api/datasourcepermissions/
canonical: /docs/grafana/latest/developers/http_api/datasource_permissions/
description: Data Source Permissions API
keywords:
  - grafana
  - http
  - documentation
  - api
  - datasource
  - permission
  - permissions
  - acl
  - enterprise
labels:
  products:
    - enterprise
    - oss
title: Datasource Permissions HTTP API
---

# Data Source Permissions API

> The Data Source Permissions is only available in Grafana Enterprise. Read more about [Grafana Enterprise](/docs/grafana/latest/introduction/grafana-enterprise/).

> If you are running Grafana Enterprise, for some endpoints you'll need to have specific permissions. Refer to [Role-based access control permissions](/docs/grafana/latest/administration/roles-and-permissions/access-control/custom-role-actions-scopes/) for more information.

This API can be used to list, add and remove permissions for a data source.

Permissions can be set for a user, team, service account or a basic role (Admin, Editor, Viewer).

## Get permissions for a data source

`GET /api/access-control/datasources/:uid`

Gets all existing permissions for the data source with the given `uid`.

**Required permissions**

See note in the [introduction]({{< ref "#data-source-permissions-api" >}}) for an explanation.

| Action                       | Scope                                                                                      |
| ---------------------------- | ------------------------------------------------------------------------------------------ |
| datasources.permissions:read | datasources:\*<br>datasources:uid:\*<br>datasources:uid:my_datasource (single data source) |

### Examples

**Example request:**

```http
GET /api/access-control/datasources/my_datasource HTTP/1.1
Accept: application/json
Content-Type: application/json
Authorization: Bearer eyJrIjoiT0tTcG1pUlY2RnVKZTFVaDFsNFZXdE9ZWmNrMkZYbk
```

**Example response:**

```http
HTTP/1.1 200 OK
Content-Type: application/json; charset=UTF-8
Content-Length: 551

[
    {
        "id": 1,
        "roleName": "fixed:datasources:reader",
        "isManaged": false,
        "isInherited": false,
        "isServiceAccount": false,
        "userId": 1,
        "userLogin": "admin_user",
        "userAvatarUrl": "/avatar/admin_user",
        "actions": [
            "datasources:read",
            "datasources:query",
            "datasources:read",
            "datasources:query",
            "datasources:write",
            "datasources:delete"
        ],
        "permission": "Edit"
    },
    {
        "id": 2,
        "roleName": "managed:teams:1:permissions",
        "isManaged": true,
        "isInherited": false,
        "isServiceAccount": false,
        "team": "A team",
        "teamId": 1,
        "teamAvatarUrl": "/avatar/523d70c8551046f441727d690431858c",
        "actions": [
            "datasources:read",
            "datasources:query"
        ],
        "permission": "Query"
    },
    {
        "id": 3,
        "roleName": "basic:admin",
        "isManaged": false,
        "isInherited": false,
        "isServiceAccount": false,
        "builtInRole": "Admin",
        "actions": [
            "datasources:query",
            "datasources:read",
            "datasources:write",
            "datasources:delete"
        ],
        "permission": "Edit"
    },
]
```

Status codes:

- **200** - Ok
- **401** - Unauthorized
- **403** - Access denied
- **500** - Internal error

## Add or revoke access to a data source for a user

`POST /api/access-control/datasources/:uid/users/:id`

Sets user permission for the data source with the given `uid`.

To add a permission, set the `permission` field to either `Query`, `Edit`, or `Admin`.
To remove a permission, set the `permission` field to an empty string.

**Required permissions**

See note in the [introduction]({{< ref "#data-source-permissions-api" >}}) for an explanation.

| Action                        | Scope                                                                                      |
| ----------------------------- | ------------------------------------------------------------------------------------------ |
| datasources.permissions:write | datasources:\*<br>datasources:uid:\*<br>datasources:uid:my_datasource (single data source) |

### Examples

**Example request:**

```http
POST /api/access-control/datasources/my_datasource/users/1
Accept: application/json
Content-Type: application/json
Authorization: Bearer eyJrIjoiT0tTcG1pUlY2RnVKZTFVaDFsNFZXdE9ZWmNrMkZYbk

{
  "permission": "Query",
}
```

**Example response:**

```http
HTTP/1.1 200 OK
Content-Type: application/json; charset=UTF-8
Content-Length: 35

{"message": "Permission updated"}
```

**Example request:**

```http
POST /api/access-control/datasources/my_datasource/users/1
Accept: application/json
Content-Type: application/json
Authorization: Bearer eyJrIjoiT0tTcG1pUlY2RnVKZTFVaDFsNFZXdE9ZWmNrMkZYbk

{
  "permission": "",
}
```

**Example response:**

```http
HTTP/1.1 200 OK
Content-Type: application/json; charset=UTF-8
Content-Length: 35

{"message": "Permission removed"}
```

Status codes:

- **200** - Ok
- **400** - Permission cannot be added, see response body for details
- **401** - Unauthorized
- **403** - Access denied

## Add or revoke access to a data source for a team

`POST /api/access-control/datasources/:uid/teams/:id`

Sets team permission for the data source with the given `uid`.

To add a permission, set the `permission` field to either `Query`, `Edit`, or `Admin`.
To remove a permission, set the `permission` field to an empty string.

**Required permissions**

See note in the [introduction]({{< ref "#data-source-permissions-api" >}}) for an explanation.

| Action                        | Scope                                                                                      |
| ----------------------------- | ------------------------------------------------------------------------------------------ |
| datasources.permissions:write | datasources:\*<br>datasources:uid:\*<br>datasources:uid:my_datasource (single data source) |

### Examples

**Example request:**

```http
POST /api/access-control/datasources/my_datasource/teams/1
Accept: application/json
Content-Type: application/json
Authorization: Bearer eyJrIjoiT0tTcG1pUlY2RnVKZTFVaDFsNFZXdE9ZWmNrMkZYbk

{
  "permission": "Edit",
}
```

**Example response:**

```http
HTTP/1.1 200 OK
Content-Type: application/json; charset=UTF-8
Content-Length: 35

{"message": "Permission updated"}
```

**Example request:**

```http
POST /api/access-control/datasources/my_datasource/teams/1
Accept: application/json
Content-Type: application/json
Authorization: Bearer eyJrIjoiT0tTcG1pUlY2RnVKZTFVaDFsNFZXdE9ZWmNrMkZYbk

{
  "permission": "",
}
```

**Example response:**

```http
HTTP/1.1 200 OK
Content-Type: application/json; charset=UTF-8
Content-Length: 35

{"message": "Permission removed"}
```

Status codes:

- **200** - Ok
- **400** - Permission cannot be added, see response body for details
- **401** - Unauthorized
- **403** - Access denied

## Add or revoke access to a data source for a basic role

`POST /api/access-control/datasources/:uid/builtInRoles/:builtinRoleName`

Sets permission for the data source with the given `uid` to all users who have the specified basic role.

You can set permissions for the following basic roles: `Admin`, `Editor`, `Viewer`.

To add a permission, set the `permission` field to either `Query`, `Edit`, or `Admin`.
To remove a permission, set the `permission` field to an empty string.

**Required permissions**

See note in the [introduction]({{< ref "#data-source-permissions-api" >}}) for an explanation.

| Action                        | Scope                                                                                      |
| ----------------------------- | ------------------------------------------------------------------------------------------ |
| datasources.permissions:write | datasources:\*<br>datasources:uid:\*<br>datasources:uid:my_datasource (single data source) |

### Examples

**Example request:**

```http
POST /api/access-control/datasources/my_datasource/builtInRoles/Admin
Accept: application/json
Content-Type: application/json
Authorization: Bearer eyJrIjoiT0tTcG1pUlY2RnVKZTFVaDFsNFZXdE9ZWmNrMkZYbk

{
  "permission": "Edit",
}
```

**Example response:**

```http
HTTP/1.1 200 OK
Content-Type: application/json; charset=UTF-8
Content-Length: 35

{"message": "Permission updated"}
```

**Example request:**

```http
POST /api/access-control/datasources/my_datasource/builtInRoles/Viewer
Accept: application/json
Content-Type: application/json
Authorization: Bearer eyJrIjoiT0tTcG1pUlY2RnVKZTFVaDFsNFZXdE9ZWmNrMkZYbk

{
  "permission": "",
}
```

**Example response:**

```http
HTTP/1.1 200 OK
Content-Type: application/json; charset=UTF-8
Content-Length: 35

{"message": "Permission removed"}
```

Status codes:

- **200** - Ok
- **400** - Permission cannot be added, see response body for details
- **401** - Unauthorized
- **403** - Access denied
