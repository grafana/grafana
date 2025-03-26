---
aliases:
  - ../../http_api/folder_dashboard_search/
canonical: /docs/grafana/latest/developers/http_api/folder_dashboard_search/
description: Grafana Folder/Dashboard Search HTTP API
keywords:
  - grafana
  - http
  - documentation
  - api
  - search
  - folder
  - dashboard
labels:
  products:
    - enterprise
    - oss
title: Folder/Dashboard Search HTTP API
---

# Folder/Dashboard Search API

## Search folders and dashboards

`GET /api/search/`

> Note: When using [Role-based access control](/docs/grafana/latest/administration/roles-and-permissions/access-control/), search results will contain only dashboards and folders which you have access to.

Query parameters:

- **query** – Search Query
- **tag** – List of tags to search for
- **type** – Type to search for, `dash-folder` or `dash-db`
- **dashboardIds** – List of dashboard id's to search for
- **dashboardUID** - List of dashboard uid's to search for, It is deprecated since Grafana v9.1, please use dashboardUIDs instead
- **dashboardUIDs** – List of dashboard uid's to search for
- **folderUIDs** – List of folder UIDs to search in
- **starred** – Flag indicating if only starred Dashboards should be returned
- **limit** – Limit the number of returned results (max is 5000; default is 1000)
- **page** – Use this parameter to access hits beyond limit. Numbering starts at 1. limit param acts as page size.

**Example request for retrieving folders and dashboards at the root level**:

```http
GET /api/search?query=&starred=false HTTP/1.1
Accept: application/json
Content-Type: application/json
Authorization: Bearer eyJrIjoiT0tTcG1pUlY2RnVKZTFVaDFsNFZXdE9ZWmNrMkZYbk
```

**Example response for retrieving folders and dashboards at the root level**:

```http
HTTP/1.1 200
Content-Type: application/json

[
  {
    "id": 163,
    "uid": "000000163",
    "orgId": 1,
    "title": "Folder",
    "url": "/dashboards/f/000000163/folder",
    "type": "dash-folder",
    "tags": [],
    "isStarred": false,
    "uri":"db/folder" // deprecated in Grafana v5.0
  },
  {
    "id":1,
    "uid": "cIBgcSjkk",
    "orgId": 1,
    "title":"Production Overview",
    "url": "/d/cIBgcSjkk/production-overview",
    "type":"dash-db",
    "tags":[prod],
    "isStarred":true,
    "uri":"db/production-overview" // deprecated in Grafana v5.0
  }
]
```

**Example request searching for dashboards**:

```http
GET /api/search?query=Production%20Overview&starred=true&tag=prod HTTP/1.1
Accept: application/json
Content-Type: application/json
Authorization: Bearer eyJrIjoiT0tTcG1pUlY2RnVKZTFVaDFsNFZXdE9ZWmNrMkZYbk
```

**Example response searching for dashboards**:

```http
HTTP/1.1 200
Content-Type: application/json

[
  {
    "id":1,
    "uid": "cIBgcSjkk",
    "orgId": 1,
    "title":"Production Overview",
    "url": "/d/cIBgcSjkk/production-overview",
    "type":"dash-db",
    "tags":[prod],
    "isStarred":true,
    "folderId": 2,
    "folderUid": "000000163",
    "folderTitle": "Folder",
    "folderUrl": "/dashboards/f/000000163/folder",
    "uri":"db/production-overview" // deprecated in Grafana v5.0
  }
]
```
