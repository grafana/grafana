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

## Requirements

By default, users with the Viewer role can read playlists, and users with the Editor or Admin role can also create, update, and delete them. Users with the None role can also read playlists. If the `playlistsRBAC` feature toggle is turned on, access uses the `playlists:read` and `playlists:write` actions instead. For the related fixed roles, refer to [RBAC role definitions](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/administration/roles-and-permissions/access-control/rbac-fixed-basic-role-definitions/). For more information about the default access, refer to [Organization roles](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/administration/roles-and-permissions/#organization-roles).

## Endpoints

These are the available endpoints:

**Base path:** `/apis/playlist.grafana.app/v1/namespaces/{namespace}/`

Replace `{namespace}` with your namespace. To learn which namespace to use, refer to the [API overview](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/developer-resources/api-reference/http-api/apis/).

| Method | Summary                                 | Path               |
| ------ | --------------------------------------- | ------------------ |
| GET    | [List Playlists](#list-playlists)       | `playlists`        |
| GET    | [Get a Playlist](#get-a-playlist)       | `playlists/{name}` |
| POST   | [Create a Playlist](#create-a-playlist) | `playlists`        |
| PUT    | [Update a Playlist](#update-a-playlist) | `playlists/{name}` |
| DELETE | [Delete a Playlist](#delete-a-playlist) | `playlists/{name}` |

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

## Update a Playlist

`PUT /apis/playlist.grafana.app/v1/namespaces/{namespace}/playlists/{name}`

Updates an existing playlist. Provide the entire playlist, including `metadata.resourceVersion` from the latest version you read.

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

## Playlist Item Types

Playlist items support three types:

- `dashboard_by_uid`: Include a specific dashboard by its UID
- `dashboard_by_tag`: Include all dashboards with a specific tag
- `dashboard_by_id`: (Deprecated) Include a dashboard by internal ID

## Status codes

The endpoints on this page return the following status codes:

| Code  | Meaning                                                                      | Returned by                                                                                                 |
| ----- | ---------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| `200` | OK.                                                                          | [List](#list-playlists), [Get](#get-a-playlist), [Update](#update-a-playlist), [Delete](#delete-a-playlist) |
| `201` | Created.                                                                     | [Create](#create-a-playlist)                                                                                |
| `400` | Bad request (invalid JSON).                                                  | [Create](#create-a-playlist), [Update](#update-a-playlist)                                                  |
| `401` | Unauthorized.                                                                | All endpoints                                                                                               |
| `403` | Access denied.                                                               | All endpoints                                                                                               |
| `404` | Playlist not found.                                                          | [Get](#get-a-playlist), [Update](#update-a-playlist), [Delete](#delete-a-playlist)                          |
| `409` | Conflict (a playlist with the same `metadata.name` already exists).          | [Create](#create-a-playlist)                                                                                |
| `409` | Conflict (the playlist changed since you read it).                           | [Update](#update-a-playlist)                                                                                |
| `422` | Invalid playlist, for example because `metadata.resourceVersion` is missing. | [Update](#update-a-playlist)                                                                                |
