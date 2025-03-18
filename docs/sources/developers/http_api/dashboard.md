---
aliases:
  - ../../http_api/dashboard/
canonical: /docs/grafana/latest/developers/http_api/dashboard/
description: Grafana Dashboard HTTP API
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
title: Dashboard HTTP API
---

# Dashboard API

> If you are running Grafana Enterprise, for some endpoints you'll need to have specific permissions. Refer to [Role-based access control permissions]({{< relref "/docs/grafana/latest/administration/roles-and-permissions/access-control/custom-role-actions-scopes" >}}) for more information.

## Identifier (id) vs unique identifier (uid)

The identifier (id) of a dashboard is an auto-incrementing numeric value and is only unique per Grafana install.

The unique identifier (uid) of a dashboard can be used for uniquely identify a dashboard between multiple Grafana installs.
It's automatically generated if not provided when creating a dashboard. The uid allows having consistent URLs for accessing
dashboards and when syncing dashboards between multiple Grafana installs, see [dashboard provisioning]({{< relref "/docs/grafana/latest/administration/provisioning#dashboards" >}})
for more information. This means that changing the title of a dashboard will not break any bookmarked links to that dashboard.

The uid can have a maximum length of 40 characters.

## Create / Update dashboard

`POST /api/dashboards/db`

Creates a new dashboard or updates an existing dashboard. When updating existing dashboards, if you do not define the `folderId` or the `folderUid` property, then the dashboard(s) are moved to the root level. (You need to define only one property, not both).

> **Note:** This endpoint is not intended for creating folders, use `POST /api/folders` for that.

**Required permissions**

See note in the [introduction]({{< ref "#dashboard-api" >}}) for an explanation.

<!-- prettier-ignore-start -->
| Action              | Scope                                                                                                   |
| ------------------- | ------------------------------------------------------------------------------------------------------- |
| `dashboards:create` | <ul><li>`folders:*`</li><li>`folders:uid:*`</li></ul>                                                   |
| `dashboards:write`  | <ul><li>`dashboards:*`</li><li>`dashboards:uid:*`</li><li>`folders:*`</li><li>`folders:uid:*`</li></ul> |
{ .no-spacing-list }
<!-- prettier-ignore-end -->

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
    "refresh": "25s"
  },
  "folderUid": "l3KqBxCMz",
  "message": "Made changes to xyz",
  "overwrite": false
}
```

JSON Body schema:

- **dashboard** – The complete dashboard model.
- **dashboard.id** – id = null to create a new dashboard.
- **dashboard.uid** – Optional unique identifier when creating a dashboard. uid = null will generate a new uid.
- **dashboard.refresh** - Set the dashboard refresh interval. If this is lower than [the minimum refresh interval]({{< relref "/docs/grafana/latest/setup-grafana/configure-grafana#min_refresh_interval" >}}), then Grafana will ignore it and will enforce the minimum refresh interval.
- **folderId** – The id of the folder to save the dashboard in.
- **folderUid** – The UID of the folder to save the dashboard in. Overrides the `folderId`.
- **overwrite** – Set to true if you want to overwrite an existing dashboard with a given dashboard UID.
- **message** - Set a commit message for the version history.

**Example Request for updating a dashboard**:

```http
POST /api/dashboards/db HTTP/1.1
Accept: application/json
Content-Type: application/json
Authorization: Bearer eyJrIjoiT0tTcG1pUlY2RnVKZTFVaDFsNFZXdE9ZWmNrMkZYbk

{
  "dashboard": {
    "id": 1,
    "title": "Production Overview Updated",
    "tags": [ "templated" ],
    "timezone": "browser",
    "schemaVersion": 16,
    "version": 1,
    "refresh": "25s"
  },
  "folderUid": "l3KqBxCMz",
  "message": "Made changes to xyz",
  "overwrite": false
}
```

**Example Response**:

```http
HTTP/1.1 200 OK
Content-Type: application/json; charset=UTF-8
Content-Length: 78

