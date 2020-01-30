+++
title = "Datasource Permissions HTTP API "
description = "Data Source Permissions API"
keywords = ["grafana", "http", "documentation", "api", "datasource", "permission", "permissions", "acl", "enterprise"]
aliases = ["/docs/grafana/latest/http_api/datasourcepermissions/"]
type = "docs"
[menu.docs]
name = "Datasource Permissions"
parent = "http_api"
+++

# Data Source Permissions API

> The Data Source Permissions is only available in Grafana Enterprise. Read more about [Grafana Enterprise]({{< relref "../enterprise" >}}).

This API can be used to enable, disable, list, add and remove permissions for a data source.

Permissions can be set for a user or a team. Permissions cannot be set for Admins - they always have access to everything.

The permission levels for the permission field:

- 1 = Query

## Enable permissions for a data source

`POST /api/datasources/:id/enable-permissions`

Enables permissions for the data source with the given `id`. No one except Org Admins will be able to query the data source until permissions have been added which permit certain users or teams to query the data source.

**Example request:**

```http
POST /api/datasources/1/enable-permissions
Accept: application/json
Content-Type: application/json
Authorization: Bearer eyJrIjoiT0tTcG1pUlY2RnVKZTFVaDFsNFZXdE9ZWmNrMkZYbk

{}
```

**Example response:**

```http
HTTP/1.1 200 OK
Content-Type: application/json; charset=UTF-8
Content-Length: 35

{"message":"Datasource permissions enabled"}
```

Status codes:

- **200** - Ok
- **400** - Permissions cannot be enabled, see response body for details
- **401** - Unauthorized
- **403** - Access denied
- **404** - Datasource not found

## Disable permissions for a data source

`POST /api/datasources/:id/disable-permissions`

Disables permissions for the data source with the given `id`. All existing permissions will be removed and anyone will be able to query the data source.

**Example request:**

```http
POST /api/datasources/1/disable-permissions
Accept: application/json
Content-Type: application/json
Authorization: Bearer eyJrIjoiT0tTcG1pUlY2RnVKZTFVaDFsNFZXdE9ZWmNrMkZYbk

{}
```

**Example response:**

```http
HTTP/1.1 200 OK
Content-Type: application/json; charset=UTF-8
Content-Length: 35

{"message":"Datasource permissions disabled"}
```

Status codes:

- **200** - Ok
- **400** - Permissions cannot be disabled, see response body for details
- **401** - Unauthorized
- **403** - Access denied
- **404** - Datasource not found

## Get permissions for a data source

`GET /api/datasources/:id/permissions`

Gets all existing permissions for the data source with the given `id`.

**Example request:**

```http
GET /api/datasources/1/permissions HTTP/1.1
Accept: application/json
Content-Type: application/json
Authorization: Bearer eyJrIjoiT0tTcG1pUlY2RnVKZTFVaDFsNFZXdE9ZWmNrMkZYbk
```

**Example response:**

```http
HTTP/1.1 200 OK
Content-Type: application/json; charset=UTF-8
Content-Length: 551

{
  "datasourceId": 1,
  "enabled": true,
  "permissions":
  [
    {
      "id": 1,
      "datasourceId": 1,
      "userId": 1,
      "userLogin": "user",
      "userEmail": "user@test.com",
      "userAvatarUrl": "/avatar/46d229b033af06a191ff2267bca9ae56",
      "permission": 1,
      "permissionName": "Query",
      "created": "2017-06-20T02:00:00+02:00",
      "updated": "2017-06-20T02:00:00+02:00",
    },
    {
      "id": 2,
      "datasourceId": 1,
      "teamId": 1,
      "team": "A Team",
      "teamAvatarUrl": "/avatar/46d229b033af06a191ff2267bca9ae56",
      "permission": 1,
      "permissionName": "Query",
      "created": "2017-06-20T02:00:00+02:00",
      "updated": "2017-06-20T02:00:00+02:00",
    }
  ]
}
```

Status codes:

- **200** - Ok
- **401** - Unauthorized
- **403** - Access denied
- **404** - Datasource not found

## Add permission for a data source

`POST /api/datasources/:id/permissions`

Adds a user permission for the data source with the given `id`.

**Example request:**

```http
POST /api/datasources/1/permissions
Accept: application/json
Content-Type: application/json
Authorization: Bearer eyJrIjoiT0tTcG1pUlY2RnVKZTFVaDFsNFZXdE9ZWmNrMkZYbk

{
  "userId": 1,
  "permission": 1
}
```

**Example response:**

```http
HTTP/1.1 200 OK
Content-Type: application/json; charset=UTF-8
Content-Length: 35

{"message":"Datasource permission added"}
```

Adds a team permission for the data source with the given `id`.

**Example request:**

```http
POST /api/datasources/1/permissions
Accept: application/json
Content-Type: application/json
Authorization: Bearer eyJrIjoiT0tTcG1pUlY2RnVKZTFVaDFsNFZXdE9ZWmNrMkZYbk

{
  "teamId": 1,
  "permission": 1
}
```

**Example response:**

```http
HTTP/1.1 200 OK
Content-Type: application/json; charset=UTF-8
Content-Length: 35

{"message":"Datasource permission added"}
```

Status codes:

- **200** - Ok
- **400** - Permission cannot be added, see response body for details
- **401** - Unauthorized
- **403** - Access denied
- **404** - Datasource not found

## Remove permission for a data source

`DELETE /api/datasources/:id/permissions/:permissionId`

Removes the permission with the given `permissionId` for the data source with the given `id`.

**Example request:**

```http
DELETE /api/datasources/1/permissions/2
Accept: application/json
Content-Type: application/json
Authorization: Bearer eyJrIjoiT0tTcG1pUlY2RnVKZTFVaDFsNFZXdE9ZWmNrMkZYbk
```

**Example response:**

```http
HTTP/1.1 200 OK
Content-Type: application/json; charset=UTF-8
Content-Length: 35

{"message":"Datasource permission removed"}
```

Status codes:

- **200** - Ok
- **401** - Unauthorized
- **403** - Access denied
- **404** - Datasource not found or permission not found
