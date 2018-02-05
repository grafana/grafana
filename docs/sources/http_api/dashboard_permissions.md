+++
title = "Dashboard Permissions HTTP API "
description = "Grafana Dashboard Permissions HTTP API"
keywords = ["grafana", "http", "documentation", "api", "dashboard", "permission", "permissions", "acl"]
aliases = ["/http_api/dashboardpermissions/"]
type = "docs"
[menu.docs]
name = "Dashboard Permissions"
parent = "http_api"
+++

# Dashboard Permissions/ACL API

This API can be used to update/get the ACL for a dashboard or a folder.

Permissions with dashboardId set to `-1` are the default permissions for users with the Viewer and Editor roles. Permissions can be set for a user, a team or a role (Viewer or Editor). Permissions cannot be set for Admins - they always have access to everything.

The permission levels for the permission field:

- 1 = View
- 2 = Edit
- 4 = Admin

## Get ACL/Permissions for a Dashboard or Folder

`GET /api/dashboards/id/:dashboardId/acl`

Gets all existing dashboard permissions for the dashboard or folder with the given `dashboardId`.

**Example request for getting the ACL/Permissions**:

```http
GET /api/dashboards/id/1/acl HTTP/1.1
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
- **403** - Access denied
- **404** - Dashboard not found

## Save Dashboard Permissions/ACL for a Dashboard or Folder

`POST /api/dashboards/id/:dashboardId/acl`

Updates the ACL for a dashboard or folder. Takes in a list of permissions and adds, remove or updates permissions in the list in the database.

**Example request for saving a list of permission items**:

```http
POST /api/dashboards/id/1/acl
Accept: application/json
Content-Type: application/json
Authorization: Bearer eyJrIjoiT0tTcG1pUlY2RnVKZTFVaDFsNFZXdE9ZWmNrMkZYbk

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

- **items** - The permission items to add/update. Items that are omitted from the list will be removed from the db.

**Example response**:

```http
HTTP/1.1 200 OK
Content-Type: application/json; charset=UTF-8
Content-Length: 35

{"message":"Dashboard acl updated"}
```

Status Codes:

- **200** - Ok
- **403** - Access denied
- **404** - Dashboard not found


## Delete Permission from the Dashboard ACL/Permissions List for a Dashboard or Folder

`DELETE /api/dashboards/id/:dashboardId/acl/:aclId`

The above will delete an item from a dashboard or folder ACL given the id of the permission item.

**Example Request**:

```http
DELETE /api/dashboards/id/1/acl/540 HTTP/1.1
Accept: application/json
Content-Type: application/json
Authorization: Bearer eyJrIjoiT0tTcG1pUlY2RnVKZTFVaDFsNFZXdE9ZWmNrMkZYbk
```

**Example Response**:

```http
HTTP/1.1 200
Content-Type: application/json
Content-Length: 0
```

Status Codes:

- **200** - Ok
- **403** - Access denied
- **404** - Dashboard permission not found

