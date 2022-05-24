+++
aliases = ["/docs/grafana/latest/developers/http_api/dashboard_permissions/", "/docs/grafana/latest/http_api/dashboard_permissions/", "/docs/grafana/latest/http_api/dashboardpermissions/"]
description = "Grafana Dashboard Permissions HTTP API"
keywords = ["grafana", "http", "documentation", "api", "dashboard", "permission", "permissions", "acl"]
title = "Dashboard Permissions HTTP API "
+++

# Dashboard Permissions API

This API can be used to update/get the permissions for a dashboard.

Permissions with `dashboardId=-1` are the default permissions for users with the Viewer and Editor roles. Permissions can be set for a user, a team or a role (Viewer or Editor). Permissions cannot be set for Admins - they always have access to everything.

The permission levels for the permission field:

- 1 = View
- 2 = Edit
- 4 = Admin

> If you are running Grafana Enterprise, for some endpoints you'll need to have specific permissions. Refer to [Role-based access control permissions]({{< relref "../../enterprise/access-control/custom-role-actions-scopes" >}}) for more information.

## Get permissions for a dashboard

`GET /api/dashboards/uid/:uid/permissions`

Gets all existing permissions for the dashboard with the given `uid`.

**Required permissions**

See note in the [introduction]({{< ref "#dashboard-permission-api" >}}) for an explanation.

| Action                        | Scope                                 |
| ----------------------------- | ------------------------------------- |
| `dashboards.permissions:read` | `dashboards:uid:*`<br>`folders:uid:*` |

**Example request**:

```http
GET /api/dashboards/uid/dHEquNzGz/permissions HTTP/1.1
Accept: application/json
Content-Type: application/json
Authorization: Bearer eyJrIjoiT0tTcG1pUlY2RnVKZTFVaDFsNFZXdE9ZWmNrMkZYbk
```

**Example Response**

```http
HTTP/1.1 200 OK
Content-Type: application/json; charset=UTF-8
Content-Length: 551

[
  {
    "id": 1,
    "dashboardId": -1,
    "created": "2017-06-20T02:00:00+02:00",
    "updated": "2017-06-20T02:00:00+02:00",
    "userId": 0,
    "userLogin": "",
    "userEmail": "",
    "teamId": 0,
    "team": "",
    "role": "Viewer",
    "permission": 1,
    "permissionName": "View",
    "uid": "dHEquNzGz",
    "title": "",
    "slug": "",
    "isFolder": false,
    "url": ""
  },
  {
    "id": 2,
    "dashboardId": -1,
    "created": "2017-06-20T02:00:00+02:00",
    "updated": "2017-06-20T02:00:00+02:00",
    "userId": 0,
    "userLogin": "",
    "userEmail": "",
    "teamId": 0,
    "team": "",
    "role": "Editor",
    "permission": 2,
    "permissionName": "Edit",
    "uid": "dHEquNzGz",
    "title": "",
    "slug": "",
    "isFolder": false,
    "url": ""
  }
]
```

Status Codes:

- **200** - Ok
- **401** - Unauthorized
- **403** - Access denied
- **404** - Dashboard not found

## Update permissions for a dashboard

`POST /api/dashboards/uid/:uid/permissions`

Updates permissions for a dashboard. This operation will remove existing permissions if they're not included in the request.

**Required permissions**

See note in the [introduction]({{< ref "#dashboard-permission-api" >}}) for an explanation.

| Action                         | Scope                                 |
| ------------------------------ | ------------------------------------- |
| `dashboards.permissions:write` | `dashboards:uid:*`<br>`folders:uid:*` |

**Example request**:

```http
POST /api/dashboards/uid/dHEquNzGz/permissions
Accept: application/json
Content-Type: application/json
Authorization: Bearer eyJrIjoiT0tTcG1pUlY2RnVKZTFVaDFsNFZXdE9ZWmNrMkZYbk

{
  "items": [
    {
      "role": "Viewer",
      "permission": 1
    },
    {
      "role": "Editor",
      "permission": 2
    },
    {
      "teamId": 1,
      "permission": 1
    },
    {
      "userId": 11,
      "permission": 4
    }
  ]
}
```

