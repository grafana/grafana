---
aliases:
  - ../../http_api/dashboard/
canonical: /docs/grafana/latest/developers/http_api/dashboard/
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
title: Dashboard HTTP API
---

# New Dashboard APIs

> If you are running Grafana Enterprise, for some endpoints you'll need to have specific permissions. Refer to [Role-based access control permissions](/docs/grafana/latest/administration/roles-and-permissions/access-control/custom-role-actions-scopes/) for more information.

> To view more about the new API structure, refer to [API overview](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/developers/http_api/apis/).

## Create Dashboard

`POST /apis/dashboard.grafana.app/v1beta1/namespaces/:namespace/dashboards`

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
POST /apis/dashboard.grafana.app/v1beta1/namespaces/default/dashboards HTTP/1.1
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

**Example Response**:

```http
HTTP/1.1 200 OK
Content-Type: application/json; charset=UTF-8
Content-Length: 485

{
  "kind": "Dashboard",
  "apiVersion": "dashboard.grafana.app/v1beta1",
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

`PUT /apis/dashboard.grafana.app/v1beta1/namespaces/:namespace/dashboards/:uid`

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
POST /apis/dashboard.grafana.app/v1beta1/namespaces/default/dashboards/gdxccn HTTP/1.1
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

**Example Response**:

```http
HTTP/1.1 200 OK
Content-Type: application/json; charset=UTF-8
Content-Length: 485

