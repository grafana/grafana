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
    "title": "Production Overview",
    "tags": [ "templated" ],
    "timezone": "browser",
    "rows": [
      {
      }
    ],
    "schemaVersion": 6,
    "version": 0
  },
  "overwrite": false
}
```

JSON Body schema:

- **dashboard** – The complete dashboard model, id = null to create a new dashboard
- **overwrite** – Set to true if you want to overwrite existing dashboard with newer version or with same dashboard title.
- **message** - Set a commit message for the version history.

**Example Response**:

```http
HTTP/1.1 200 OK
Content-Type: application/json; charset=UTF-8
Content-Length: 78

{
  "slug": "production-overview",
  "status": "success",
  "version": 1
}
```

Status Codes:

- **200** – Created
- **400** – Errors (invalid json, missing or invalid fields, etc)
- **401** – Unauthorized
- **412** – Precondition failed

The **412** status code is used when a newer dashboard already exists (newer, its version is greater than the version that was sent). The
same status code is also used if another dashboard exists with the same title. The response body will look like this:

```http
HTTP/1.1 412 Precondition Failed
Content-Type: application/json; charset=UTF-8
Content-Length: 97

{
  "message": "The dashboard has been changed by someone else",
  "status": "version-mismatch"
}
```

In in case of title already exists the `status` property will be `name-exists`.

## Get dashboard

`GET /api/dashboards/db/:slug`

Will return the dashboard given the dashboard slug. Slug is the url friendly version of the dashboard title.

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
  "meta": {
    "isStarred": false,
    "slug": "production-overview"
  },
  "dashboard": {
    "id": null,
    "title": "Production Overview",
    "tags": [ "templated" ],
    "timezone": "browser",
    "rows": [
      {
      }
    ],
    "schemaVersion": 6,
    "version": 0
  }
}
```

## Delete dashboard

`DELETE /api/dashboards/db/:slug`

The above will delete the dashboard with the specified slug. The slug is the url friendly (unique) version of the dashboard title.

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

{"title": "Test"}
```

## Gets the home dashboard

`GET /api/dashboards/home`

Will return the home dashboard.

**Example Request**:

    GET /api/dashboards/home HTTP/1.1
    Accept: application/json
    Content-Type: application/json
    Authorization: Bearer eyJrIjoiT0tTcG1pUlY2RnVKZTFVaDFsNFZXdE9ZWmNrMkZYbk

**Example Response**:

    HTTP/1.1 200
    Content-Type: application/json

    {
      "meta":	{
        "isHome":true,
        "canSave":false,
        "canEdit":false,
        "canStar":false,
        "slug":"",
        "expires":"0001-01-01T00:00:00Z",
        "created":"0001-01-01T00:00:00Z"
      },
      "dashboard": {
        "editable":false,
        "hideControls":true,
        "nav":[
        {
          "enable":false,
        "type":"timepicker"
        }
        ],
        "rows": [
          {

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
      }
    }

## Tags for Dashboard


`GET /api/dashboards/tags`

Get all tags of dashboards

**Example Request**:

    GET /api/dashboards/tags HTTP/1.1
    Accept: application/json
    Content-Type: application/json
    Authorization: Bearer eyJrIjoiT0tTcG1pUlY2RnVKZTFVaDFsNFZXdE9ZWmNrMkZYbk

**Example Response**:

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

## Search Dashboards

`GET /api/search/`

Query parameters:

- **query** – Search Query
- **tag** – Tag to use
- **starred** – Flag indicating if only starred Dashboards should be returned
- **tagcloud** - Flag indicating if a tagcloud should be returned

**Example Request**:

    GET /api/search?query=MyDashboard&starred=true&tag=prod HTTP/1.1
    Accept: application/json
    Content-Type: application/json
    Authorization: Bearer eyJrIjoiT0tTcG1pUlY2RnVKZTFVaDFsNFZXdE9ZWmNrMkZYbk

**Example Response**:

    HTTP/1.1 200
    Content-Type: application/json

    [
      {
        "id":1,
        "title":"Production Overview",
        "uri":"db/production-overview",
        "type":"dash-db",
        "tags":[],
        "isStarred":false
      }
    ]
