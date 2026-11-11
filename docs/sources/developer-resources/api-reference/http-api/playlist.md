---
aliases:
  - ../../../http_api/playlist/ # /docs/grafana/next/http_api/playlist/
  - ../../../developers/http_api/playlist/ # /docs/grafana/next/developers/http_api/playlist/
canonical: https://grafana.com/docs/grafana/latest/developer-resources/api-reference/http-api/playlist/
description: Playlist Admin HTTP API
keywords:
  - grafana
  - http
  - documentation
  - api
  - playlist
labels:
  products:
    - enterprise
    - oss
    - cloud
title: 'Playlist HTTP API '
weight: 100
---

# Playlist API

{{< admonition type="note" >}}
Available in Grafana 12.4 and later.

This API complies with the new Grafana API structure. To learn more refer to documentation about the [API structure in Grafana](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/developer-resources/api-reference/http-api/apis/).

**This document may not contain the latest version of the API. For the most up-to-date list of available endpoints, refer to [playlist.grafana.app/v1](https://play.grafana.org/swagger?api=playlist.grafana.app-v1) in Swagger.**

{{< /admonition >}}

## Endpoints

These are the available endpoints:

| Method | Summary                                 | URI                                                                     |
| ------ | --------------------------------------- | ----------------------------------------------------------------------- |
| GET    | [List Playlists](#list-playlists)       | `/apis/playlist.grafana.app/v1/namespaces/{namespace}/playlists`        |
| GET    | [Get a Playlist](#get-a-playlist)       | `/apis/playlist.grafana.app/v1/namespaces/{namespace}/playlists/{name}` |
| POST   | [Create a Playlist](#create-a-playlist) | `/apis/playlist.grafana.app/v1/namespaces/{namespace}/playlists`        |
| PUT    | [Update a Playlist](#update-a-playlist) | `/apis/playlist.grafana.app/v1/namespaces/{namespace}/playlists/{name}` |
| DELETE | [Delete a Playlist](#delete-a-playlist) | `/apis/playlist.grafana.app/v1/namespaces/{namespace}/playlists/{name}` |

## List Playlists

`GET /apis/playlist.grafana.app/v1/namespaces/{namespace}/playlists`

Lists all playlists in the specified namespace.

**Path parameters**:

- `{namespace}`: To learn more about which namespace to use, refer to the [API overview](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/developer-resources/api-reference/http-api/apis/).

### Example request

The following example shows a request to list playlists:

```http
GET /apis/playlist.grafana.app/v1/namespaces/default/playlists HTTP/1.1
Accept: application/json
Authorization: Bearer <SERVICE_ACCOUNT_TOKEN>
```

### Example response

The following example shows the response:

```http
HTTP/1.1 200
Content-Type: application/json

{
  "kind": "PlaylistList",
  "apiVersion": "playlist.grafana.app/v1",
  "metadata": {},
  "items": [
    {
      "kind": "Playlist",
      "apiVersion": "playlist.grafana.app/v1",
      "metadata": {
        "name": "my-playlist-uid",
        "namespace": "default",
        "resourceVersion": "1234567890",
        "creationTimestamp": "2024-01-15T10:30:00Z"
      },
      "spec": {
        "title": "My Playlist",
        "interval": "5m",
        "items": [
          {
            "type": "dashboard_by_uid",
            "value": "dashboard-uid-1"
          },
          {
            "type": "dashboard_by_tag",
            "value": "important"
          }
        ]
      }
    }
  ]
}
```

### Status codes

- **200:** OK
- **401:** Unauthorized
- **403:** Access denied

## Get a Playlist

`GET /apis/playlist.grafana.app/v1/namespaces/{namespace}/playlists/{name}`

Retrieves a specific playlist by name.

**Path parameters**:

- `{namespace}`: To learn more about which namespace to use, refer to the [API overview](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/developer-resources/api-reference/http-api/apis/).
- `{name}`: The UID of the playlist.

### Example request

The following example shows a request to get a playlist:

```http
GET /apis/playlist.grafana.app/v1/namespaces/default/playlists/my-playlist-uid HTTP/1.1
Accept: application/json
Authorization: Bearer <SERVICE_ACCOUNT_TOKEN>
```

### Example response

The following example shows the response:

```http
HTTP/1.1 200
Content-Type: application/json

{
  "kind": "Playlist",
  "apiVersion": "playlist.grafana.app/v1",
  "metadata": {
    "name": "my-playlist-uid",
    "namespace": "default",
    "resourceVersion": "1234567890",
    "creationTimestamp": "2024-01-15T10:30:00Z"
  },
  "spec": {
    "title": "My Playlist",
    "interval": "5m",
    "items": [
      {
        "type": "dashboard_by_uid",
        "value": "dashboard-uid-1"
      },
      {
        "type": "dashboard_by_tag",
        "value": "important"
      }
    ]
  }
}
```

### Status codes

- **200:** Found
- **401:** Unauthorized
- **403:** Access denied
- **404:** Playlist not found

## Create a Playlist

`POST /apis/playlist.grafana.app/v1/namespaces/{namespace}/playlists`

Creates a new playlist.

**Path parameters**:

- `{namespace}`: To learn more about which namespace to use, refer to the [API overview](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/developer-resources/api-reference/http-api/apis/).

### Example request

The following example shows a request to create a playlist:

```http
POST /apis/playlist.grafana.app/v1/namespaces/default/playlists HTTP/1.1
Accept: application/json
Content-Type: application/json
Authorization: Bearer <SERVICE_ACCOUNT_TOKEN>

{
  "kind": "Playlist",
  "apiVersion": "playlist.grafana.app/v1",
  "metadata": {
    "name": "my-new-playlist-uid"
  },
  "spec": {
    "title": "My New Playlist",
    "interval": "5m",
    "items": [
      {
        "type": "dashboard_by_uid",
        "value": "dashboard-uid-1"
      },
      {
        "type": "dashboard_by_tag",
        "value": "monitoring"
      }
    ]
  }
}
```

### Example response

The following example shows the response:

```http
HTTP/1.1 201 Created
Content-Type: application/json

{
  "kind": "Playlist",
  "apiVersion": "playlist.grafana.app/v1",
  "metadata": {
    "name": "my-new-playlist-uid",
    "namespace": "default",
    "resourceVersion": "1234567891",
    "creationTimestamp": "2024-01-15T10:35:00Z"
  },
  "spec": {
    "title": "My New Playlist",
    "interval": "5m",
    "items": [
      {
        "type": "dashboard_by_uid",
        "value": "dashboard-uid-1"
      },
      {
        "type": "dashboard_by_tag",
        "value": "monitoring"
      }
    ]
  }
}
```

### Status codes

- **201:** Created
- **400:** Errors (invalid JSON)
- **401:** Unauthorized
- **403:** Access denied
- **409:** Conflict (a playlist with the same name already exists)

## Update a Playlist

`PUT /apis/playlist.grafana.app/v1/namespaces/{namespace}/playlists/{name}`

Updates an existing playlist. The entire playlist spec must be provided.

**Path parameters**:

- `{namespace}`: To learn more about which namespace to use, refer to the [API overview](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/developer-resources/api-reference/http-api/apis/).
- `{name}`: The UID of the playlist.

### Example request

The following example shows a request to update a playlist:

```http
PUT /apis/playlist.grafana.app/v1/namespaces/default/playlists/my-playlist-uid HTTP/1.1
Accept: application/json
Content-Type: application/json
Authorization: Bearer <SERVICE_ACCOUNT_TOKEN>

{
  "kind": "Playlist",
  "apiVersion": "playlist.grafana.app/v1",
  "metadata": {
    "name": "my-playlist-uid",
    "namespace": "default",
    "resourceVersion": "1234567890"
  },
  "spec": {
    "title": "My Updated Playlist",
    "interval": "10m",
    "items": [
      {
        "type": "dashboard_by_uid",
        "value": "dashboard-uid-1"
      },
      {
        "type": "dashboard_by_uid",
        "value": "dashboard-uid-2"
      },
      {
        "type": "dashboard_by_tag",
        "value": "updated-tag"
      }
    ]
  }
}
```

### Example response

The following example shows the response:

```http
HTTP/1.1 200 OK
Content-Type: application/json

{
  "kind": "Playlist",
  "apiVersion": "playlist.grafana.app/v1",
  "metadata": {
    "name": "my-playlist-uid",
    "namespace": "default",
    "resourceVersion": "1234567892",
    "creationTimestamp": "2024-01-15T10:30:00Z"
  },
  "spec": {
    "title": "My Updated Playlist",
    "interval": "10m",
    "items": [
      {
        "type": "dashboard_by_uid",
        "value": "dashboard-uid-1"
      },
      {
        "type": "dashboard_by_uid",
        "value": "dashboard-uid-2"
      },
      {
        "type": "dashboard_by_tag",
        "value": "updated-tag"
      }
    ]
  }
}
```

### Status codes

- **200:** Updated
- **400:** Errors (invalid JSON)
- **401:** Unauthorized
- **403:** Access denied
- **404:** Playlist not found
- **409:** Conflict (the playlist changed since you read it)

## Delete a Playlist

`DELETE /apis/playlist.grafana.app/v1/namespaces/{namespace}/playlists/{name}`

Deletes a playlist.

**Path parameters**:

- `{namespace}`: To learn more about which namespace to use, refer to the [API overview](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/developer-resources/api-reference/http-api/apis/).
- `{name}`: The UID of the playlist.

### Example request

The following example shows a request to delete a playlist:

```http
DELETE /apis/playlist.grafana.app/v1/namespaces/default/playlists/my-playlist-uid HTTP/1.1
Accept: application/json
Authorization: Bearer <SERVICE_ACCOUNT_TOKEN>
```

### Example response

The following example shows the response:

```http
HTTP/1.1 200 OK
Content-Type: application/json

{
  "kind": "Status",
  "apiVersion": "v1",
  "metadata": {},
  "status": "Success",
  "code": 200
}
```

### Status codes

- **200:** Deleted
- **401:** Unauthorized
- **403:** Access denied
- **404:** Playlist not found

## Playlist Item Types

Playlist items support three types:

- `dashboard_by_uid`: Include a specific dashboard by its UID
- `dashboard_by_tag`: Include all dashboards with a specific tag
- `dashboard_by_id`: (Deprecated) Include a dashboard by internal ID