JSON body schema:

- **items** - The permission items to add/update. Items that are omitted from the list will be removed.

**Example response**:

```http
HTTP/1.1 200 OK
Content-Type: application/json; charset=UTF-8
Content-Length: 35

{"message":"Dashboard permissions updated"}
```

Status Codes:

- **200** - Ok
- **401** - Unauthorized
- **403** - Access denied
- **404** - Dashboard not found

## Get permissions for a dashboard by id

> **Warning:** This API is deprecated since Grafana v9.0.0 and will be removed in a future release. Refer to the [new dashboard permissions API](#get-permissions-for-a-dashboard).

`GET /api/dashboards/id/:dashboardId/permissions`

Gets all existing permissions for the dashboard with the given `dashboardId`.

**Required permissions**

See note in the [introduction]({{< ref "#dashboard-permission-api" >}}) for an explanation.

| Action                        | Scope                         |
| ----------------------------- | ----------------------------- |
| `dashboards.permissions:read` | `dashboards:*`<br>`folders:*` |

**Example request**:

```http
GET /api/dashboards/id/1/permissions HTTP/1.1
Accept: application/json
Content-Type: application/json
Authorization: Bearer eyJrIjoiT0tTcG1pUlY2RnVKZTFVaDFsNFZXdE9ZWmNrMkZYbk
```

**Example Response**

```http
HTTP/1.1 200 OK
Content-Type: application/json; charset=UTF-8
Content-Length: 551

[
  {
    "id": 1,
    "dashboardId": -1,
    "created": "2017-06-20T02:00:00+02:00",
    "updated": "2017-06-20T02:00:00+02:00",
    "userId": 0,
    "userLogin": "",
    "userEmail": "",
    "teamId": 0,
    "team": "",
    "role": "Viewer",
    "permission": 1,
    "permissionName": "View",
    "uid": "",
    "title": "",
    "slug": "",
    "isFolder": false,
    "url": ""
  },
  {
    "id": 2,
    "dashboardId": -1,
    "created": "2017-06-20T02:00:00+02:00",
    "updated": "2017-06-20T02:00:00+02:00",
    "userId": 0,
    "userLogin": "",
    "userEmail": "",
    "teamId": 0,
    "team": "",
    "role": "Editor",
    "permission": 2,
    "permissionName": "Edit",
    "uid": "",
    "title": "",
    "slug": "",
    "isFolder": false,
    "url": ""
  }
]
```

Status Codes:

- **200** - Ok
- **401** - Unauthorized
- **403** - Access denied
- **404** - Dashboard not found

## Update permissions for a dashboard by id

> **Warning:** This API is deprecated since Grafana v9.0.0 and will be removed in a future release. Refer to the [new dashboard permissions API](#update-permissions-for-a-dashboard).

`POST /api/dashboards/id/:dashboardId/permissions`

Updates permissions for a dashboard. This operation will remove existing permissions if they're not included in the request.

**Required permissions**

See note in the [introduction]({{< ref "#dashboard-permission-api" >}}) for an explanation.

| Action                         | Scope                         |
| ------------------------------ | ----------------------------- |
| `dashboards.permissions:write` | `dashboards:*`<br>`folders:*` |

**Example request**:

```http
POST /api/dashboards/id/1/permissions
Accept: application/json
Content-Type: application/json
Authorization: Bearer eyJrIjoiT0tTcG1pUlY2RnVKZTFVaDFsNFZXdE9ZWmNrMkZYbk

{
  "items": [
    {
      "role": "Viewer",
      "permission": 1
    },
    {
      "role": "Editor",
      "permission": 2
    },
    {
      "teamId": 1,
      "permission": 1
    },
    {
      "userId": 11,
      "permission": 4
    }
  ]
}
```

JSON body schema:

- **items** - The permission items to add/update. Items that are omitted from the list will be removed.

**Example response**:

```http
HTTP/1.1 200 OK
Content-Type: application/json; charset=UTF-8
Content-Length: 35

{"message":"Dashboard permissions updated"}
```

Status Codes:

- **200** - Ok
- **401** - Unauthorized
- **403** - Access denied
- **404** - Dashboard not found
