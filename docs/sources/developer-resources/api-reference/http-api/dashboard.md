---
aliases:
  - ../../../http_api/dashboard/ # /docs/grafana/next/http_api/dashboard/
  - ../../../developers/http_api/dashboard/ # /docs/grafana/next/developers/http_api/dashboard/
canonical: https://grafana.com/docs/grafana/latest/developer-resources/api-reference/http-api/dashboard/
description: Grafana Dashboard HTTP API
keywords:
  - grafana
  - http
  - documentation
  - api
  - dashboard
labels:
  products:
    - enterprise
    - oss
    - cloud
title: Dashboard HTTP API
weight: 100
---

# Dashboard API

{{< admonition type="note" >}}
Available in Grafana 12.0 and later.

This API complies with the new Grafana API structure. To learn more refer to documentation about the [API structure in Grafana](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/developer-resources/api-reference/http-api/apis/).

This API replaces the legacy `/api/dashboards/*` endpoints, although there may not be an exact match for all legacy endpoints.

**This document may not contain the latest version of the API. For the most up-to-date list of available endpoints, refer to [dashboard.grafana.app/v1](https://play.grafana.org/swagger?api=dashboard.grafana.app-v1) and [dashboard.grafana.app/v2](https://play.grafana.org/swagger?api=dashboard.grafana.app-v2) in Swagger.**

{{< /admonition >}}

## API versions

The Dashboard API serves the same dashboards in two schemas. Choose the version that matches the dashboard JSON you want to send and receive:

| Version | Dashboard schema                                                                          | Swagger                                                                                   |
| ------- | ----------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| `v1`    | Classic JSON model, with `panels`, `templating`, and `time` in `spec`                     | [dashboard.grafana.app/v1](https://play.grafana.org/swagger?api=dashboard.grafana.app-v1) |
| `v2`    | Dashboard schema v2, with `elements`, `layout`, `variables`, and `timeSettings` in `spec` | [dashboard.grafana.app/v2](https://play.grafana.org/swagger?api=dashboard.grafana.app-v2) |

Both versions use the same endpoints, query parameters, and permissions. Only the version in the path and the shape of `spec` change. For example, use `/apis/dashboard.grafana.app/v2/namespaces/{namespace}/dashboards` to work with dashboards in the v2 schema.

You can read any dashboard with either version, regardless of the schema it was saved in, because Grafana converts it. For details, refer to [Use the v2 schema](#use-the-v2-schema).

Grafana also serves the older `v0alpha1`, `v1beta1`, `v2alpha1`, and `v2beta1` versions. Use `v1` or `v2` instead.

{{< admonition type="note" >}}
The `dashboard.grafana.app` API group also serves other resources, which this document doesn't cover:

- **Library panels:** The `librarypanels` resource, in `v0alpha1`.
- **Snapshots:** The `snapshots` resource, in `v0alpha1`.
- **Search:** The `search` endpoint, in `v0alpha1`.
- **Notebooks:** The `notebooks` resource, in `v2beta1`. Refer to [Notebooks HTTP API](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/developer-resources/api-reference/http-api/notebooks/).
- **Global variables:** The `variables` resource, in `v2beta1`.

Notebooks and global variables are only available if their feature is enabled. For the endpoints of these resources, refer to [dashboard.grafana.app/v0alpha1](https://play.grafana.org/swagger?api=dashboard.grafana.app-v0alpha1) and [dashboard.grafana.app/v2beta1](https://play.grafana.org/swagger?api=dashboard.grafana.app-v2beta1) in Swagger.
{{< /admonition >}}

The examples in the following sections use `v1`, except for [Use the v2 schema](#use-the-v2-schema).

## Requirements

If you're running Grafana Enterprise, you'll need to have specific permissions for some endpoints. Refer to [Role-based access control permissions](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/administration/roles-and-permissions/access-control/custom-role-actions-scopes/) for more information.

## Endpoints

These are the available endpoints:

| Method | Summary                                                               | URI                                                                          |
| ------ | --------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| POST   | [Create Dashboard](#create-dashboard)                                 | `/apis/dashboard.grafana.app/v1/namespaces/{namespace}/dashboards`           |
| PUT    | [Update Dashboard](#update-dashboard)                                 | `/apis/dashboard.grafana.app/v1/namespaces/{namespace}/dashboards/{uid}`     |
| GET    | [Get Dashboard](#get-dashboard)                                       | `/apis/dashboard.grafana.app/v1/namespaces/{namespace}/dashboards/{uid}`     |
| GET    | [Get Dashboard (DTO format)](#retrieve-additional-access-information) | `/apis/dashboard.grafana.app/v1/namespaces/{namespace}/dashboards/{uid}/dto` |
| GET    | [List Dashboards](#list-dashboards)                                   | `/apis/dashboard.grafana.app/v1/namespaces/{namespace}/dashboards`           |
| DELETE | [Delete Dashboard](#delete-dashboard)                                 | `/apis/dashboard.grafana.app/v1/namespaces/{namespace}/dashboards/{uid}`     |

## Create Dashboard

`POST /apis/dashboard.grafana.app/v1/namespaces/{namespace}/dashboards`

Creates a new dashboard.

**Path parameters**:

- `{namespace}`: To learn more about which namespace to use, refer to the [API overview](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/developer-resources/api-reference/http-api/apis/).

**Required permissions**:

See note in the [introduction]({{< ref "#dashboard-api" >}}) for an explanation.

<!-- prettier-ignore-start -->
| Action              | Scope                                                                                                   |
| ------------------- | ------------------------------------------------------------------------------------------------------- |
| `dashboards:create` | <ul><li>`folders:*`</li><li>`folders:uid:*`</li></ul>                                                   |
| `dashboards:write`  | <ul><li>`dashboards:*`</li><li>`dashboards:uid:*`</li><li>`folders:*`</li><li>`folders:uid:*`</li></ul> |
{ .no-spacing-list }
<!-- prettier-ignore-end -->

### Example request

The following example shows a request to create a dashboard:

```http
POST /apis/dashboard.grafana.app/v1/namespaces/default/dashboards HTTP/1.1
Accept: application/json
Content-Type: application/json
Authorization: Bearer <SERVICE_ACCOUNT_TOKEN>

{
  "metadata": {
    "name": "gdxccn",
    "annotations": {
      "grafana.app/folder": "fef30w4jaxla8b"
    },
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
      }]
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
    "tags": ["example"],
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
    "title": "Example Dashboard",
    "version": 0
  }
}
```

JSON body schema:

- **metadata.name** – The Grafana [unique identifier]({{< ref "#identifier-id-vs-unique-identifier-uid" >}}). If you do not want to provide this, set metadata.generateName instead to the prefix you would like for the randomly generated `uid` (cannot be an empty string).
- **metadata.annotations.grafana.app/folder** - Optional field, the unique identifier of the folder under which the dashboard should be created.
- **spec** – The dashboard JSON.

{{< admonition type="note" >}}
Custom labels and annotations in the metadata field are supported on some instances, with full support planned for all instances when these APIs reach general availability. If they are not yet supported on your instance, they will be ignored.
{{< /admonition >}}

### Example response

The following example shows the response:

```http
HTTP/1.1 201 Created
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

### Status codes

- **201:** Created
- **400:** Errors (invalid JSON, missing or invalid fields)
- **401:** Unauthorized
- **403:** Access denied, for example because you can't access the folder or the dashboard quota is reached
- **404:** The folder doesn't exist
- **409:** Conflict (a dashboard with the same `uid` already exists)
- **422:** The dashboard doesn't match the schema

## Update Dashboard

`PUT /apis/dashboard.grafana.app/v1/namespaces/{namespace}/dashboards/{uid}`

Updates an existing dashboard via the dashboard `uid`.

**Path parameters**:

- `{namespace}`: To learn more about which namespace to use, refer to the [API overview](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/developer-resources/api-reference/http-api/apis/).
- `{uid}`: The unique identifier of the dashboard. This is the `metadata.name` field in the dashboard response and _not_ the `metadata.uid` field.

**Required permissions**:

See note in the [introduction]({{< ref "#dashboard-api" >}}) for an explanation.

<!-- prettier-ignore-start -->
| Action              | Scope                                                                                                   |
| ------------------- | ------------------------------------------------------------------------------------------------------- |
| `dashboards:write`  | <ul><li>`dashboards:*`</li><li>`dashboards:uid:*`</li><li>`folders:*`</li><li>`folders:uid:*`</li></ul> |
{ .no-spacing-list }
<!-- prettier-ignore-end -->

### Example request

The following example shows a request to update a dashboard:

```http
PUT /apis/dashboard.grafana.app/v1/namespaces/default/dashboards/gdxccn HTTP/1.1
Accept: application/json
Content-Type: application/json
Authorization: Bearer <SERVICE_ACCOUNT_TOKEN>

{
  "metadata": {
    "name": "gdxccn",
    "annotations": {
      "grafana.app/folder": "fef30w4jaxla8b",
      "grafana.app/message": "commit message"
    },
  },
  "spec": {
    "title": "New dashboard - updated",
    "schemaVersion": 41,
    ...
  }
}
```

JSON body schema:

- **metadata.name** – The [unique identifier]({{< ref "#identifier-id-vs-unique-identifier-uid" >}}).
- **metadata.annotations.grafana.app/folder** - Optional field, the unique identifier of the folder under which the dashboard should be created.
- **metadata.annotations.grafana.app/message** - Optional field, to set a commit message for the version history.
- **spec** – The dashboard JSON.

{{< admonition type="note" >}}
Custom labels and annotations in the metadata field are supported on some instances, with full support planned for all instances when these APIs reach general availability. If they are not yet supported on your instance, they will be ignored.
{{< /admonition >}}

### Example response

The following example shows the response:

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
    "resourceVersion": "2",
    "generation": 2,
    "creationTimestamp": "2025-03-06T19:57:18Z",
    "annotations": {
      "grafana.app/folder": "fef30w4jaxla8b",
      "grafana.app/createdBy": "service-account:cef2t2rfm73lsb",
      "grafana.app/updatedBy": "service-account:cef2t2rfm73lsb",
      "grafana.app/updatedTimestamp": "2025-03-07T02:58:36Z"
    }
  },
  "spec": {
    "schemaVersion": 41,
    "title": "New dashboard - updated",
    ...
  }
}
```

### Status codes

- **200:** OK
- **201:** Created, if the dashboard doesn't exist
- **400:** Errors (invalid JSON, missing or invalid fields)
- **401:** Unauthorized
- **403:** Access denied, for example because you can't access the folder
- **404:** The folder doesn't exist
- **409:** Conflict (the dashboard changed since you read it)
- **422:** The dashboard doesn't match the schema

## Get Dashboard

`GET /apis/dashboard.grafana.app/v1/namespaces/{namespace}/dashboards/{uid}`

Gets a dashboard via the dashboard `uid`.

**Path parameters**:

- `{namespace}`: To learn more about which namespace to use, refer to the [API overview](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/developer-resources/api-reference/http-api/apis/).
- `{uid}`: The unique identifier of the dashboard. This is the `metadata.name` field in the dashboard response and _not_ the `metadata.uid` field.

**Required permissions**:

See note in the [introduction]({{< ref "#dashboard-api" >}}) for an explanation.

<!-- prettier-ignore-start -->
| Action            | Scope                                                                                                   |
| ----------------- | ------------------------------------------------------------------------------------------------------- |
| `dashboards:read` | <ul><li>`dashboards:*`</li><li>`dashboards:uid:*`</li><li>`folders:*`</li><li>`folders:uid:*`</li></ul> |
{ .no-spacing-list }
<!-- prettier-ignore-end -->

### Example request

The following example shows a request to get a dashboard:

```http
GET /apis/dashboard.grafana.app/v1/namespaces/default/dashboards/gdxccn HTTP/1.1
Accept: application/json
Content-Type: application/json
Authorization: Bearer <SERVICE_ACCOUNT_TOKEN>
```

### Example response

The following example shows the response:

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
    "resourceVersion": "2",
    "generation": 2,
    "creationTimestamp": "2025-03-06T19:57:18Z",
    "annotations": {
      "grafana.app/createdBy": "service-account:cef2t2rfm73lsb",
      "grafana.app/updatedBy": "service-account:cef2t2rfm73lsb",
      "grafana.app/updatedTimestamp": "2025-03-07T02:58:36Z"
    }
  },
  "spec": {
    "schemaVersion": 41,
    "title": "New dashboard - updated",
    ...
  }
}
```

### Status codes

- **200:** OK
- **401:** Unauthorized
- **403:** Access denied
- **404:** Not found

### Retrieve additional access information

`GET /apis/dashboard.grafana.app/v1/namespaces/{namespace}/dashboards/{uid}/dto`

Retrieves a dashboard with additional access information.

**Path parameters**:

- `{namespace}`: To learn more about which namespace to use, refer to the [API overview](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/developer-resources/api-reference/http-api/apis/).
- `{uid}`: The unique identifier of the dashboard. This is the `metadata.name` field in the dashboard response and _not_ the `metadata.uid` field.

#### Example request

The following example shows a request to get a dashboard with additional access information:

```http
GET /apis/dashboard.grafana.app/v1/namespaces/default/dashboards/gdxccn/dto HTTP/1.1
Accept: application/json
Content-Type: application/json
Authorization: Bearer <SERVICE_ACCOUNT_TOKEN>
```

#### Example response

The `GET` response includes an additional `access` section with data such as if it's a public dashboard, or the dashboard permissions (admin, editor) of the user who made the request. For the rest of the response, refer to the response in [Get Dashboard](#get-dashboard).

#### Status codes

- **200:** Found
- **401:** Unauthorized
- **403:** Access denied
- **404:** Not found

## List Dashboards

`GET /apis/dashboard.grafana.app/v1/namespaces/{namespace}/dashboards`

Lists all dashboards in the given organization. You can control the maximum number of dashboards returned through the `limit` query parameter. You can then use the `continue` token returned to fetch the next page of dashboards.

**Path parameters**:

- `{namespace}`: To learn more about which namespace to use, refer to the [API overview](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/developer-resources/api-reference/http-api/apis/).

**Query parameters**:

- **`limit`** (optional): Maximum number of dashboards to return
- **`continue`** (optional): Continue token from a previous response to fetch the next page

**Required permissions**:

See note in the [introduction]({{< ref "#dashboard-api" >}}) for an explanation.

<!-- prettier-ignore-start -->
| Action            | Scope                                                                                                   |
| ----------------- | ------------------------------------------------------------------------------------------------------- |
| `dashboards:read` | <ul><li>`dashboards:*`</li><li>`dashboards:uid:*`</li><li>`folders:*`</li><li>`folders:uid:*`</li></ul> |
{ .no-spacing-list }
<!-- prettier-ignore-end -->

### Example request

The following example shows a request to list dashboards:

```http
GET /apis/dashboard.grafana.app/v1/namespaces/default/dashboards?limit=1 HTTP/1.1
Accept: application/json
Content-Type: application/json
Authorization: Bearer <SERVICE_ACCOUNT_TOKEN>
```

### Example response

The following example shows the response:

```http
HTTP/1.1 200 OK
Content-Type: application/json; charset=UTF-8
Content-Length: 644

{
  "kind": "DashboardList",
  "apiVersion": "dashboard.grafana.app/v1alpha1",
  "metadata": {
    "resourceVersion": "1741315830000",
    "continue": "eyJvIjoxNTIsInYiOjE3NjE3MDQyMjQyMDcxODksInMiOmZhbHNlfQ=="
  },
  "items": [
    {
      "kind": "Dashboard",
      "apiVersion": "dashboard.grafana.app/v1alpha1",
      "metadata": {
        "name": "gpqcmf",
        "namespace": "default",
        "uid": "VQyL7pNTpfGPNlPM6HRJSePrBg5dXmxr4iPQL7txLtwX",
        "resourceVersion": "1",
        "generation": 1,
        "creationTimestamp": "2025-03-06T19:50:30Z",
        "annotations": {
          "grafana.app/createdBy": "service-account:cef2t2rfm73lsb",
          "grafana.app/updatedBy": "service-account:cef2t2rfm73lsb",
          "grafana.app/updatedTimestamp": "2025-03-06T19:50:30Z"
        }
      },
      "spec": {
        "schemaVersion": 41,
        "title": "New dashboard",
        "uid": "gpqcmf",
        "version": 1,
        ...
      }
    }
  ]
}
```

The `metadata.continue` field contains a token to fetch the next page.

### Example subsequent request using continue token

The following example shows a request for the next page, using the `continue` token from the previous response:

```http
GET /apis/dashboard.grafana.app/v1/namespaces/default/dashboards?limit=1&continue=eyJvIjoxNTIsInYiOjE3NjE3MDQyMjQyMDcxODksInMiOmZhbHNlfQ== HTTP/1.1
Accept: application/json
Content-Type: application/json
Authorization: Bearer <SERVICE_ACCOUNT_TOKEN>
```

### Example subsequent response

The following example shows the response for the next page:

```http
HTTP/1.1 200 OK
Content-Type: application/json; charset=UTF-8

{
  "kind": "DashboardList",
  "apiVersion": "dashboard.grafana.app/v1alpha1",
  "items": [
    {
      "kind": "Dashboard",
      "apiVersion": "dashboard.grafana.app/v1alpha1",
      "metadata": {
        "name": "hpqcmg",
        "namespace": "default",
        "uid": "WQyL7pNTpfGPNlPM6HRJSePrBg5dXmxr4iPQL7txLtwY",
        "resourceVersion": "1",
        "generation": 1,
        "creationTimestamp": "2025-03-06T19:51:31Z",
        "annotations": {
          "grafana.app/createdBy": "service-account:cef2t2rfm73lsb",
          "grafana.app/updatedBy": "service-account:cef2t2rfm73lsb",
          "grafana.app/updatedTimestamp": "2025-03-06T19:51:31Z"
        }
      },
      "spec": {
        "schemaVersion": 41,
        "title": "Another dashboard",
        "uid": "hpqcmg",
        "version": 1,
        ...
      }
    }
  ]
}
```

Continue making requests with the updated `continue` token until you receive a response without a `continue` field in the metadata, indicating you've reached the last page.

### Status codes

- **200:** OK
- **401:** Unauthorized
- **403:** Access denied

## List dashboard history

You can retrieve the full version history of a dashboard using the List endpoint with specific query parameters. For details and examples, refer to [Resource history HTTP API](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/developers/http_api/resource-history/).

## Delete Dashboard

`DELETE /apis/dashboard.grafana.app/v1/namespaces/{namespace}/dashboards/{uid}`

Deletes a dashboard via the dashboard `uid`.

**Path parameters**:

- `{namespace}`: To learn more about which namespace to use, refer to the [API overview](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/developer-resources/api-reference/http-api/apis/).
- `{uid}`: The unique identifier of the dashboard. This is the `metadata.name` field in the dashboard response and _not_ the `metadata.uid` field.

**Required permissions**:

See note in the [introduction]({{< ref "#dashboard-api" >}}) for an explanation.

<!-- prettier-ignore-start -->
| Action              | Scope                                                                                                   |
| ------------------- | ------------------------------------------------------------------------------------------------------- |
| `dashboards:delete` | <ul><li>`dashboards:*`</li><li>`dashboards:uid:*`</li><li>`folders:*`</li><li>`folders:uid:*`</li></ul> |
{ .no-spacing-list }
<!-- prettier-ignore-end -->

### Example request

The following example shows a request to delete a dashboard:

```http
DELETE /apis/dashboard.grafana.app/v1/namespaces/default/dashboards/gdxccn HTTP/1.1
Accept: application/json
Content-Type: application/json
Authorization: Bearer <SERVICE_ACCOUNT_TOKEN>
```

### Example response

The following example shows the response:

```http
HTTP/1.1 200 OK
Content-Type: application/json; charset=UTF-8
Content-Length: 78

{
  "kind": "Status",
  "apiVersion": "v1",
  "metadata": {},
  "status": "Success",
  "details": {
    "name": "gdxccn",
    "group": "dashboard.grafana.app",
    "kind": "dashboards",
    "uid": "Cc7fA5ffHY94NnHZyMxXvFlpFtOmkK3qkBcVZPKSPXcX"
  }
}
```

### Status codes

- **200:** OK
- **401:** Unauthorized
- **403:** Access denied
- **404:** Not found

## Use the v2 schema

To create, update, and read dashboards in the dashboard schema v2, use the `v2` version in the path. The endpoints, query parameters, required permissions, and status codes are the same as for `v1`.

In the v2 schema, panels are defined once in `spec.elements` and placed on the dashboard by `spec.layout`. Variables, time settings, and annotations have their own top-level fields.

### Create a dashboard with the v2 schema

`POST /apis/dashboard.grafana.app/v2/namespaces/{namespace}/dashboards`

**Path parameters**:

- `{namespace}`: To learn more about which namespace to use, refer to the [API overview](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/developer-resources/api-reference/http-api/apis/).

#### Example request

The following example shows a request to create a dashboard with the v2 schema:

```http
POST /apis/dashboard.grafana.app/v2/namespaces/default/dashboards HTTP/1.1
Accept: application/json
Content-Type: application/json
Authorization: Bearer <SERVICE_ACCOUNT_TOKEN>

{
  "metadata": {
    "name": "gdxccn",
    "annotations": {
      "grafana.app/folder": "fef30w4jaxla8b"
    }
  },
  "spec": {
    "title": "Example Dashboard",
    "description": "",
    "tags": ["example"],
    "cursorSync": "Off",
    "preload": false,
    "editable": true,
    "links": [],
    "annotations": [],
    "variables": [],
    "timeSettings": {
      "from": "now-6h",
      "to": "now",
      "timezone": "browser",
      "autoRefresh": "",
      "autoRefreshIntervals": ["5s", "10s", "30s", "1m", "5m", "15m", "30m", "1h", "2h", "1d"],
      "hideTimepicker": false,
      "fiscalYearStartMonth": 0
    },
    "elements": {
      "panel-1": {
        "kind": "Panel",
        "spec": {
          "id": 1,
          "title": "Example panel",
          "description": "With a description",
          "links": [],
          "data": {
            "kind": "QueryGroup",
            "spec": {
              "queries": [
                {
                  "kind": "PanelQuery",
                  "spec": {
                    "refId": "A",
                    "hidden": false,
                    "query": {
                      "kind": "DataQuery",
                      "group": "prometheus",
                      "version": "v0",
                      "datasource": {
                        "name": "prometheus-uid"
                      },
                      "spec": {
                        "expr": "up"
                      }
                    }
                  }
                }
              ],
              "transformations": [],
              "queryOptions": {}
            }
          },
          "vizConfig": {
            "kind": "VizConfig",
            "group": "timeseries",
            "version": "13.0.0",
            "spec": {
              "options": {},
              "fieldConfig": {
                "defaults": {},
                "overrides": []
              }
            }
          }
        }
      }
    },
    "layout": {
      "kind": "GridLayout",
      "spec": {
        "items": [
          {
            "kind": "GridLayoutItem",
            "spec": {
              "x": 0,
              "y": 0,
              "width": 12,
              "height": 8,
              "element": {
                "kind": "ElementReference",
                "name": "panel-1"
              }
            }
          }
        ]
      }
    }
  }
}
```

JSON body schema:

- **metadata.name** – The Grafana [unique identifier]({{< ref "#identifier-id-vs-unique-identifier-uid" >}}). If you don't want to provide one, set `metadata.generateName` to the prefix you want for the generated UID.
- **metadata.annotations.grafana.app/folder** – Optional. The unique identifier of the folder to create the dashboard in.
- **spec.title**, **spec.description**, **spec.tags** – The title, description, and tags of the dashboard.
- **spec.elements** – The panels and library panels of the dashboard, keyed by a name that's unique within the dashboard.
  - **data** – The queries of the panel. Each query sets `group` to the data source type, and `datasource.name` to the data source UID.
  - **vizConfig** – The visualization of the panel. `group` is the visualization plugin ID, for example `timeseries`.
- **spec.layout** – How to place the elements on the dashboard. Each layout item refers to an element by its name. The layout can be a `GridLayout`, `AutoGridLayout`, `RowsLayout`, or `TabsLayout`.
- **spec.variables** – The dashboard variables.
- **spec.timeSettings** – The default time range, time zone, and refresh settings.
- **spec.annotations** – The annotation queries of the dashboard.
- **spec.links** – Links to other dashboards or external websites.
- **spec.cursorSync** – Whether panels share the crosshair or tooltip: `Off`, `Crosshair`, or `Tooltip`.

#### Example response

The following example shows the response:

```http
HTTP/1.1 201 Created
Content-Type: application/json; charset=UTF-8

{
  "kind": "Dashboard",
  "apiVersion": "dashboard.grafana.app/v2",
  "metadata": {
    "name": "gdxccn",
    "namespace": "default",
    "uid": "Cc7fA5ffHY94NnHZyMxXvFlpFtOmkK3qkBcVZPKSPXcX",
    "resourceVersion": "1",
    "generation": 1,
    "creationTimestamp": "2026-11-05T06:51:00Z",
    "annotations": {
      "grafana.app/createdBy": "service-account:dejwtrofg77y8d",
      "grafana.app/folder": "fef30w4jaxla8b"
    }
  },
  "spec": {
    "title": "Example Dashboard",
    ...
  },
  "status": {}
}
```

#### Status codes

- **201:** Created
- **400:** Errors (invalid JSON, missing or invalid fields)
- **401:** Unauthorized
- **403:** Access denied, for example because you can't access the folder or the dashboard quota is reached
- **404:** The folder doesn't exist
- **409:** Conflict (a dashboard with the same `uid` already exists)
- **422:** The dashboard doesn't match the schema

### Read a dashboard saved in a different schema

When you read a dashboard with a version that doesn't match the schema it was saved in, Grafana converts it. For example, you can read a dashboard saved with `v1` through the `v2` endpoint.

If the conversion fails, the response includes a `status.conversion` object:

```json
{
  "kind": "Dashboard",
  "apiVersion": "dashboard.grafana.app/v2",
  "metadata": {
    "name": "gdxccn",
    ...
  },
  "spec": {
    ...
  },
  "status": {
    "conversion": {
      "failed": true,
      "storedVersion": "v1",
      "error": "<CONVERSION_ERROR>"
    }
  }
}
```

The `status.conversion` object contains the following fields:

- **failed** – Whether the conversion failed. If `true`, the `spec` in the response isn't valid. Read the dashboard again with the version in `storedVersion`.
- **storedVersion** – The version the dashboard was saved with. Reading the dashboard with this version always succeeds.
- **error** – The conversion error message.
