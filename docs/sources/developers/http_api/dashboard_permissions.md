---
aliases:
  - ../../http_api/dashboard_permissions/
  - ../../http_api/dashboardpermissions/
canonical: /docs/grafana/latest/developers/http_api/dashboard_permissions/
description: Grafana Dashboard Permissions HTTP API
keywords:
  - grafana
  - http
  - documentation
  - api
  - dashboard
  - permission
  - permissions
  - acl
labels:
  products:
    - enterprise
    - oss
title: Dashboard Permissions HTTP API
---

# Dashboard Permissions API

## Overview

The Dashboard Permissions API allows you to manage access control for dashboards in Grafana. You can use this API to:

- Retrieve current permissions for a dashboard
- Update permissions for users, teams, or roles
- Set default permissions for viewers and editors

## Permission Levels

Dashboard permissions use a numeric system to define access levels:

| Level | Value | Description |
|-------|-------|-------------|
| View  | 1     | Can view the dashboard but cannot make changes |
| Edit  | 2     | Can view and edit the dashboard |
| Admin | 4     | Full control over the dashboard, including permission management |

> **Note:** Admin users always have full access to all dashboards and cannot have their permissions restricted.

## Get Dashboard Permissions

`GET /api/dashboards/uid/:uid/permissions`

Retrieves all permissions for a specific dashboard.

### Required Permissions

| Action | Scope |
|--------|-------|
| `dashboards.permissions:read` | `dashboards:*`, `dashboards:uid:*`, `folders:*`, `folders:uid:*` |

### Example Request

```http
GET /api/dashboards/uid/dHEquNzGz/permissions HTTP/1.1
Accept: application/json
Content-Type: application/json
Authorization: Bearer eyJrIjoiT0tTcG1pUlY2RnVKZTFVaDFsNFZXdE9ZWmNrMkZYbk
```

### Example Response

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

### Response Fields

| Field | Description |
|-------|-------------|
| `id` | Unique identifier for the permission entry |
| `dashboardId` | Dashboard ID (-1 for default permissions) |
| `created` | Creation timestamp |
| `updated` | Last update timestamp |
| `userId` | User ID (0 if not applicable) |
| `userLogin` | Username (empty if not applicable) |
| `userEmail` | User email (empty if not applicable) |
| `teamId` | Team ID (0 if not applicable) |
| `team` | Team name (empty if not applicable) |
| `role` | Role name (Viewer, Editor, or empty) |
| `permission` | Numeric permission level (1=View, 2=Edit, 4=Admin) |
| `permissionName` | Human-readable permission name |
| `uid` | Dashboard UID |
| `title` | Dashboard title |
| `slug` | Dashboard slug |
| `isFolder` | Whether this is a folder permission |
| `url` | Dashboard URL |

### Status Codes

| Code | Description |
|------|-------------|
| 200  | Success |
| 401  | Unauthorized |
| 403  | Access denied |
| 404  | Dashboard not found |

## Update Dashboard Permissions

`POST /api/dashboards/uid/:uid/permissions`

Updates permissions for a dashboard. This operation replaces all existing permissions with the ones specified in the request.

### Required Permissions

| Action | Scope |
|--------|-------|
| `dashboards.permissions:write` | `dashboards:*`, `dashboards:uid:*`, `folders:*`, `folders:uid:*` |

### Example Request

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

### Request Body

| Field | Description |
|-------|-------------|
| `items` | Array of permission items to set |

Each permission item can have one of these combinations:
- `role` and `permission` - Sets permission for a role (Viewer or Editor)
- `teamId` and `permission` - Sets permission for a specific team
- `userId` and `permission` - Sets permission for a specific user

### Example Response

```http
HTTP/1.1 200 OK
Content-Type: application/json; charset=UTF-8
Content-Length: 35

{"message":"Dashboard permissions updated"}
```

### Status Codes

| Code | Description |
|------|-------------|
| 200  | Success |
| 401  | Unauthorized |
| 403  | Access denied |
| 404  | Dashboard not found |

## Best Practices

1. **Always include default role permissions** in your updates to ensure consistent access
2. **Use the dashboard UID** rather than ID for more reliable identification
3. **Check existing permissions** before making changes to avoid unintended access changes
4. **Consider using teams** for permission management instead of individual users when possible
5. **Document your permission changes** for audit purposes

## Common Use Cases

### Setting Default Permissions

To set default permissions for all dashboards:

```json
{
  "items": [
    {
      "role": "Viewer",
      "permission": 1
    },
    {
      "role": "Editor",
      "permission": 2
    }
  ]
}
```

### Granting Team Access

To give a team view access to a dashboard:

```json
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
      "teamId": 5,
      "permission": 1
    }
  ]
}
```

### Granting Admin Access to a User

To give a specific user admin access to a dashboard:

```json
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
      "userId": 42,
      "permission": 4
    }
  ]
}
```
