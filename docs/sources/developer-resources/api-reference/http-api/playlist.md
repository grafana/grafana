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
---

# Playlist API

To learn more about the API structure, refer to [API overview](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/developers/http_api/apis/).

## List Playlists

`GET /apis/playlist.grafana.app/v1/namespaces/:namespace/playlists`

Lists all playlists in the specified namespace.

- `namespace`: To learn more about which namespace to use, refer to the [API overview](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/developers/http_api/apis/).

**Example Request**:

```http
GET /apis/playlist.grafana.app/v1/namespaces/default/playlists HTTP/1.1
Accept: application/json
Authorization: Bearer eyJrIjoiT0tTcG1pUlY2RnVKZTFVaDFsNFZXdE9ZWmNrMkZYbk
```

**Example Response**:

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

`GET /apis/playlist.grafana.app/v1/namespaces/:namespace/playlists/:name`

Retrieves a specific playlist by name.

- `namespace`: To learn more about which namespace to use, refer to the [API overview](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/developers/http_api/apis/).
- `name`: The UID of the playlist.

**Example Request**:

```http
GET /apis/playlist.grafana.app/v1/namespaces/default/playlists/my-playlist-uid HTTP/1.1
Accept: application/json
Authorization: Bearer eyJrIjoiT0tTcG1pUlY2RnVKZTFVaDFsNFZXdE9ZWmNrMkZYbk
```

**Example Response**:

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

`POST /apis/playlist.grafana.app/v1/namespaces/:namespace/playlists`

Creates a new playlist.

- `namespace`: To learn more about which namespace to use, refer to the [API overview](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/developers/http_api/apis/).

**Example Request**:

```http
POST /apis/playlist.grafana.app/v1/namespaces/default/playlists HTTP/1.1
Accept: application/json
Content-Type: application/json
Authorization: Bearer eyJrIjoiT0tTcG1pUlY2RnVKZTFVaDFsNFZXdE9ZWmNrMkZYbk

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

**Example Response**:

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

`PUT /apis/playlist.grafana.app/v1/namespaces/:namespace/playlists/:name`

Updates an existing playlist. The entire playlist spec must be provided.

- `namespace`: To learn more about which namespace to use, refer to the [API overview](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/developers/http_api/apis/).
- `name`: The UID of the playlist.

**Example Request**:

```http
PUT /apis/playlist.grafana.app/v1/namespaces/default/playlists/my-playlist-uid HTTP/1.1
Accept: application/json
Content-Type: application/json
Authorization: Bearer eyJrIjoiT0tTcG1pUlY2RnVKZTFVaDFsNFZXdE9ZWmNrMkZYbk

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

**Example Response**:

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

`DELETE /apis/playlist.grafana.app/v1/namespaces/:namespace/playlists/:name`

Deletes a playlist.

- `namespace`: To learn more about which namespace to use, refer to the [API overview](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/developers/http_api/apis/).
- `name`: The UID of the playlist.

**Example Request**:

```http
DELETE /apis/playlist.grafana.app/v1/namespaces/default/playlists/my-playlist-uid HTTP/1.1
Accept: application/json
Authorization: Bearer eyJrIjoiT0tTcG1pUlY2RnVKZTFVaDFsNFZXdE9ZWmNrMkZYbk
```

**Example Response**:

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
