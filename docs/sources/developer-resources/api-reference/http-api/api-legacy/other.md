---
aliases:
  - ../../../http_api/other/ # /docs/grafana/next/http_api/other/
  - ../../../developers/http_api/other/ # /docs/grafana/next/developers/http_api/other/
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

{{< admonition type="caution" >}}

Starting in Grafana 13, `/api` endpoints are being deprecated. This change doesn't disrupt or break your current setup: legacy APIs are not being disabled and remain fully accessible and operative. However, `/api` routes will no longer be updated and **will be removed in a future major release.**

To learn more refer to the [new API structure in Grafana](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/developer-resources/api-reference/http-api/apis).

{{< /admonition >}}

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
