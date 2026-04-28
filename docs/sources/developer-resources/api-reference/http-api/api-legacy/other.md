---
aliases:
  - ../../../../http_api/other/ # /docs/grafana/<GRAFANA_VERSION>/http_api/other/
  - ../../../../developers/http_api/other/ # /docs/grafana/<GRAFANA_VERSION>/developers/http_api/other/
  - ../../../../developer-resources/api-reference/http-api/other/ #legacy folder
canonical: https://grafana.com/docs/grafana/latest/developer-resources/api-reference/http-api/api-legacy/other/
description: Grafana Other HTTP API
keywords:
  - grafana
  - http
  - documentation
  - api
  - other
labels:
  products:
    - enterprise
    - oss
title: 'Other HTTP API '
---

# Frontend Settings API

{{< docs/shared lookup="developers/deprecated-apis.md" source="grafana" version="<GRAFANA_VERSION>" >}}

## Get Settings

`GET /api/frontend/settings`

**Example Request**:

```http
GET /api/frontend/settings HTTP/1.1
Accept: application/json
Content-Type: application/json
Authorization: Bearer eyJrIjoiT0tTcG1pUlY2RnVKZTFVaDFsNFZXdE9ZWmNrMkZYbk
```

**Example Response**:

```http
HTTP/1.1 200
Content-Type: application/json

{
  "allowOrgCreate":true,
  "appSubUrl":"",
  "buildInfo":{
    "buildstamp":xxxxxx,
    "commit":"vyyyy",
    "version":"zzzzz"
  },
  "datasources":{
    "datasourcename":{
      "index":"grafana-dash",
      "meta":{
        "annotations":true,
        "module":"plugins/datasource/grafana/datasource",
        "name":"Grafana",
        "partials":{
          "annotations":"app/plugins/datasource/grafana/partials/annotations.editor.html",
          "config":"app/plugins/datasource/grafana/partials/config.html"
        },
        "pluginType":"datasource",
        "serviceName":"Grafana",
        "type":"grafanasearch"
      }
    }
  },
  "defaultDatasource": "Grafana"
}
```

# Login API

## Renew session based on remember cookie

`GET /api/login/ping`

**Example Request**:

```http
GET /api/login/ping HTTP/1.1
Accept: application/json
Content-Type: application/json
Authorization: Bearer eyJrIjoiT0tTcG1pUlY2RnVKZTFVaDFsNFZXdE9ZWmNrMkZYbk
```

**Example Response**:

```http
HTTP/1.1 200
Content-Type: application/json

{"message": "Logged in"}
```

# Health API

## Returns health information about Grafana

`GET /api/health`

**Example Request**

```http
GET /api/health
Accept: application/json
```

**Example Response**:

```http
HTTP/1.1 200 OK

{
  "commit": "087143285",
  "database": "ok",
  "version": "5.1.3"
}
```
