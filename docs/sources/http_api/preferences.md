+++
title = "HTTP Preferences API "
description = "Grafana HTTP API"
keywords = ["grafana", "http", "documentation", "api", "preferences"]
aliases = ["/http_api/preferences/"]
type = "docs"
[menu.docs]
name = "Preferences"
parent = "http_api"
+++

# User and Org Preferences API

Keys:

- **theme** - One of: ``light``, ``dark``, or an empty string for the default theme
- **homeDashboardId** - The numerical ``:id`` of a favorited dashboard, default: ``0``
- **timezone** - One of: ``utc``, ``browser``, or an empty string for the default

Omitting a key will cause the current value to be replaced with the
system default value.

## Get Current User Prefs

`GET /api/user/preferences`

**Example Request**:

```http
GET /api/user/preferences HTTP/1.1
Accept: application/json
Content-Type: application/json
Authorization: Bearer eyJrIjoiT0tTcG1pUlY2RnVKZTFVaDFsNFZXdE9ZWmNrMkZYbk
```

**Example Response**:

```http
HTTP/1.1 200
Content-Type: application/json

{"theme":"","homeDashboardId":0,"timezone":""}
```

## Update Current User Prefs

`PUT /api/user/preferences`

**Example Request**:

```http
PUT /api/user/preferences HTTP/1.1
Accept: application/json
Content-Type: application/json
Authorization: Bearer eyJrIjoiT0tTcG1pUlY2RnVKZTFVaDFsNFZXdE9ZWmNrMkZYbk

{
  "theme": "",
  "homeDashboardId":0,
  "timezone":"utc"
}
```

**Example Response**:

```http
HTTP/1.1 200
Content-Type: text/plain; charset=utf-8

{"message":"Preferences updated"}
```

## Get Current Org Prefs

`GET /api/org/preferences`

**Example Request**:

```http
GET /api/org/preferences HTTP/1.1
Accept: application/json
Content-Type: application/json
Authorization: Bearer eyJrIjoiT0tTcG1pUlY2RnVKZTFVaDFsNFZXdE9ZWmNrMkZYbk
```

**Example Response**:

```http
HTTP/1.1 200
Content-Type: application/json

{"theme":"","homeDashboardId":0,"timezone":""}
```

## Update Current Org Prefs

`PUT /api/org/preferences`

**Example Request**:

```http
PUT /api/org/preferences HTTP/1.1
Accept: application/json
Content-Type: application/json
Authorization: Bearer eyJrIjoiT0tTcG1pUlY2RnVKZTFVaDFsNFZXdE9ZWmNrMkZYbk

{
  "theme": "",
  "homeDashboardId":0,
  "timezone":"utc"
}
```

**Example Response**:

```http
HTTP/1.1 200
Content-Type: text/plain; charset=utf-8

{"message":"Preferences updated"}
```