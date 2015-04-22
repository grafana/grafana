----
page_title: HTTP API
page_description: Grafana HTTP API Reference
page_keywords: grafana, admin, http, api, documentation
---

# HTTP API Reference

The Grafana backend exposes an HTTP API, the same API is used by the frontend to do everything from saving
dashboards, creating users and updating data sources.

## Authorization

Currently you can authenticate via an `API Token` or via a `Session cookie` (acquired using regular login or oauth).

### Create API Token

Open the sidemenu and click the organization dropdown and select the `API Keys` option.

![](/img/v2/orgdropdown_api_keys.png)

You use the token in all requests in the `Authorization` header, like this:

**Example**:

        GET http://your.grafana.com/api/dashboards/db/mydash HTTP/1.1
        Accept: application/json
        Authorization: Bearer eyJrIjoiT0tTcG1pUlY2RnVKZTFVaDFsNFZXdE9ZWmNrMkZYbk

The `Authorization` header value should be `Bearer <your api key>`.

## Dashboards

### Create or Update dashboard

`POST /api/dashboards/db`

Creates a new dashboard or updates an existing dashboard.

**Example Request for new dashboard**:

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
            ]
            "schemaVersion": 6,
            "version": 0
          },
          "overwrite": false
        }

JSON Body schema:

- **dashboard** – The complete dashboard model, id = null to create a new dashboard
- **overwrite** – Set to true if you want to overwrite existing dashboard with new version or with same dashboard title.

**Example Response**:

    HTTP/1.1 200 OK
    Content-Type: application/json; charset=UTF-8
    Date: Wed, 22 Apr 2015 11:12:06 GMT
    Content-Length: 78

    {
      "slug": "production-overview",
      "status": "success",
      "version": 1
    }

Status Codes:

- **200** – Created
- **400** – Errors (invalid json, missing or invalid fields, etc)
- **401** – Unauthorized
- **412** – Precondition failed

The **412** status code is used when a newer dashboard already exists (newer, its version is greater than the verison that was sent). The
same status code is also used if another dashboar exists with the same title. The response body will look like this:

    HTTP/1.1 412 Precondition Failed
    Content-Type: application/json; charset=UTF-8
    Content-Length: 97

    {
      "message": "The dashboard has been changed by someone else",
      "status": "version-mismatch"
    }

In in case of title already exists the `status` property will be `name-exists`.

### Get dashboard

`GET /api/dashboards/db/:slug`

Will return the dashboard given the dashboard slug. Slug is the url friendly version of the dashboard title.

**Example Request**:

        GET /api/dashboards/db/production-overview HTTP/1.1
        Accept: application/json
        Content-Type: application/json
        Authorization: Bearer eyJrIjoiT0tTcG1pUlY2RnVKZTFVaDFsNFZXdE9ZWmNrMkZYbk

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
            ]
            "schemaVersion": 6,
            "version": 0
          },
        }

## Data sources

## Organizations

## Users


