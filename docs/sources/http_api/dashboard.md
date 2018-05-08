+++
title = "Dashboard HTTP API "
description = "Grafana Dashboard HTTP API"
keywords = ["grafana", "http", "documentation", "api", "dashboard"]
aliases = ["/http_api/dashboard/"]
type = "docs"
[menu.docs]
name = "Dashboard"
parent = "http_api"
+++

# Dashboard API

## Identifier (id) vs unique identifier (uid)

The identifier (id) of a dashboard is an auto-incrementing numeric value and is only unique per Grafana install.

The unique identifier (uid) of a dashboard can be used for uniquely identify a dashboard between multiple Grafana installs.
It's automatically generated if not provided when creating a dashboard. The uid allows having consistent URL's for accessing
dashboards and when syncing dashboards between multiple Grafana installs, see [dashboard provisioning](/administration/provisioning/#dashboards)
for more information. This means that changing the title of a dashboard will not break any bookmarked links to that dashboard.

The uid can have a maximum length of 40 characters.

## Create / Update dashboard

`POST /api/dashboards/db`

Creates a new dashboard or updates an existing dashboard.

**Example Request for new dashboard**:

```http
POST /api/dashboards/db HTTP/1.1
Accept: application/json
Content-Type: application/json
Authorization: Bearer eyJrIjoiT0tTcG1pUlY2RnVKZTFVaDFsNFZXdE9ZWmNrMkZYbk

{
  "dashboard": {
    "id": null,
    "uid": null,
    "title": "Production Overview",
    "tags": [ "templated" ],
    "timezone": "browser",
    "schemaVersion": 16,
    "version": 0
  },
  "folderId": 0,
  "overwrite": false
}
```

JSON Body schema:

- **dashboard** – The complete dashboard model, id = null to create a new dashboard.
- **dashboard.id** – id = null to create a new dashboard.
- **dashboard.uid** – Optional [unique identifier](/http_api/dashboard/#identifier-id-vs-unique-identifier-uid) when creating a dashboard. uid = null will generate a new uid.
- **folderId** – The id of the folder to save the dashboard in.
- **overwrite** – Set to true if you want to overwrite existing dashboard with newer version, same dashboard title in folder or same dashboard uid.
- **message** - Set a commit message for the version history.

**Example Response**:

```http
HTTP/1.1 200 OK
Content-Type: application/json; charset=UTF-8
Content-Length: 78

{
  "id":      1,
  "uid":     "cIBgcSjkk",
  "url":     "/d/cIBgcSjkk/production-overview",
  "status":  "success",
  "version": 1,
  "slug":    "production-overview" //deprecated in Grafana v5.0
}
```

Status Codes:

- **200** – Created
- **400** – Errors (invalid json, missing or invalid fields, etc)
- **401** – Unauthorized
- **403** – Access denied
- **412** – Precondition failed

The **412** status code is used for explaing that you cannot create the dashboard and why.
There can be different reasons for this:

- The dashboard has been changed by someone else, `status=version-mismatch`
- A dashboard with the same name in the folder already exists, `status=name-exists`
- A dashboard with the same uid already exists, `status=name-exists`
- The dashboard belongs to plugin `<plugin title>`, `status=plugin-dashboard`

 The response body will have the following properties:

```http
HTTP/1.1 412 Precondition Failed
Content-Type: application/json; charset=UTF-8
Content-Length: 97

{
  "message": "The dashboard has been changed by someone else",
  "status": "version-mismatch"
}
```

In case of title already exists the `status` property will be `name-exists`.

## Get dashboard by uid

`GET /api/dashboards/uid/:uid`

Will return the dashboard given the dashboard unique identifier (uid).

**Example Request**:

```http
GET /api/dashboards/uid/cIBgcSjkk HTTP/1.1
Accept: application/json
Content-Type: application/json
Authorization: Bearer eyJrIjoiT0tTcG1pUlY2RnVKZTFVaDFsNFZXdE9ZWmNrMkZYbk
```

**Example Response**:

```http
HTTP/1.1 200
Content-Type: application/json

{
  "dashboard": {
    "id": 1,
    "uid": "cIBgcSjkk",
    "title": "Production Overview",
    "tags": [ "templated" ],
    "timezone": "browser",
    "schemaVersion": 16,
    "version": 0
  },
  "meta": {
    "isStarred": false,
    "url": "/d/cIBgcSjkk/production-overview",
    "slug": "production-overview" //deprecated in Grafana v5.0
  }
}
```

Status Codes:

- **200** – Found
- **401** – Unauthorized
- **403** – Access denied
- **404** – Not found

## Delete dashboard by uid

`DELETE /api/dashboards/uid/:uid`

Will delete the dashboard given the specified unique identifier (uid).

**Example Request**:

```http
DELETE /api/dashboards/uid/cIBgcSjkk HTTP/1.1
Accept: application/json
Content-Type: application/json
Authorization: Bearer eyJrIjoiT0tTcG1pUlY2RnVKZTFVaDFsNFZXdE9ZWmNrMkZYbk
```

**Example Response**:

```http
HTTP/1.1 200
Content-Type: application/json

{"title": "Production Overview"}
```

Status Codes:

- **200** – Deleted
- **401** – Unauthorized
- **403** – Access denied
- **404** – Not found

## Gets the home dashboard

`GET /api/dashboards/home`

Will return the home dashboard.

**Example Request**:

```http
GET /api/dashboards/home HTTP/1.1
Accept: application/json
Content-Type: application/json
Authorization: Bearer eyJrIjoiT0tTcG1pUlY2RnVKZTFVaDFsNFZXdE9ZWmNrMkZYbk
```

**Example Response**:

```http
HTTP/1.1 200
Content-Type: application/json

{
  "dashboard": {
    "editable":false,
    "hideControls":true,
    "nav":[
      {
        "enable":false,
        "type":"timepicker"
      }
    ],
    "style":"dark",
    "tags":[],
    "templating":{
      "list":[
      ]
    },
    "time":{
    },
    "timezone":"browser",
    "title":"Home",
    "version":5
  },
  "meta":	{
    "isHome":true,
    "canSave":false,
    "canEdit":false,
    "canStar":false,
    "url":"",
    "expires":"0001-01-01T00:00:00Z",
    "created":"0001-01-01T00:00:00Z"
  }
}
```

## Tags for Dashboard

`GET /api/dashboards/tags`

Get all tags of dashboards

**Example Request**:

```http
GET /api/dashboards/tags HTTP/1.1
Accept: application/json
Content-Type: application/json
Authorization: Bearer eyJrIjoiT0tTcG1pUlY2RnVKZTFVaDFsNFZXdE9ZWmNrMkZYbk
```

**Example Response**:

```http
HTTP/1.1 200
Content-Type: application/json

[
  {
    "term":"tag1",
    "count":1
  },
  {
    "term":"tag2",
    "count":4
  }
]
```

## Dashboard Search
See [Folder/Dashboard Search API](/http_api/folder_dashboard_search).

## Deprecated resources
Please note that these resource have been deprecated and will be removed in a future release.

### Get dashboard by slug
**Deprecated starting from Grafana v5.0. Please update to use the new *Get dashboard by uid* resource instead**

`GET /api/dashboards/db/:slug`

Will return the dashboard given the dashboard slug. Slug is the url friendly version of the dashboard title.
If there exists multiple dashboards with the same slug, one of them will be returned in the response.

**Example Request**:

```http
GET /api/dashboards/db/production-overview HTTP/1.1
Accept: application/json
Content-Type: application/json
Authorization: Bearer eyJrIjoiT0tTcG1pUlY2RnVKZTFVaDFsNFZXdE9ZWmNrMkZYbk
```

**Example Response**:

```http
HTTP/1.1 200
Content-Type: application/json

{
  "dashboard": {
    "id": 1,
    "uid": "cIBgcSjkk",
    "title": "Production Overview",
    "tags": [ "templated" ],
    "timezone": "browser",
    "schemaVersion": 16,
    "version": 0
  },
  "meta": {
    "isStarred": false,
    "url": "/d/cIBgcSjkk/production-overview",
    "slug": "production-overview" // deprecated in Grafana v5.0
  }
}
```

Status Codes:

- **200** – Found
- **401** – Unauthorized
- **403** – Access denied
- **404** – Not found

### Delete dashboard by slug
**Deprecated starting from Grafana v5.0. Please update to use the *Delete dashboard by uid* resource instead.**

`DELETE /api/dashboards/db/:slug`

Will delete the dashboard given the specified slug. Slug is the url friendly version of the dashboard title.

**Example Request**:

```http
DELETE /api/dashboards/db/test HTTP/1.1
Accept: application/json
Content-Type: application/json
Authorization: Bearer eyJrIjoiT0tTcG1pUlY2RnVKZTFVaDFsNFZXdE9ZWmNrMkZYbk
```

**Example Response**:

```http
HTTP/1.1 200
Content-Type: application/json

{"title": "Production Overview"}
```

Status Codes:

- **200** – Deleted
- **401** – Unauthorized
- **403** – Access denied
- **404** – Not found
- **412** – Precondition failed

The **412** status code is used when there exists multiple dashboards with the same slug.
The response body will look like this:

```http
HTTP/1.1 412 Precondition Failed
Content-Type: application/json; charset=UTF-8
Content-Length: 97

{
  "message": "Multiple dashboards with the same slug exists",
  "status": "multiple-slugs-exists"
}
```