{
  "kind": "Dashboard",
  "apiVersion": "dashboard.grafana.app/v1beta1",
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

`GET /apis/dashboard.grafana.app/v1beta1/namespaces/:namespace/dashboards/:uid`

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
GET /apis/dashboard.grafana.app/v1beta1/namespaces/default/dashboards/gdxccn HTTP/1.1
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
  "apiVersion": "dashboard.grafana.app/v1beta1",
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

## List Dashboards

`GET /apis/dashboard.grafana.app/v1beta1/namespaces/:namespace/dashboards`

Lists all dashboards in the given organization. You can control the maximum number of dashboards returned through the `limit` query parameter. You can then use the `continue` token returned to fetch the next page of dashboards.

- namespace: to read more about the namespace to use, see the [API overview](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/developers/http_api/apis/).

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
GET /apis/dashboard.grafana.app/v1beta1/namespaces/default/dashboards?limit=1 HTTP/1.1
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
    "continue": "org:1/start:1158/folder:"
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

Status Codes:

- **200** – OK
- **401** – Unauthorized
- **403** – Access denied

## Delete Dashboard

`DELETE /apis/dashboard.grafana.app/v1beta1/namespaces/:namespace/dashboards/:uid`

Deletes a dashboard via the dashboard uid.

- namespace: to read more about the namespace to use, see the [API overview](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/developers/http_api/apis/).
- uid: the unique identifier of the dashboard to update. this will be the _name_ in the dashboard response

**Required permissions**

See note in the [introduction]({{< ref "#dashboard-api" >}}) for an explanation.

<!-- prettier-ignore-start -->
| Action              | Scope                                                                                                   |
| ------------------- | ------------------------------------------------------------------------------------------------------- |
| `dashboards:delete` | <ul><li>`dashboards:*`</li><li>`dashboards:uid:*`</li><li>`folders:*`</li><li>`folders:uid:*`</li></ul> |
{ .no-spacing-list }
<!-- prettier-ignore-end -->

**Example Delete Request**:

```http
DELETE /apis/dashboard.grafana.app/v1beta1/namespaces/default/dashboards/gdxccn HTTP/1.1
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

## Gets the home dashboard

`GET /api/dashboards/home`

Will return the home dashboard.

**Example Request**:

```http
GET /api/dashboards/home HTTP/1.1
Accept: application/json
Content-Type: application/json
Authorization: Bearer eyJrIjoiT0tTcG1pUlY2RnVKZTFVaDFsNFZXdE9ZWmNrMkZYbk
```

**Example Response**:

```http
HTTP/1.1 200
Content-Type: application/json

{
  "dashboard": {
    "editable":false,
    "nav":[
      {
        "enable":false,
        "type":"timepicker"
      }
    ],
    "style":"dark",
    "tags":[],
    "templating":{
      "list":[
      ]
    },
    "time":{
    },
    "timezone":"browser",
    "title":"Home",
    "version":5
  },
  "meta":	{
    "isHome":true,
    "canSave":false,
    "canEdit":false,
    "canStar":false,
    "url":"",
    "expires":"0001-01-01T00:00:00Z",
    "created":"0001-01-01T00:00:00Z"
  }
}
```

## Tags for Dashboard

`GET /api/dashboards/tags`

Get all tags of dashboards

**Example Request**:

```http
GET /api/dashboards/tags HTTP/1.1
Accept: application/json
Content-Type: application/json
Authorization: Bearer eyJrIjoiT0tTcG1pUlY2RnVKZTFVaDFsNFZXdE9ZWmNrMkZYbk
```

**Example Response**:

```http
HTTP/1.1 200
Content-Type: application/json

[
  {
    "term":"tag1",
    "count":1
  },
  {
    "term":"tag2",
    "count":4
  }
]
```

## Dashboard Search

See [Folder/Dashboard Search API](../folder_dashboard_search/).

## APIs

### Unique identifier (uid) vs identifier (id)

The unique identifier (uid) of a dashboard can be used to uniquely identify a dashboard within a given org.
It's automatically generated if not provided when creating a dashboard. The uid allows having consistent URLs for accessing
dashboards and when syncing dashboards between multiple Grafana installs, see [dashboard provisioning](/docs/grafana/latest/administration/provisioning/#dashboards)
for more information. This means that changing the title of a dashboard will not break any bookmarked links to that dashboard.

The uid can have a maximum length of 40 characters.

The identifier (id) of a dashboard is deprecated in favor of the unique identifier (uid).

### Create / Update dashboard

`POST /api/dashboards/db`

Creates a new dashboard or updates an existing dashboard. When updating existing dashboards, if you do not define the `folderId` or the `folderUid` property, then the dashboard(s) are moved to the root level. (You need to define only one property, not both).

> **Note:** This endpoint is not intended for creating folders, use `POST /api/folders` for that.

**Required permissions**

See note in the [introduction](#dashboard-api) for an explanation.

<!-- prettier-ignore-start -->
| Action              | Scope                                                                                                   |
| ------------------- | ------------------------------------------------------------------------------------------------------- |
| `dashboards:create` | <ul><li>`folders:*`</li><li>`folders:uid:*`</li></ul>                                                   |
| `dashboards:write`  | <ul><li>`dashboards:*`</li><li>`dashboards:uid:*`</li><li>`folders:*`</li><li>`folders:uid:*`</li></ul> |
{ .no-spacing-list }
<!-- prettier-ignore-end -->

**Example Request for new dashboard**:

```http
POST /api/dashboards/db HTTP/1.1
Accept: application/json
Content-Type: application/json
Authorization: Bearer eyJrIjoiT0tTcG1pUlY2RnVKZTFVaDFsNFZXdE9ZWmNrMkZYbk

{
  "dashboard": {
    "id": null,
    "uid": null,
    "title": "Production Overview",
    "tags": [ "templated" ],
    "timezone": "browser",
    "schemaVersion": 16,
    "refresh": "25s"
  },
  "folderUid": "l3KqBxCMz",
  "message": "Made changes to xyz",
  "overwrite": false
}
```

JSON Body schema:

- **dashboard** – The complete dashboard model.
- **dashboard.id** – id = null to create a new dashboard.
- **dashboard.uid** – Optional unique identifier when creating a dashboard. uid = null will generate a new uid.
- **dashboard.refresh** - Set the dashboard refresh interval. If this is lower than [the minimum refresh interval](/docs/grafana/latest/setup-grafana/configure-grafana/#min_refresh_interval), then Grafana will ignore it and will enforce the minimum refresh interval.
- **folderId** – The id of the folder to save the dashboard in.
- **folderUid** – The UID of the folder to save the dashboard in. Overrides the `folderId`.
- **overwrite** – Set to true if you want to overwrite an existing dashboard with a given dashboard UID.
- **message** - Set a commit message for the version history.

**Example Request for updating a dashboard**:

```http
POST /api/dashboards/db HTTP/1.1
Accept: application/json
Content-Type: application/json
Authorization: Bearer eyJrIjoiT0tTcG1pUlY2RnVKZTFVaDFsNFZXdE9ZWmNrMkZYbk

{
  "dashboard": {
    "id": 1,
    "title": "Production Overview Updated",
    "tags": [ "templated" ],
    "timezone": "browser",
    "schemaVersion": 16,
    "version": 1,
    "refresh": "25s"
  },
  "folderUid": "l3KqBxCMz",
  "message": "Made changes to xyz",
  "overwrite": false
}
```

**Example Response**:

```http
HTTP/1.1 200 OK
Content-Type: application/json; charset=UTF-8
Content-Length: 78

{
    "id": 1,
    "uid": "e883f11b-77c0-4ee3-9a70-3ba223d66e56",
    "url": "/d/e883f11b-77c0-4ee3-9a70-3ba223d66e56/production-overview-updated",
    "status": "success",
    "version": 2
    "slug": "production-overview-updated",
}
```

Status Codes:

- **200** – Created
- **400** – Errors (invalid json, missing or invalid fields, etc)
- **401** – Unauthorized
- **403** – Access denied
- **412** – Precondition failed

The **412** status code is used for explaining that you cannot create the dashboard and why.
There can be different reasons for this:

- The dashboard has been changed by someone else, `status=version-mismatch`
- A dashboard with the same uid already exists, `status=name-exists`
- The dashboard belongs to plugin `<plugin title>`, `status=plugin-dashboard`

The response body will have the following properties:

```http
HTTP/1.1 412 Precondition Failed
Content-Type: application/json; charset=UTF-8
Content-Length: 97

{
  "message": "The dashboard has been changed by someone else",
  "status": "version-mismatch"
}
```

### Get dashboard by uid

`GET /api/dashboards/uid/:uid`

Will return the dashboard given the dashboard unique identifier (uid). Information about the unique identifier of a folder containing the requested dashboard might be found in the metadata.

**Required permissions**

See note in the [introduction](#dashboard-api) for an explanation.

<!-- prettier-ignore-start -->
| Action            | Scope                                                                                                   |
| ----------------- | ------------------------------------------------------------------------------------------------------- |
| `dashboards:read` | <ul><li>`dashboards:*`</li><li>`dashboards:uid:*`</li><li>`folders:*`</li><li>`folders:uid:*`</li></ul> |
{ .no-spacing-list }
<!-- prettier-ignore-end -->

**Example Request**:

```http
GET /api/dashboards/uid/cIBgcSjkk HTTP/1.1
Accept: application/json
Content-Type: application/json
Authorization: Bearer eyJrIjoiT0tTcG1pUlY2RnVKZTFVaDFsNFZXdE9ZWmNrMkZYbk
```

**Example Response**:

```http
HTTP/1.1 200
Content-Type: application/json

{
  "dashboard": {
    "id": 1,
    "uid": "cIBgcSjkk",
    "title": "Production Overview",
    "tags": [ "templated" ],
    "timezone": "browser",
    "schemaVersion": 16,
    "version": 0
  },
  "meta": {
    "isStarred": false,
    "url": "/d/cIBgcSjkk/production-overview",
    "folderId": 2,
    "folderUid": "l3KqBxCMz",
    "slug": "production-overview" //deprecated in Grafana v5.0
  }
}
```

Status Codes:

- **200** – Found
- **401** – Unauthorized
- **403** – Access denied
- **404** – Not found

### Delete dashboard by uid

`DELETE /api/dashboards/uid/:uid`

Will delete the dashboard given the specified unique identifier (uid).

**Required permissions**

See note in the [introduction](#dashboard-api) for an explanation.

<!-- prettier-ignore-start -->
| Action              | Scope                                                                                                   |
| ------------------- | ------------------------------------------------------------------------------------------------------- |
| `dashboards:delete` | <ul><li>`dashboards:*`</li><li>`dashboards:uid:*`</li><li>`folders:*`</li><li>`folders:uid:*`</li></ul> |
{ .no-spacing-list }
<!-- prettier-ignore-end -->

**Example Request**:

```http
DELETE /api/dashboards/uid/cIBgcSjkk HTTP/1.1
Accept: application/json
Content-Type: application/json
Authorization: Bearer eyJrIjoiT0tTcG1pUlY2RnVKZTFVaDFsNFZXdE9ZWmNrMkZYbk
```

**Example Response**:

```http
HTTP/1.1 200
Content-Type: application/json

{
  "title": "Production Overview",
  "message": "Dashboard Production Overview deleted",
  "id": 2
}
```

Status Codes:

- **200** – Deleted
- **401** – Unauthorized
- **403** – Access denied
- **404** – Not found
