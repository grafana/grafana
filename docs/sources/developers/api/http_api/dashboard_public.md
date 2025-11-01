---
aliases:
  - ../../http_api/dashboard_public/
canonical: /docs/grafana/latest/developers/http_api/dashboard_public/
description: Grafana Shared Dashboards HTTP API
keywords:
  - grafana
  - http
  - documentation
  - api
  - dashboard
labels:
  products:
    - enterprise
    - oss
title: Shared Dashboards HTTP API
refs:
  role-based-access-control-permissions:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/administration/roles-and-permissions/access-control/custom-role-actions-scopes/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana/<GRAFANA_VERSION>/administration/roles-and-permissions/access-control/custom-role-actions-scopes/
---

# Shared Dashboards API

{{< admonition type="note" >}}

If you're running Grafana Enterprise, you'll need to have specific permissions for some endpoints. Refer to [Role-based access control permissions](ref:role-based-access-control-permissions) for more information.

{{< /admonition >}}

## Create a shared dashboard

`POST /api/dashboards/uid/:uid/public-dashboards/`

Creates a new shared dashboard.

**Required permissions**

See note in the [introduction](#shared-dashboards-api) for an explanation.

| Action                    | Scope                            |
| ------------------------- | -------------------------------- |
| `dashboards.public:write` | `dashboards:uid:<dashboard UID>` |

**Example Request for new shared dashboard**:

```http
POST /api/dashboards/uid/xCpsVuc4z/public-dashboards/ HTTP/1.1
Accept: application/json
Content-Type: application/json
Authorization: Bearer eyJrIjoiT0tTcG1pUlY2RnVKZTFVaDFsNFZXdE9ZWmNrMkZYbk

{
    "uid": "cd56d9fd-f3d4-486d-afba-a21760e2acbe",
    "accessToken": "5c948bf96e6a4b13bd91975f9a2028b7",
    "timeSelectionEnabled": false,
    "isEnabled": true,
    "annotationsEnabled": false,
    "share": "public"
}
```

JSON Body schema:

- **uid** – Optional. Unique identifier when creating a shared dashboard. If it's null, it will generate a new uid.
- **accessToken** – Optional. Unique access token. If it's null, it will generate a new access token.
- **timeSelectionEnabled** – Optional. Set to `true` to enable the time picker in the shared dashboard. The default value is `false`.
- **isEnabled** – Optional. Set to `true` to enable the shared dashboard. The default value is `false`.
- **annotationsEnabled** – Optional. Set to `true` to show annotations. The default value is `false`.
- **share** – Optional. Set the share mode. The default value is `public`.

**Example Response**:

```http
HTTP/1.1 200 OK
Content-Type: application/json; charset=UTF-8
Content-Length: 78

{
    "uid": "cd56d9fd-f3d4-486d-afba-a21760e2acbe",
    "dashboardUid": "xCpsVuc4z",
    "accessToken": "5c948bf96e6a4b13bd91975f9a2028b7",
    "createdBy": 1,
    "updatedBy": 1,
    "createdAt": "2023-09-05T15:48:21-03:00",
    "updatedAt": "2023-09-05T15:48:21-03:00",
    "timeSelectionEnabled": false,
    "isEnabled": false,
    "annotationsEnabled": false,
    "share": "public"
}
```

Status Codes:

- **200** – Created
- **400** – Errors (such as invalid json, missing or invalid fields, or dashboard is shared)
- **401** – Unauthorized
- **403** – Access denied
- **404** – Dashboard not found

The error response body will have the following properties:

```http
HTTP/1.1 400 Bad request
Content-Type: application/json; charset=UTF-8
Content-Length: 107

{
    "statusCode": 400,
    "messageId": "publicdashboards.dashboardIsPublic",
    "message": "Dashboard is already public"
}
```

## Update a shared dashboard

`PATCH /api/dashboards/uid/:uid/public-dashboards/:publicDashboardUid`

Will update the shared dashboard given the specified unique identifier (uid).

**Required permissions**

See note in the [introduction](#shared-dashboard-api) for an explanation.

| Action                    | Scope                            |
| ------------------------- | -------------------------------- |
| `dashboards.public:write` | `dashboards:uid:<dashboard UID>` |

**Example Request for updating a shared dashboard**:

```http
PATCH /api/dashboards/uid/xCpsVuc4z/public-dashboards/cd56d9fd-f3d4-486d-afba-a21760e2acbe HTTP/1.1
Accept: application/json
Content-Type: application/json
Authorization: Bearer eyJrIjoiT0tTcG1pUlY2RnVKZTFVaDFsNFZXdE9ZWmNrMkZYbk

{
    "timeSelectionEnabled": false,
    "isEnabled": true,
    "annotationsEnabled": false,
    "share": "public"
}
```

JSON Body schema:

- **timeSelectionEnabled** – Optional. Set to `true` to enable the time picker in the shared dashboard. The default value is `false`.
- **isEnabled** – Optional. Set to `true` to enable the shared dashboard. The default value is `false`.
- **annotationsEnabled** – Optional. Set to `true` to show annotations. The default value is `false`.
- **share** – Optional. Set the share mode. The default value is `public`.

**Example Response**:

```http
HTTP/1.1 200 OK
Content-Type: application/json; charset=UTF-8
Content-Length: 78

{
    "uid": "cd56d9fd-f3d4-486d-afba-a21760e2acbe",
    "dashboardUid": "xCpsVuc4z",
    "accessToken": "5c948bf96e6a4b13bd91975f9a2028b7",
    "createdBy": 1,
    "updatedBy": 1,
    "createdAt": "2023-09-05T15:48:21-03:00",
    "updatedAt": "2023-09-05T15:48:21-03:00",
    "timeSelectionEnabled": false,
    "isEnabled": false,
    "annotationsEnabled": false,
    "share": "public"
}
```

Status Codes:

- **200** – Updated
- **400** – Errors (such as invalid json, missing or invalid fields)
- **401** – Unauthorized
- **403** – Access denied
- **404** – Dashboard not found

The error response body will have the following properties:

```http
HTTP/1.1 400 Bad request
Content-Type: application/json; charset=UTF-8
Content-Length: 107

{
    "statusCode": 400,
    "messageId": "publicdashboards.dashboardIsPublic",
    "message": "Dashboard is already public"
}
```

## Get shared dashboard by dashboard uid

`GET /api/dashboards/uid/:uid/public-dashboards/`

Will return the shared dashboard given the dashboard unique identifier (uid).

**Required permissions**

See note in the [introduction](#shared-dashboard-api) for an explanation.

| Action            | Scope                            |
| ----------------- | -------------------------------- |
| `dashboards:read` | `dashboards:uid:<dashboard UID>` |

**Example Request**:

```http
GET /api/dashboards/uid/xCpsVuc4z/public-dashboards/ HTTP/1.1
Accept: application/json
Content-Type: application/json
Authorization: Bearer eyJrIjoiT0tTcG1pUlY2RnVKZTFVaDFsNFZXdE9ZWmNrMkZYbk
```

**Example Response**:

```http
HTTP/1.1 200
Content-Type: application/json

{
    "uid": "e71950f3-e7dd-4d1e-aa8a-a857bc5e7d64",
    "dashboardUid": "xCpsVuc4z",
    "accessToken": "dab10f3a4fbb4342a602b03079c7ed64",
    "createdBy": 1,
    "updatedBy": 1,
    "createdAt": "2023-09-05T15:48:21-03:00",
    "updatedAt": "2023-09-05T15:48:21-03:00",
    "timeSelectionEnabled": false,
    "isEnabled": false,
    "annotationsEnabled": false,
    "share": "public"
}
```

Status Codes:

- **200** – Found
- **401** – Unauthorized
- **403** – Access denied
- **404** – Dashboard not found

## Delete shared dashboard by dashboard uid and shared dashboard uid

`DELETE /api/dashboards/uid/:uid/public-dashboards/:publicDashboardUid`

Will delete the shared dashboard given the specified unique identifier (uid).

**Required permissions**

See note in the [introduction](#shared-dashboard-api) for an explanation.

| Action                    | Scope                            |
| ------------------------- | -------------------------------- |
| `dashboards.public:write` | `dashboards:uid:<dashboard UID>` |

**Example Request**:

```http
DELETE /api/dashboards/uid/xCpsVuc4z/public-dashboards/cd56d9fd-f3d4-486d-afba-a21760e2acbe HTTP/1.1
Accept: application/json
Content-Type: application/json
Authorization: Bearer eyJrIjoiT0tTcG1pUlY2RnVKZTFVaDFsNFZXdE9ZWmNrMkZYbk
```

Status Codes:

- **200** – Deleted
- **401** – Unauthorized
- **403** – Access denied

## Get a list of all shared dashboards with pagination

`GET /api/dashboards/public-dashboards`

**Required permissions**

See note in the [introduction](#shared-dashboard-api) for an explanation.

| Action            | Scope                            |
| ----------------- | -------------------------------- |
| `dashboards:read` | `dashboards:uid:<dashboard UID>` |

**Example Request**:

```http
GET /api/dashboards/public-dashboards?perpage=2&page=3 HTTP/1.1
Accept: application/json
Content-Type: application/json
Authorization: Bearer eyJrIjoiT0tTcG1pUlY2RnVKZTFVaDFsNFZXdE9ZWmNrMkZYbk
```

**Example Response**:

```http
HTTP/1.1 200
Content-Type: application/json

{
    "publicDashboards": [
        {
            "uid": "e9f29a3c-fcc3-4fc5-a690-ae39c97d24ba",
            "accessToken": "6c13ec1997ba48c5af8c9c5079049692",
            "title": "Datasource Shared Queries",
            "dashboardUid": "d2f21d0a-76c7-47ec-b5f3-9dda16e5a996",
            "isEnabled": true
        },
        {
            "uid": "a174f604-6fe7-47de-97b4-48b7e401b540",
            "accessToken": "d1fcff345c0f45e8a78c096c9696034a",
            "title": "Datasource with template variables",
            "dashboardUid": "51DiOw0Vz",
            "isEnabled": true
        }
    ],
    "totalCount": 30,
    "page": 3,
    "perPage": 2
}
```
