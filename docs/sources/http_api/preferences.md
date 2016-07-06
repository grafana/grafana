----
page_title: Preferences API
page_description: Grafana Preferences API Reference
page_keywords: grafana, preferences, http, api, documentation
---

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

    GET /api/user/preferences HTTP/1.1
    Accept: application/json
    Content-Type: application/json
    Authorization: Bearer eyJrIjoiT0tTcG1pUlY2RnVKZTFVaDFsNFZXdE9ZWmNrMkZYbk

**Example Response**:

    HTTP/1.1 200
    Content-Type: application/json

    {"theme":"","homeDashboardId":0,"timezone":""}

## Update Current User Prefs

`PUT /api/user/preferences`

**Example Request**:

    PUT /api/user/preferences HTTP/1.1
    Accept: application/json
    Content-Type: application/json
    Authorization: Bearer eyJrIjoiT0tTcG1pUlY2RnVKZTFVaDFsNFZXdE9ZWmNrMkZYbk

    {
      "theme": "",
      "homeDashboardId":0,
      "timezone":"utc"
    }

**Example Response**:

    HTTP/1.1 200
    Content-Type: text/plain; charset=utf-8

    {"message":"Preferences updated"}

## Get Current Org Prefs

`GET /api/org/preferences`

**Example Request**:

    GET /api/org/preferences HTTP/1.1
    Accept: application/json
    Content-Type: application/json
    Authorization: Bearer eyJrIjoiT0tTcG1pUlY2RnVKZTFVaDFsNFZXdE9ZWmNrMkZYbk

**Example Response**:

    HTTP/1.1 200
    Content-Type: application/json

    {"theme":"","homeDashboardId":0,"timezone":""}

## Update Current Org Prefs

`PUT /api/org/preferences`

**Example Request**:

    PUT /api/org/preferences HTTP/1.1
    Accept: application/json
    Content-Type: application/json
    Authorization: Bearer eyJrIjoiT0tTcG1pUlY2RnVKZTFVaDFsNFZXdE9ZWmNrMkZYbk

    {
      "theme": "",
      "homeDashboardId":0,
      "timezone":"utc"
    }

**Example Response**:

    HTTP/1.1 200
    Content-Type: text/plain; charset=utf-8

    {"message":"Preferences updated"}
