----
page_title: Other APIs
page_description: Grafana Other API Reference
page_keywords: grafana, admin, http, api, documentation, dashboards
---

# Frontend Settings API

## Get Settings

`GET /api/frontend/settings`

**Example Request**:

    GET /api/frontend/settings HTTP/1.1
    Accept: application/json
    Content-Type: application/json
    Authorization: Bearer eyJrIjoiT0tTcG1pUlY2RnVKZTFVaDFsNFZXdE9ZWmNrMkZYbk

**Example Response**:

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

# Login API

## Renew session based on remember cookie

`GET /api/login/ping`

**Example Request**:

    GET /api/login/ping HTTP/1.1
    Accept: application/json
    Content-Type: application/json
    Authorization: Bearer eyJrIjoiT0tTcG1pUlY2RnVKZTFVaDFsNFZXdE9ZWmNrMkZYbk

**Example Response**:

    HTTP/1.1 200
    Content-Type: application/json

    {"message": "Logged in"}