{
    "id": 1,
    "uid": "e883f11b-77c0-4ee3-9a70-3ba223d66e56",
    "url": "/d/e883f11b-77c0-4ee3-9a70-3ba223d66e56/production-overview-updated",
    "status": "success",
    "version": 2
    "slug": "production-overview-updated",
}
```

Status Codes:

- **200** – Created
- **400** – Errors (invalid json, missing or invalid fields, etc)
- **401** – Unauthorized
- **403** – Access denied
- **412** – Precondition failed

The **412** status code is used for explaining that you cannot create the dashboard and why.
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

Will return the dashboard given the dashboard unique identifier (uid). Information about the unique identifier of a folder containing the requested dashboard might be found in the metadata.

**Required permissions**

See note in the [introduction]({{< ref "#dashboard-api" >}}) for an explanation.

<!-- prettier-ignore-start -->
| Action            | Scope                                                                                                   |
| ----------------- | ------------------------------------------------------------------------------------------------------- |
| `dashboards:read` | <ul><li>`dashboards:*`</li><li>`dashboards:uid:*`</li><li>`folders:*`</li><li>`folders:uid:*`</li></ul> |
{ .no-spacing-list }
<!-- prettier-ignore-end -->

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
    "folderId": 2,
    "folderUid": "l3KqBxCMz",
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

**Required permissions**

See note in the [introduction]({{< ref "#dashboard-api" >}}) for an explanation.

<!-- prettier-ignore-start -->
| Action              | Scope                                                                                                   |
| ------------------- | ------------------------------------------------------------------------------------------------------- |
| `dashboards:delete` | <ul><li>`dashboards:*`</li><li>`dashboards:uid:*`</li><li>`folders:*`</li><li>`folders:uid:*`</li></ul> |
{ .no-spacing-list }
<!-- prettier-ignore-end -->

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

{
  "title": "Production Overview",
  "message": "Dashboard Production Overview deleted",
  "id": 2
}
```

Status Codes:

- **200** – Deleted
- **401** – Unauthorized
- **403** – Access denied
- **404** – Not found

## Hard delete dashboard by uid

{{% admonition type="note" %}}
This feature is currently in private preview and behind the `dashboardRestore` feature toggle.
{{% /admonition %}}

`DELETE /api/dashboards/uid/:uid/trash`

Will delete permanently the dashboard given the specified unique identifier (uid).

**Required permissions**

See note in the [introduction]({{< ref "#dashboard-api" >}}) for an explanation.

<!-- prettier-ignore-start -->
| Action              | Scope                                                                                                   |
| ------------------- | ------------------------------------------------------------------------------------------------------- |
| `dashboards:delete` | <ul><li>`dashboards:*`</li><li>`dashboards:uid:*`</li><li>`folders:*`</li><li>`folders:uid:*`</li></ul> |
{ .no-spacing-list }
<!-- prettier-ignore-end -->

**Example Request**:

```http
DELETE /api/dashboards/uid/cIBgcSjkk/trash HTTP/1.1
Accept: application/json
Content-Type: application/json
Authorization: Bearer eyJrIjoiT0tTcG1pUlY2RnVKZTFVaDFsNFZXdE9ZWmNrMkZYbk
```

**Example Response**:

```http
HTTP/1.1 200
Content-Type: application/json

{
  "title": "Production Overview",
  "message": "Dashboard Production Overview deleted",
  "uid": "cIBgcSjkk"
}
```

Status Codes:

- **200** – Deleted
- **401** – Unauthorized
- **403** – Access denied
- **404** – Not found

## Restore deleted dashboard by uid

{{% admonition type="note" %}}
This feature is currently in private preview and behind the `dashboardRestore` feature toggle.
{{% /admonition %}}

`PATCH /api/dashboards/uid/:uid/trash`

Will restore a deleted dashboard given the specified unique identifier (uid).

**Required permissions**

See note in the [introduction]({{< ref "#dashboard-api" >}}) for an explanation.

<!-- prettier-ignore-start -->
| Action              | Scope                                                 |
| ------------------- | ----------------------------------------------------- |
| `dashboards:create` | <ul><li>`folders:*`</li><li>`folders:uid:*`</li></ul> |
{ .no-spacing-list }
<!-- prettier-ignore-end -->

**Example Request**:

```http
PATCH /api/dashboards/uid/cIBgcSjkk/trash HTTP/1.1
Accept: application/json
Content-Type: application/json
Authorization: Bearer eyJrIjoiT0tTcG1pUlY2RnVKZTFVaDFsNFZXdE9ZWmNrMkZYbk
```

**Example Response**:

```http
HTTP/1.1 200
Content-Type: application/json

{
  "title": "Production Overview",
  "message": "Dashboard Production Overview restored",
  "uid": "cIBgcSjkk"
}
```

Status Codes:

- **200** – Deleted
- **401** – Unauthorized
- **403** – Access denied
- **404** – Not found
-

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

See [Folder/Dashboard Search API]({{< relref "folder_dashboard_search/" >}}).
