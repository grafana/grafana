---
aliases:
  - ../../http_api/snapshot/
canonical: /docs/grafana/latest/developers/http_api/snapshot/
description: Grafana HTTP API
keywords:
  - grafana
  - http
  - documentation
  - api
  - snapshot
labels:
  products:
    - enterprise
    - oss
title: 'Snapshot API'
---

# Snapshot API

## Create new snapshot

`POST /api/snapshots`

**Example Request**:

```http
    POST /api/snapshots HTTP/1.1
    Accept: application/json
    Content-Type: application/json
    Authorization: Bearer eyJrIjoiT0tTcG1pUlY2RnVKZTFVaDFsNFZXdE9ZWmNrMkZYbk

    {
      "dashboard": {
        "editable":false,
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
        },
      "expires": 3600
    }
```

JSON Body schema:

- **dashboard** – Required. The complete dashboard model.
- **name** – Optional. snapshot name
- **expires** - Optional. When the snapshot should expire in seconds. 3600 is 1 hour, 86400 is 1 day. Default is never to expire.
- **external** - Optional. Save the snapshot on an external server rather than locally. Default is `false`.
- **key** - Optional. Define the unique key. Required if **external** is `true`.
- **deleteKey** - Optional. Unique key used to delete the snapshot. It is different from the **key** so that only the creator can delete the snapshot. Required if **external** is `true`.

{{< admonition type="note" >}}
When creating a snapshot using the API, you have to provide the full dashboard payload including the snapshot data. This endpoint is designed for the Grafana UI.
{{< /admonition >}}

**Example Response**:

```http
    HTTP/1.1 200
    Content-Type: application/json
    {
      "deleteKey":"XXXXXXX",
      "deleteUrl":"myurl/api/snapshots-delete/XXXXXXX",
      "key":"YYYYYYY",
      "url":"myurl/dashboard/snapshot/YYYYYYY",
      "id": 1
    }
```

Keys:

- **deleteKey** – Key generated to delete the snapshot
- **key** – Key generated to share the dashboard

## Get list of Snapshots

`GET /api/dashboard/snapshots`

Query parameters:

- **query** – Search Query
- **limit** – Limit the number of returned results

**Example Request**:

```http
GET /api/dashboard/snapshots HTTP/1.1
Accept: application/json
Authorization: Bearer eyJrIjoiT0tTcG1pUlY2RnVKZTFVaDFsNFZXdE9ZWmNrMkZYbk
```

**Example Response**:

```http
HTTP/1.1 200
Content-Type: application/json

[
  {
    "id":8,
    "name":"Home",
    "key":"YYYYYYY",
    "orgId":1,
    "userId":1,
    "external":false,
    "externalUrl":"",
    "expires":"2200-13-32T25:23:23+02:00",
    "created":"2200-13-32T28:24:23+02:00",
    "updated":"2200-13-32T28:24:23+02:00"
  }
]
```

## Get Snapshot by Key

`GET /api/snapshots/:key`

**Example Request**:

```http
GET /api/snapshots/YYYYYYY HTTP/1.1
Accept: application/json
Authorization: Bearer eyJrIjoiT0tTcG1pUlY2RnVKZTFVaDFsNFZXdE9ZWmNrMkZYbk
```

**Example Response**:

```http
HTTP/1.1 200
Content-Type: application/json

{
  "meta":{
    "isSnapshot":true,
    "type":"snapshot",
    "canSave":false,
    "canEdit":false,
    "canStar":false,
    "slug":"",
    "expires":"2200-13-32T25:23:23+02:00",
    "created":"2200-13-32T28:24:23+02:00"
  },
  "dashboard": {
    "editable":false,
    "nav": [
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
```

## Delete Snapshot by Key

`DELETE /api/snapshots/:key`

**Example Request**:

```http
DELETE /api/snapshots/YYYYYYY HTTP/1.1
Accept: application/json
Authorization: Bearer eyJrIjoiT0tTcG1pUlY2RnVKZTFVaDFsNFZXdE9ZWmNrMkZYbk
```

**Example Response**:

```http
HTTP/1.1 200
Content-Type: application/json

{"message":"Snapshot deleted. It might take an hour before it's cleared from any CDN caches.", "id": 1}
```

## Delete Snapshot by deleteKey

This API call can be used without authentication by using the secret delete key for the snapshot.

`GET /api/snapshots-delete/:deleteKey`

**Example Request**:

```http
GET /api/snapshots-delete/XXXXXXX HTTP/1.1
Accept: application/json
```

**Example Response**:

```http
HTTP/1.1 200
Content-Type: application/json

{"message":"Snapshot deleted. It might take an hour before it's cleared from any CDN caches.", "id": 1}
```
