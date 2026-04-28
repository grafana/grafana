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

# Dashboard APIs

{{< admonition type="note" >}}
Available in Grafana 12 and later.

This API complies with the new Grafana API structure. To learn more refer to documentation about the [API structure in Grafana](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/developer-resources/api-reference/http-api/apis).
{{< /admonition >}}

## Requirements

If you're running Grafana Enterprise, you'll need to have specific permissions for some endpoints. Refer to [Role-based access control permissions](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/administration/roles-and-permissions/access-control/custom-role-actions-scopes/) for more information.

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
Accept: application/json
Content-Type: application/json
Authorization: Bearer eyJrIjoiT0tTcG1pUlY2RnVKZTFVaDFsNFZXdE9ZWmNrMkZYbk

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

<!-- prettier-ignore-start -->
| Action              | Scope                                                                                                   |
| ------------------- | ------------------------------------------------------------------------------------------------------- |
| `dashboards:write`  | <ul><li>`dashboards:*`</li><li>`dashboards:uid:*`</li><li>`folders:*`</li><li>`folders:uid:*`</li></ul> |
{ .no-spacing-list }
<!-- prettier-ignore-end -->

**Example Update Request**:

```http
POST /apis/dashboard.grafana.app/v1/namespaces/default/dashboards/gdxccn HTTP/1.1
Accept: application/json
Content-Type: application/json
Authorization: Bearer eyJrIjoiT0tTcG1pUlY2RnVKZTFVaDFsNFZXdE9ZWmNrMkZYbk

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

JSON Body schema:

- **metadata.name** – The [unique identifier]({{< ref "#identifier-id-vs-unique-identifier-uid" >}}).
- **metadata.annotations.grafana.app/folder** - Optional field, the unique identifier of the folder under which the dashboard should be created.
- **metadata.annotations.grafana.app/message** - Optional field, to set a commit message for the version history.
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

Status Codes:

- **200** – OK
- **400** – Errors (invalid json, missing or invalid fields, etc)
- **401** – Unauthorized
- **403** – Access denied
- **409** – Conflict (dashboard with the same version already exists)

## Get Dashboard

`GET /apis/dashboard.grafana.app/v1/namespaces/:namespace/dashboards/:uid`

Gets a dashboard via the dashboard uid.

- namespace: to read more about the namespace to use, see the [API overview](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/developers/http_api/apis/).
- uid: the unique identifier of the dashboard to update. this will be the _name_ in the dashboard response

**Required permissions**

See note in the [introduction]({{< ref "#dashboard-api" >}}) for an explanation.

<!-- prettier-ignore-start -->
| Action            | Scope                                                                                                   |
| ----------------- | ------------------------------------------------------------------------------------------------------- |
| `dashboards:read` | <ul><li>`dashboards:*`</li><li>`dashboards:uid:*`</li><li>`folders:*`</li><li>`folders:uid:*`</li></ul> |
{ .no-spacing-list }
<!-- prettier-ignore-end -->

**Example Get Request**:

```http
GET /apis/dashboard.grafana.app/v1/namespaces/default/dashboards/gdxccn HTTP/1.1
Accept: application/json
Content-Type: application/json
Authorization: Bearer eyJrIjoiT0tTcG1pUlY2RnVKZTFVaDFsNFZXdE9ZWmNrMkZYbk
```

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

Status Codes:

- **200** – OK
- **401** – Unauthorized
- **403** – Access denied
- **404** – Not Found

### Retrieve additional access information

`GET /apis/dashboard.grafana.app/v1/namespaces/:namespace/dashboards/:uid/dto`

Retrieves a dashboard with additional access information.

The `GET` response includes an additional `access` section with data such as if it's a public dashboard, or the dashboard permissions (admin, editor) of the user who made the request.

## List Dashboards

`GET /apis/dashboard.grafana.app/v1/namespaces/:namespace/dashboards`

Lists all dashboards in the given organization. You can control the maximum number of dashboards returned through the `limit` query parameter. You can then use the `continue` token returned to fetch the next page of dashboards.

- namespace: to read more about the namespace to use, see the [API overview](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/developers/http_api/apis/).

**Query parameters**:

- **`limit`** (optional): Maximum number of dashboards to return
- **`continue`** (optional): Continue token from a previous response to fetch the next page

**Required permissions**

See note in the [introduction]({{< ref "#dashboard-api" >}}) for an explanation.

<!-- prettier-ignore-start -->
| Action            | Scope                                                                                                   |
| ----------------- | ------------------------------------------------------------------------------------------------------- |
| `dashboards:read` | <ul><li>`dashboards:*`</li><li>`dashboards:uid:*`</li><li>`folders:*`</li><li>`folders:uid:*`</li></ul> |
{ .no-spacing-list }
<!-- prettier-ignore-end -->

**Example Get Request**:

```http
GET /apis/dashboard.grafana.app/v1/namespaces/default/dashboards?limit=1 HTTP/1.1
Accept: application/json
Content-Type: application/json
Authorization: Bearer eyJrIjoiT0tTcG1pUlY2RnVKZTFVaDFsNFZXdE9ZWmNrMkZYbk
```

**Example Response**:

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

**Example subsequent request using continue token**:

```http
GET /apis/dashboard.grafana.app/v1/namespaces/default/dashboards?limit=1&continue=eyJvIjoxNTIsInYiOjE3NjE3MDQyMjQyMDcxODksInMiOmZhbHNlfQ== HTTP/1.1
Accept: application/json
Content-Type: application/json
Authorization: Bearer eyJrIjoiT0tTcG1pUlY2RnVKZTFVaDFsNFZXdE9ZWmNrMkZYbk
```

**Example subsequent response**:

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

Status Codes:

- **200** – OK
- **401** – Unauthorized
- **403** – Access denied

## List dashboard history

You can retrieve the full version history of a dashboard using the List endpoint with specific query parameters. For details and examples, refer to [Resource history HTTP API](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/developers/http_api/resource-history/).

## Delete Dashboard

`DELETE /apis/dashboard.grafana.app/v1/namespaces/:namespace/dashboards/:uid`

Deletes a dashboard via the dashboard uid.

- **`namespace`**: To read more about the namespace to use, see the [API overview](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/developers/http_api/apis/).
- **`uid`**: The unique identifier of the dashboard to update. This is the `metadata.name` field in the dashboard response and _not_ the `metadata.uid` field.

**Required permissions**

See note in the [introduction](#new-dashboard-apis) for an explanation.

<!-- prettier-ignore-start -->
| Action              | Scope                                                                                                   |
| ------------------- | ------------------------------------------------------------------------------------------------------- |
| `dashboards:delete` | <ul><li>`dashboards:*`</li><li>`dashboards:uid:*`</li><li>`folders:*`</li><li>`folders:uid:*`</li></ul> |
{ .no-spacing-list }
<!-- prettier-ignore-end -->

**Example Delete Request**:

```http
DELETE /apis/dashboard.grafana.app/v1/namespaces/default/dashboards/gdxccn HTTP/1.1
Accept: application/json
Content-Type: application/json
Authorization: Bearer eyJrIjoiT0tTcG1pUlY2RnVKZTFVaDFsNFZXdE9ZWmNrMkZYbk
```

**Example Response**:

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

Status Codes:

- **200** – OK
- **401** – Unauthorized
- **403** – Access denied
- **404** – Not found
