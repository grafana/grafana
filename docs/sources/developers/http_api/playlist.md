---
aliases:
  - ../../http_api/playlist/
canonical: /docs/grafana/latest/developers/http_api/playlist/
description: Playlist Admin HTTP API
keywords:
  - grafana
  - http
  - documentation
  - api
  - playlist
title: 'Playlist HTTP API '
---

# Playlist API

## Search Playlist

`GET /api/playlists`

Get all existing playlist for the current organization using pagination

**Example Request**:

```http
GET /api/playlists HTTP/1.1
Accept: application/json
Authorization: Bearer eyJrIjoiT0tTcG1pUlY2RnVKZTFVaDFsNFZXdE9ZWmNrMkZYbk
```

Querystring Parameters:

These parameters are used as querystring parameters.

- **query** - Limit response to playlist having a name like this value.
- **limit** - Limit response to _X_ number of playlist.

**Example Response**:

```http
HTTP/1.1 200
Content-Type: application/json
[
  {
    "uid": "1",
    "name": "my playlist",
    "interval": "5m"
  }
]
```

## Get one playlist

`GET /api/playlists/:uid`

**Example Request**:

```http
GET /api/playlists/1 HTTP/1.1
Accept: application/json
Authorization: Bearer eyJrIjoiT0tTcG1pUlY2RnVKZTFVaDFsNFZXdE9ZWmNrMkZYbk
```

**Example Response**:

```http
HTTP/1.1 200
Content-Type: application/json
{
  "uid" : "1",
  "name": "my playlist",
  "interval": "5m",
  "items": [
    {
      "id": 1,
      "playlistUid": "1",
      "type": "dashboard_by_id",
      "value": "3",
      "order": 1,
      "title":"my third dashboard"
    },
    {
      "id": 2,
      "playlistUid": "1",
      "type": "dashboard_by_tag",
      "value": "myTag",
      "order": 2,
      "title":"my other dashboard"
    }
  ]
}
```

## Get Playlist items

`GET /api/playlists/:uid/items`

**Example Request**:

```http
GET /api/playlists/1/items HTTP/1.1
Accept: application/json
Authorization: Bearer eyJrIjoiT0tTcG1pUlY2RnVKZTFVaDFsNFZXdE9ZWmNrMkZYbk
```

**Example Response**:

```http
HTTP/1.1 200
Content-Type: application/json
[
  {
    "id": 1,
    "playlistUid": "1",
    "type": "dashboard_by_id",
    "value": "3",
    "order": 1,
    "title":"my third dashboard"
  },
  {
    "id": 2,
    "playlistUid": "1",
    "type": "dashboard_by_tag",
    "value": "myTag",
    "order": 2,
    "title":"my other dashboard"
  }
]
```

## Get Playlist dashboards

`GET /api/playlists/:uid/dashboards`

**Example Request**:

```http
GET /api/playlists/1/dashboards HTTP/1.1
Accept: application/json
Authorization: Bearer eyJrIjoiT0tTcG1pUlY2RnVKZTFVaDFsNFZXdE9ZWmNrMkZYbk
```

**Example Response**:

```http
HTTP/1.1 200
Content-Type: application/json
[
  {
    "id": 3,
    "title": "my third dashboard",
    "order": 1,
  },
  {
    "id": 5,
    "title":"my other dashboard"
    "order": 2,

  }
]
```

## Create a playlist

`POST /api/playlists/`

**Example Request**:

```http
PUT /api/playlists/1 HTTP/1.1
Accept: application/json
Content-Type: application/json
Authorization: Bearer eyJrIjoiT0tTcG1pUlY2RnVKZTFVaDFsNFZXdE9ZWmNrMkZYbk
  {
    "name": "my playlist",
    "interval": "5m",
    "items": [
      {
        "type": "dashboard_by_id",
        "value": "3",
        "order": 1,
        "title":"my third dashboard"
      },
      {
        "type": "dashboard_by_tag",
        "value": "myTag",
        "order": 2,
        "title":"my other dashboard"
      }
    ]
  }
```

**Example Response**:

```http
HTTP/1.1 200
Content-Type: application/json
  {
    "uid": "1",
    "name": "my playlist",
    "interval": "5m"
  }
```

## Update a playlist

`PUT /api/playlists/:uid`

**Example Request**:

```http
PUT /api/playlists/1 HTTP/1.1
Accept: application/json
Content-Type: application/json
Authorization: Bearer eyJrIjoiT0tTcG1pUlY2RnVKZTFVaDFsNFZXdE9ZWmNrMkZYbk
  {
    "name": "my playlist",
    "interval": "5m",
    "items": [
      {
        "playlistUid": "1",
        "type": "dashboard_by_id",
        "value": "3",
        "order": 1,
        "title":"my third dashboard"
      },
      {
        "playlistUid": "1",
        "type": "dashboard_by_tag",
        "value": "myTag",
        "order": 2,
        "title":"my other dashboard"
      }
    ]
  }
```

**Example Response**:

```http
HTTP/1.1 200
Content-Type: application/json
{
  "uid" : "1",
  "name": "my playlist",
  "interval": "5m",
  "items": [
    {
      "id": 1,
      "playlistUid": "1",
      "type": "dashboard_by_id",
      "value": "3",
      "order": 1,
      "title":"my third dashboard"
    },
    {
      "id": 2,
      "playlistUid": "1",
      "type": "dashboard_by_tag",
      "value": "myTag",
      "order": 2,
      "title":"my other dashboard"
    }
  ]
}
```

## Delete a playlist

`DELETE /api/playlists/:uid`

**Example Request**:

```http
DELETE /api/playlists/1 HTTP/1.1
Accept: application/json
Authorization: Bearer eyJrIjoiT0tTcG1pUlY2RnVKZTFVaDFsNFZXdE9ZWmNrMkZYbk
```

**Example Response**:

```http
HTTP/1.1 200
Content-Type: application/json
{}
```
