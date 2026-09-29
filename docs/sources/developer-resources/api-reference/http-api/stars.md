---
aliases:
canonical: https://grafana.com/docs/grafana/latest/developer-resources/api-reference/http-api/stars/
description: Grafana Stars HTTP API
keywords:
  - grafana
  - http
  - documentation
  - api
labels:
  products:
    - enterprise
    - oss
    - cloud
title: Collections Stars HTTP API
weight: 100
---

# Collections Stars API

{{< admonition type="note" >}}
Available in Grafana 13.3 and later.

This API complies with the new Grafana API structure. To learn more refer to documentation about the [API structure in Grafana](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/developer-resources/api-reference/http-api/apis).

**This document may not contain the latest version of the API. For the most up-to-date list of available endpoints, refer to [collections.grafana.app/v1](https://play.grafana.org/swagger?api=collections.grafana.app-v1alpha1) in Swagger.**

{{< /admonition >}}

## Requirements




New API reference: {your-instance}/swagger?api=collections.grafana.app.grafana.app-v1


## Endpoints

| Method | Summary                                      | URI                                                                      |
| ------ | -------------------------------------------- | ------------------------------------------------------------------------ |
| POST   | [Create Dashboard](#create-dashboard)        | /apis/dashboard.grafana.app/v1/namespaces/:namespace/dashboards          |
| PUT    | [Update Dashboard](#update-dashboard)        | /apis/dashboard.grafana.app/v1/namespaces/:namespace/dashboards/:uid     |
| GET    | [Get Dashboard](#get-dashboard)              | /apis/dashboard.grafana.app/v1/namespaces/:namespace/dashboards/:uid     |
| GET    | [Get Dashboard (DTO format)](#get-dashboard) | /apis/dashboard.grafana.app/v1/namespaces/:namespace/dashboards/:uid/dto |
| GET    | [List Dashboards](#list-dashboards)          | /apis/dashboard.grafana.app/v1/namespaces/:namespace/dashboards          |
| DELETE | [Delete Dashboard](#delete-dashboard)        | /apis/dashboard.grafana.app/v1/namespaces/:namespace/dashboards/:uid     |

## Create Dashboard

`POST /apis/dashboard.grafana.app/v1/namespaces/:namespace/dashboards`

Creates a new dashboard.

- namespace: to read more about the namespace to use, see the [API overview](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/developers/http_api/apis/).

**Required permissions**

See note in the [introduction]({{< ref "#dashboard-api" >}}) for an explanation.

<!-- prettier-ignore-start -->
| Action              | Scope                                                                                                   |
| ------------------- | ------------------------------------------------------------------------------------------------------- |
| `dashboards:create` | <ul><li>`folders:*`</li><li>`folders:uid:*`</li></ul>                                                   |
| `dashboards:write`  | <ul><li>`dashboards:*`</li><li>`dashboards:uid:*`</li><li>`folders:*`</li><li>`folders:uid:*`</li></ul> |
{ .no-spacing-list }
<!-- prettier-ignore-end -->

**Example Create Request**:

```http
POST /apis/dashboard.grafana.app/v1/namespaces/default/dashboards HTTP/1.1


JSON Body schema:

- **metadata.name** – The Grafana [unique identifier]({{< ref "#identifier-id-vs-unique-identifier-uid" >}}). If you do not want to provide this, set metadata.generateName instead to the prefix you would like for the randomly generated uid (cannot be an empty string).
- **metadata.annotations.grafana.app/folder** - Optional field, the unique identifier of the folder under which the dashboard should be created.
- **spec** – The dashboard json.

{{< admonition type="note" >}}
Custom labels and annotations in the metadata field are supported on some instances, with full support planned for all instances when these APIs reach general availability. If they are not yet supported on your instance, they will be ignored.
{{< /admonition >}}

**Example Response**:

```http
HTTP/1.1 200 OK
Content-Type: application/json; charset=UTF-8
Content-Length: 485

{
  "kind": "Dashboard",
  "apiVersion": "dashboard.grafana.app/v1",
  "metadata": {
    "name": "gdxccn",
    "namespace": "default",
    "uid": "Cc7fA5ffHY94NnHZyMxXvFlpFtOmkK3qkBcVZPKSPXcX",
    "resourceVersion": "1",
    "generation": 1,
    "creationTimestamp": "2025-04-24T20:35:29Z",
    "labels": {
      "grafana.app/deprecatedInternalID": "11"
    },
    "annotations": {
      "grafana.app/createdBy": "service-account:dejwtrofg77y8d",
      "grafana.app/folder": "fef30w4jaxla8b"
    },
    "managedFields": [
      {
        "manager": "curl",
        "operation": "Update",
        "apiVersion": "dashboard.grafana.app/v0alpha1",
        "time": "2025-04-24T20:35:29Z",
        "fieldsType": "FieldsV1",
        "fieldsV1": {
          "f:spec": {
            "f:annotations": {
              ".": {},
              "f:list": {}
            },
            "f:editable": {},
            "f:fiscalYearStartMonth": {},
            "f:graphTooltip": {},
            "f:links": {},
            "f:panels": {},
            "f:preload": {},
            "f:schemaVersion": {},
            "f:tags": {},
            "f:templating": {
              ".": {},
              "f:list": {}
            },
            "f:time": {
              ".": {},
              "f:from": {},
              "f:to": {}
            },
            "f:timepicker": {},
            "f:timezone": {},
            "f:title": {},
            "f:version": {}
          }
        }
      }
    ]
  },
  "spec": {
    "annotations": {
      "list": [
        {
          "datasource": {
            "type": "datasource",
            "uid": "grafana"
          },
          "enable": true,
          "hide": false,
          "iconColor": "red",
          "name": "Example annotation",
          "target": {
            "limit": 100,
            "matchAny": false,
            "tags": [],
            "type": "dashboard"
          }
        }
      ]
    },
    "editable": true,
    "fiscalYearStartMonth": 0,
    "graphTooltip": 0,
    "links": [
      {
        "asDropdown": false,
        "icon": "external link",
        "includeVars": false,
        "keepTime": false,
        "tags": [],
        "targetBlank": false,
        "title": "Example Link",
        "tooltip": "",
        "type": "dashboards",
        "url": ""
      }
    ],
    "panels": [
      {
        "datasource": {
          "type": "datasource",
          "uid": "grafana"
        },
        "description": "With a description",
        "fieldConfig": {
          "defaults": {
            "color": {
              "mode": "palette-classic"
            },
            "custom": {
              "axisBorderShow": false,
              "axisCenteredZero": false,
              "axisColorMode": "text",
              "axisLabel": "",
              "axisPlacement": "auto",
              "barAlignment": 0,
              "barWidthFactor": 0.6,
              "drawStyle": "line",
              "fillOpacity": 0,
              "gradientMode": "none",
              "hideFrom": {
                "legend": false,
                "tooltip": false,
                "viz": false
              },
              "insertNulls": false,
              "lineInterpolation": "linear",
              "lineWidth": 1,
              "pointSize": 5,
              "scaleDistribution": {
                "type": "linear"
              },
              "showPoints": "auto",
              "spanNulls": false,
              "stacking": {
                "group": "A",
                "mode": "none"
              },
              "thresholdsStyle": {
                "mode": "off"
              }
            },
            "mappings": [],
            "thresholds": {
              "mode": "absolute",
              "steps": [
                {
                  "color": "green"
                },
                {
                  "color": "red",
                  "value": 80
                }
              ]
            }
          },
          "overrides": []
        },
        "gridPos": {
          "h": 8,
          "w": 12,
          "x": 0,
          "y": 0
        },
        "id": 1,
        "options": {
          "legend": {
            "calcs": [],
            "displayMode": "list",
            "placement": "bottom",
            "showLegend": true
          },
          "tooltip": {
            "hideZeros": false,
            "mode": "single",
            "sort": "none"
          }
        },
        "pluginVersion": "12.0.0",
        "targets": [
          {
            "datasource": {
              "type": "datasource",
              "uid": "grafana"
            },
            "refId": "A"
          }
        ],
        "title": "Example panel",
        "type": "timeseries"
      }
    ],
    "preload": false,
    "schemaVersion": 41,
    "tags": [
      "example"
    ],
    "templating": {
      "list": [
        {
          "current": {
            "text": "",
            "value": ""
          },
          "definition": "",
          "description": "example description",
          "label": "ExampleLabel",
          "name": "ExampleVariable",
          "options": [],
          "query": "",
          "refresh": 1,
          "regex": "cluster",
          "type": "query"
        }
      ]
    },
    "time": {
      "from": "now-6h",
      "to": "now"
    },
    "timepicker": {},
    "timezone": "browser",
    "title": "Example Dashboard"
  },
  "status": {}
```

Status Codes:

- **201** – Created
- **400** – Errors (invalid json, missing or invalid fields, etc)
- **401** – Unauthorized
- **403** – Access denied
- **409** – Conflict (dashboard with the same uid already exists)

## Update Dashboard

`PUT /apis/dashboard.grafana.app/v1/namespaces/:namespace/dashboards/:uid`

Updates an existing dashboard via the dashboard uid.

- namespace: to read more about the namespace to use, see the [API overview](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/developers/http_api/apis/).
- uid: the unique identifier of the dashboard to update. this will be the _name_ in the dashboard response

**Required permissions**

See note in the [introduction]({{< ref "#dashboard-api" >}}) for an explanation.


**Example Update Request**:

```http
POST /apis/dashboard.grafana.app/v1/namespaces/default/dashboards/gdxccn HTTP/1.1


JSON Body schema:



**Example Response**:

```http
HTTP/1.1 200 OK
Content-Type: application/json; charset=UTF-8
Content-Length: 485

{
  "kind": "Dashboard",
  "apiVersion": "dashboard.grafana.app/v1",
  "metadata": {

```

Status Codes:

- **200** – OK
- **400** – Errors (invalid json, missing or invalid fields, etc)
- **401** – Unauthorized
- **403** – Access denied
- **409** – Conflict (dashboard with the same version already exists)

## Delete Dashboard

`DELETE /apis/dashboard.grafana.app/v1/namespaces/:namespace/dashboards/:uid`

Deletes a dashboard via the dashboard uid.

- **`namespace`**: To read more about the namespace to use, see the [API overview](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/developers/http_api/apis/).
- **`uid`**: The unique identifier of the dashboard to update. This is the `metadata.name` field in the dashboard response and _not_ the `metadata.uid` field.

**Required permissions**

See note in the [introduction](#new-dashboard-apis) for an explanation.



**Example Delete Request**:

```http

```

**Example Response**:

```http

```

Status Codes:

- **200** – OK
- **401** – Unauthorized
- **403** – Access denied
- **404** – Not found
