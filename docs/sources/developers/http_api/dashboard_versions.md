---
aliases:
  - ../../http_api/dashboard_versions/
  - ../../http_api/dashboardversions/
canonical: /docs/grafana/latest/developers/http_api/dashboard_versions/
description: Grafana Dashboard Versions HTTP API
keywords:
  - grafana
  - http
  - documentation
  - api
  - dashboard
  - versions
labels:
  products:
    - enterprise
    - oss
title: 'Dashboard Versions HTTP API '
---

# Dashboard Versions

## Get all dashboard versions

{{% admonition type="warning" %}}
This API is deprecated since Grafana v9.0.0 and will be removed in a future release. Refer to the [new dashboard versions API](#get-all-dashboard-versions-by-dashboard-uid).
{{% /admonition %}}

Query parameters:

- **limit** - Maximum number of results to return
- **start** - Version to start from when returning queries

`GET /api/dashboards/id/:dashboardId/versions`

Gets all existing dashboard versions for the dashboard with the given `dashboardId`.

**Example request for getting all dashboard versions**:

```http
GET /api/dashboards/id/1/versions?limit=2?start=0 HTTP/1.1
Accept: application/json
Content-Type: application/json
Authorization: Bearer eyJrIjoiT0tTcG1pUlY2RnVKZTFVaDFsNFZXdE9ZWmNrMkZYbk
```

**Example Response**

```http
HTTP/1.1 200 OK
Content-Type: application/json; charset=UTF-8
Content-Length: 428

[
  {
    "id": 2,
    "dashboardId": 1,
    "parentVersion": 1,
    "restoredFrom": 0,
    "version": 2,
    "created": "2017-06-08T17:24:33-04:00",
    "createdBy": "admin",
    "message": "Updated panel title"
  },
  {
    "id": 1,
    "dashboardId": 1,
    "parentVersion": 0,
    "restoredFrom": 0,
    "version": 1,
    "created": "2017-06-08T17:23:33-04:00",
    "createdBy": "admin",
    "message": "Initial save"
  }
]
```

Status Codes:

- **200** - Ok
- **400** - Errors
- **401** - Unauthorized
- **404** - Dashboard version not found

## Get all dashboard versions by dashboard UID

Query parameters:

- **limit** - Maximum number of results to return
- **start** - Version to start from when returning queries

`GET /api/dashboards/uid/:uid/versions`

Gets all existing dashboard versions for the dashboard with the given `uid`.

**Example request for getting all dashboard versions**:

```http
GET /api/dashboards/uid/QA7wKklGz/versions?limit=2?start=0 HTTP/1.1
Accept: application/json
Content-Type: application/json
Authorization: Bearer eyJrIjoiT0tTcG1pUlY2RnVKZTFVaDFsNFZXdE9ZWmNrMkZYbk
```

**Example Response**

```http
HTTP/1.1 200 OK
Content-Type: application/json; charset=UTF-8
Content-Length: 428

[
  {
    "id": 2,
    "dashboardId": 1,
    "uid": "QA7wKklGz",
    "parentVersion": 1,
    "restoredFrom": 0,
    "version": 2,
    "created": "2017-06-08T17:24:33-04:00",
    "createdBy": "admin",
    "message": "Updated panel title"
  },
  {
    "id": 1,
    "dashboardId": 1,
    "uid": "QA7wKklGz",
    "parentVersion": 0,
    "restoredFrom": 0,
    "version": 1,
    "created": "2017-06-08T17:23:33-04:00",
    "createdBy": "admin",
    "message": "Initial save"
  }
]
```

Status Codes:

- **200** - Ok
- **400** - Errors
- **401** - Unauthorized
- **404** - Dashboard version not found

## Get dashboard version

{{% admonition type="warning" %}}
This API is deprecated since Grafana v9.0.0 and will be removed in a future release. Refer to the [new get dashboard version API](#get-dashboard-version-by-dashboard-uid).
{{% /admonition %}}

`GET /api/dashboards/id/:dashboardId/versions/:version`

Get the dashboard version with the given version, for the dashboard with the given id.

**Example request for getting a dashboard version**:

```http
GET /api/dashboards/id/1/versions/1 HTTP/1.1
Accept: application/json
Content-Type: application/json
Authorization: Bearer eyJrIjoiT0tTcG1pUlY2RnVKZTFVaDFsNFZXdE9ZWmNrMkZYbk
```

**Example response**:

```http
HTTP/1.1 200 OK
Content-Type: application/json; charset=UTF-8
Content-Length: 1300

{
  "id": 1,
  "dashboardId": 1,
  "parentVersion": 0,
  "restoredFrom": 0,
  "version": 1,
  "created": "2017-04-26T17:18:38-04:00",
  "message": "Initial save",
  "data": {
    "annotations": {
      "list": [

      ]
    },
    "editable": true,
    "gnetId": null,
    "graphTooltip": 0,
    "id": 1,
    "links": [

    ],
    "rows": [
      {
        "collapse": false,
        "height": "250px",
        "panels": [

        ],
        "repeat": null,
        "repeatIteration": null,
        "repeatRowId": null,
        "showTitle": false,
        "title": "Dashboard Row",
        "titleSize": "h6"
      }
    ],
    "schemaVersion": 14,
      "tags": [

    ],
    "templating": {
      "list": [

      ]
    },
    "time": {
      "from": "now-6h",
      "to": "now"
    },
    "timepicker": {},
    "timezone": "browser",
    "title": "test",
    "version": 1
  },
  "createdBy": "admin"
}
```

Status Codes:

- **200** - Ok
- **401** - Unauthorized
- **404** - Dashboard version not found

## Get dashboard version by dashboard UID

`GET /api/dashboards/uid/:uid/versions/:version`

Get the dashboard version with the given version, for the dashboard with the given UID.

**Example request for getting a dashboard version**:

```http
GET /api/dashboards/id/1/versions/1 HTTP/1.1
Accept: application/json
Content-Type: application/json
Authorization: Bearer eyJrIjoiT0tTcG1pUlY2RnVKZTFVaDFsNFZXdE9ZWmNrMkZYbk
```

**Example response**:

```http
HTTP/1.1 200 OK
Content-Type: application/json; charset=UTF-8
Content-Length: 1300

{
  "id": 1,
  "dashboardId": 1,
  "uid": "QA7wKklGz",
  "parentVersion": 0,
  "restoredFrom": 0,
  "version": 1,
  "created": "2017-04-26T17:18:38-04:00",
  "message": "Initial save",
  "data": {
    "annotations": {
      "list": [

      ]
    },
    "editable": true,
    "gnetId": null,
    "graphTooltip": 0,
    "id": 1,
    "links": [

    ],
    "rows": [
      {
        "collapse": false,
        "height": "250px",
        "panels": [

        ],
        "repeat": null,
        "repeatIteration": null,
        "repeatRowId": null,
        "showTitle": false,
        "title": "Dashboard Row",
        "titleSize": "h6"
      }
    ],
    "schemaVersion": 14,
      "tags": [

    ],
    "templating": {
      "list": [

      ]
    },
    "time": {
      "from": "now-6h",
      "to": "now"
    },
    "timepicker": {},
    "timezone": "browser",
    "title": "test",
    "version": 1
  },
  "createdBy": "admin"
}
```

Status Codes:

- **200** - Ok
- **401** - Unauthorized
- **404** - Dashboard version not found

## Restore dashboard

{{% admonition type="warning" %}}
This API is deprecated since Grafana v9.0.0 and will be removed in a future release. Refer to the [new restore dashboard API](#restore-dashboard-by-dashboard-uid).
{{% /admonition %}}

`POST /api/dashboards/id/:dashboardId/restore`

Restores a dashboard to a given dashboard version.

**Example request for restoring a dashboard version**:

```http
POST /api/dashboards/id/1/restore
Accept: application/json
Content-Type: application/json
Authorization: Bearer eyJrIjoiT0tTcG1pUlY2RnVKZTFVaDFsNFZXdE9ZWmNrMkZYbk

{
  "version": 1
}
```

JSON body schema:

- **version** - The dashboard version to restore to

**Example response**:

```http
HTTP/1.1 200 OK
Content-Type: application/json; charset=UTF-8
Content-Length: 67

{
  "slug": "my-dashboard",
  "status": "success",
  "version": 3
}
```

JSON response body schema:

- **slug** - the URL friendly slug of the dashboard's title
- **status** - whether the restoration was successful or not
- **version** - the new dashboard version, following the restoration

Status codes:

- **200** - OK
- **401** - Unauthorized
- **404** - Not found (dashboard not found or dashboard version not found)
- **500** - Internal server error (indicates issue retrieving dashboard tags from database)

**Example error response**

```http
HTTP/1.1 404 Not Found
Content-Type: application/json; charset=UTF-8
Content-Length: 46

{
  "message": "Dashboard version not found"
}
```

JSON response body schema:

- **message** - Message explaining the reason for the request failure.

## Restore dashboard by dashboard UID

`POST /api/dashboards/uid/:uid/restore`

Restores a dashboard to a given dashboard version using `uid`.

**Example request for restoring a dashboard version**:

```http
POST /api/dashboards/uid/QA7wKklGz/restore
Accept: application/json
Content-Type: application/json
Authorization: Bearer eyJrIjoiT0tTcG1pUlY2RnVKZTFVaDFsNFZXdE9ZWmNrMkZYbk

{
  "version": 1
}
```

JSON body schema:

- **version** - The dashboard version to restore to

**Example response**:

```http
HTTP/1.1 200 OK
Content-Type: application/json; charset=UTF-8
Content-Length: 67

{
  "id": 70,
  "slug": "my-dashboard",
  "status": "success",
  "uid": "QA7wKklGz",
  "url": "/d/QA7wKklGz/my-dashboard",
  "version": 3
}
```

JSON response body schema:

- **slug** - the URL friendly slug of the dashboard's title
- **status** - whether the restoration was successful or not
- **version** - the new dashboard version, following the restoration

Status codes:

- **200** - OK
- **401** - Unauthorized
- **404** - Not found (dashboard not found or dashboard version not found)
- **500** - Internal server error (indicates issue retrieving dashboard tags from database)

**Example error response**

```http
HTTP/1.1 404 Not Found
Content-Type: application/json; charset=UTF-8
Content-Length: 46

{
  "message": "Dashboard version not found"
}
```

JSON response body schema:

- **message** - Message explaining the reason for the request failure.

## Compare dashboard versions

`POST /api/dashboards/calculate-diff`

Compares two dashboard versions by calculating the JSON diff of them.

**Example request**:

```http
POST /api/dashboards/calculate-diff HTTP/1.1
Accept: text/html
Content-Type: application/json
Authorization: Bearer eyJrIjoiT0tTcG1pUlY2RnVKZTFVaDFsNFZXdE9ZWmNrMkZYbk

{
  "base": {
    "dashboardId": 1,
    "version": 1
  },
  "new": {
    "dashboardId": 1,
    "version": 2
  },
  "diffType": "json"
}
```

JSON body schema:

- **base** - an object representing the base dashboard version
- **new** - an object representing the new dashboard version
- **diffType** - the type of diff to return. Can be "json" or "basic".

**Example response (JSON diff)**:

```http
HTTP/1.1 200 OK
Content-Type: text/html; charset=UTF-8

<p id="l1" class="diff-line diff-json-same">
  <!-- Diff omitted -->
</p>
```

The response is a textual representation of the diff, with the dashboard values being in JSON, similar to the diffs seen on sites like GitHub or GitLab.

Status Codes:

- **200** - Ok
- **400** - Bad request (invalid JSON sent)
- **401** - Unauthorized
- **404** - Not found

**Example response (basic diff)**:

```http
HTTP/1.1 200 OK
Content-Type: text/html; charset=UTF-8

<div class="diff-group">
  <!-- Diff omitted -->
</div>
```

The response here is a summary of the changes, derived from the diff between the two JSON objects.

Status Codes:

- **200** - OK
- **400** - Bad request (invalid JSON sent)
- **401** - Unauthorized
- **404** - Not found
