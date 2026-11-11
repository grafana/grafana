---
canonical: https://grafana.com/docs/grafana/latest/developer-resources/api-reference/http-api/notebooks/
description: Grafana Notebooks HTTP API
keywords:
  - grafana
  - http
  - documentation
  - api
  - notebook
  - notebooks
labels:
  products:
    - enterprise
    - oss
    - cloud
title: Notebooks HTTP API
weight: 100
---

# Notebooks HTTP API

{{< admonition type="note" >}}
Available in Grafana 13.2 and later.

This API complies with the new Grafana API structure. To learn more refer to documentation about the [API structure in Grafana](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/developer-resources/api-reference/http-api/apis/).

**This document may not contain the latest version of the API. For the most up-to-date list of available endpoints, refer to [dashboard.grafana.app/v2beta1](https://play.grafana.org/swagger?api=dashboard.grafana.app-v2beta1) in Swagger.**

This API is in `beta`, so it might change in future releases.

{{< /admonition >}}

Use this API to manage [notebooks](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/visualizations/notebooks/). A notebook combines text, code, and visualization panels in a single document, so you can investigate a problem, explain what you found, and share the supporting data with your team.

All paths use the `dashboard.grafana.app` group and the `v2beta1` version. Replace `{namespace}` with your namespace. To learn more about which namespace to use, refer to the [API overview](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/developer-resources/api-reference/http-api/apis/).

## Before you begin

**This API is in beta (`v2beta1`) and might change**. For more details about versioning, refer to [New API versioning](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/developer-resources/api-reference/http-api/apis#version).

Notebooks are in public preview and disabled by default. To enable them, turn on the `dashboard.notebooks` [feature toggle](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/setup-grafana/configure-grafana/feature-toggles/). If the feature toggle is off, requests to the endpoints on this page return `403`.

Notebooks can't be stored in folders. Requests that set the `grafana.app/folder` annotation are rejected.

## Requirements

You need the following permissions. For more information, refer to [Role-based access control permissions](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/administration/roles-and-permissions/access-control/custom-role-actions-scopes/).

| Operation        | Action             |
| ---------------- | ------------------ |
| Get and list     | `notebooks:read`   |
| Create           | `notebooks:create` |
| Update and patch | `notebooks:write`  |
| Delete           | `notebooks:delete` |

By default, Viewers can read all notebooks in the organization, and Editors can also create, update, and delete them.

## Endpoints

The following table lists the main endpoints. The Swagger documentation also includes endpoints to apply partial updates with `PATCH`, delete a collection of notebooks, search notebooks, and list notebook keys.

| Method | Summary                                 | URI                                                                           |
| ------ | --------------------------------------- | ----------------------------------------------------------------------------- |
| GET    | [List notebooks](#list-notebooks)       | `/apis/dashboard.grafana.app/v2beta1/namespaces/{namespace}/notebooks`        |
| GET    | [Get a notebook](#get-a-notebook)       | `/apis/dashboard.grafana.app/v2beta1/namespaces/{namespace}/notebooks/{name}` |
| POST   | [Create a notebook](#create-a-notebook) | `/apis/dashboard.grafana.app/v2beta1/namespaces/{namespace}/notebooks`        |
| PUT    | [Update a notebook](#update-a-notebook) | `/apis/dashboard.grafana.app/v2beta1/namespaces/{namespace}/notebooks/{name}` |
| DELETE | [Delete a notebook](#delete-a-notebook) | `/apis/dashboard.grafana.app/v2beta1/namespaces/{namespace}/notebooks/{name}` |

## Notebook structure

A notebook spec is similar to a [dashboard v2 spec](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/developer-resources/api-reference/http-api/dashboard/#use-the-v2-schema), but it uses a notebook layout. It has the following fields:

- **title** – The title of the notebook. If you create a notebook without a title, Grafana names it after the creation time, in UTC, for example `Notebook 2026-11-05 07:30`.
- **description** – Optional. The description of the notebook.
- **tags** – Tags associated with the notebook. Use `[]` for no tags.
- **timeSettings** – The default time range of the notebook. It uses the same fields as the dashboard v2 `timeSettings`, such as `from`, `to`, and `timezone`. Grafana always sets `hideTimepicker` to `false`.
- **elements** – A map of the notebook content, keyed by element name. Each element is one of the following:
  - **Cell** – Narrative content. `spec.content` is either a `Markdown` content with `text`, or a `Code` content with `language`, `code`, and, optionally, `highlight` (a list of line numbers) and `annotation`.
  - **Panel** – A visualization panel with its queries, in the dashboard v2 panel format.
  - **LibraryPanel** – A reference to a library panel.
- **layout** – The order of the elements. `kind` must be `NotebookLayout`, and Grafana rejects requests with dashboard layouts such as `GridLayout`. `spec.cells` is an ordered list of `NotebookLayoutItem` objects, each with the following fields:
  - **element** – A reference to an entry in `elements`, with `kind` set to `ElementReference` and `name` set to the element name.
  - **source** – Who authored the cell: `user` or `assistant`.
  - **collapsed** – Optional. Whether the cell body is hidden in the UI.

## List notebooks

`GET /apis/dashboard.grafana.app/v2beta1/namespaces/{namespace}/notebooks`

Returns the notebooks in the organization. Use the `limit` query parameter to control the maximum number of notebooks returned. To retrieve more notebooks, use the `continue` token from the response to fetch the next page.

**Path parameters**:

- `{namespace}`: To learn more about which namespace to use, refer to the [API overview](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/developer-resources/api-reference/http-api/apis/).

**Query parameters**:

- **`limit`** (optional): Maximum number of notebooks to return.
- **`continue`** (optional): Continue token from a previous response to fetch the next page.

**Required permissions**: `notebooks:read`

### Example request

The following example shows a request to list notebooks:

```http
GET /apis/dashboard.grafana.app/v2beta1/namespaces/default/notebooks?limit=1 HTTP/1.1
Accept: application/json
Authorization: Bearer <SERVICE_ACCOUNT_TOKEN>
```

### Example response

The following example shows the response:

```http
HTTP/1.1 200
Content-Type: application/json

{
  "kind": "NotebookList",
  "apiVersion": "dashboard.grafana.app/v2beta1",
  "metadata": {
    "resourceVersion": "1762327800000000",
    "continue": "eyJvIjoxNTIsInYiOjE3NjE3MDQyMjQyMDcxODksInMiOmZhbHNlfQ=="
  },
  "items": [
    {
      "kind": "Notebook",
      "apiVersion": "dashboard.grafana.app/v2beta1",
      "metadata": {
        "name": "high-latency-investigation",
        "namespace": "default",
        "resourceVersion": "1762327800000000",
        "creationTimestamp": "2026-11-05T07:30:00Z"
      },
      "spec": {
        "title": "High latency investigation",
        "tags": ["incident"],
        ...
      }
    }
  ]
}
```

### Status codes

- **200:** OK
- **401:** Unauthorized
- **403:** Access denied, or notebooks aren't enabled

## Get a notebook

`GET /apis/dashboard.grafana.app/v2beta1/namespaces/{namespace}/notebooks/{name}`

Returns the notebook with the given name.

**Path parameters**:

- `{namespace}`: To learn more about which namespace to use, refer to the [API overview](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/developer-resources/api-reference/http-api/apis/).
- `{name}`: The name of the notebook, from `metadata.name`.

**Required permissions**: `notebooks:read`

### Example request

The following example shows a request to get a notebook:

```http
GET /apis/dashboard.grafana.app/v2beta1/namespaces/default/notebooks/high-latency-investigation HTTP/1.1
Accept: application/json
Authorization: Bearer <SERVICE_ACCOUNT_TOKEN>
```

### Example response

The response contains the full notebook. For an example, refer to the response in [Create a notebook](#create-a-notebook).

### Status codes

- **200:** Found
- **401:** Unauthorized
- **403:** Access denied, or notebooks aren't enabled
- **404:** Not found

## Create a notebook

`POST /apis/dashboard.grafana.app/v2beta1/namespaces/{namespace}/notebooks`

Creates a notebook.

**Path parameters**:

- `{namespace}`: To learn more about which namespace to use, refer to the [API overview](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/developer-resources/api-reference/http-api/apis/).

**Required permissions**: `notebooks:create`

### Example request

The following notebook has a Markdown cell followed by a time series panel:

```http
POST /apis/dashboard.grafana.app/v2beta1/namespaces/default/notebooks HTTP/1.1
Accept: application/json
Content-Type: application/json
Authorization: Bearer <SERVICE_ACCOUNT_TOKEN>

{
  "metadata": {
    "name": "high-latency-investigation"
  },
  "spec": {
    "title": "High latency investigation",
    "tags": ["incident"],
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
      "cell-1": {
        "kind": "Cell",
        "spec": {
          "content": {
            "kind": "Markdown",
            "spec": {
              "text": "## Summary\nLatency increased after the 07:00 deployment."
            }
          }
        }
      },
      "panel-1": {
        "kind": "Panel",
        "spec": {
          "id": 1,
          "title": "Targets up",
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
      "kind": "NotebookLayout",
      "spec": {
        "cells": [
          {
            "kind": "NotebookLayoutItem",
            "spec": {
              "element": {
                "kind": "ElementReference",
                "name": "cell-1"
              },
              "source": "user"
            }
          },
          {
            "kind": "NotebookLayoutItem",
            "spec": {
              "element": {
                "kind": "ElementReference",
                "name": "panel-1"
              },
              "source": "user"
            }
          }
        ]
      }
    }
  }
}
```

JSON body schema:

- **metadata.name** – Optional. The unique identifier of the notebook. To let Grafana generate one, use `metadata.generateName` instead.
- **spec** – The notebook content. For details, refer to [Notebook structure](#notebook-structure).

### Example response

The following example shows the response:

```http
HTTP/1.1 201
Content-Type: application/json

{
  "kind": "Notebook",
  "apiVersion": "dashboard.grafana.app/v2beta1",
  "metadata": {
    "name": "high-latency-investigation",
    "namespace": "default",
    "uid": "b6b4ea2a-0d4b-4b6f-9a0b-5d2a1c0f0e11",
    "resourceVersion": "1762327800000000",
    "generation": 1,
    "creationTimestamp": "2026-11-05T07:30:00Z",
    "annotations": {
      "grafana.app/createdBy": "service-account:cef2t2rfm73lsb"
    }
  },
  "spec": {
    "title": "High latency investigation",
    "tags": ["incident"],
    ...
  }
}
```

### Status codes

- **201:** Created
- **400:** Errors (invalid JSON)
- **401:** Unauthorized
- **403:** Access denied, or notebooks aren't enabled
- **409:** Conflict (a notebook with the same name already exists)
- **422:** Invalid notebook, for example because it sets the `grafana.app/folder` annotation or has invalid cell IDs

## Update a notebook

`PUT /apis/dashboard.grafana.app/v2beta1/namespaces/{namespace}/notebooks/{name}`

Replaces the notebook with the given name. Send the full notebook, including `metadata.resourceVersion` from the latest version you read, to prevent overwriting changes made by other users.

**Path parameters**:

- `{namespace}`: To learn more about which namespace to use, refer to the [API overview](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/developer-resources/api-reference/http-api/apis/).
- `{name}`: The name of the notebook.

**Required permissions**: `notebooks:write`

### Example request

The following example shows a request to update a notebook:

```http
PUT /apis/dashboard.grafana.app/v2beta1/namespaces/default/notebooks/high-latency-investigation HTTP/1.1
Accept: application/json
Content-Type: application/json
Authorization: Bearer <SERVICE_ACCOUNT_TOKEN>

{
  "metadata": {
    "name": "high-latency-investigation",
    "resourceVersion": "1762327800000000"
  },
  "spec": {
    "title": "High latency investigation - resolved",
    "tags": ["incident", "resolved"],
    ...
  }
}
```

JSON body schema:

- **metadata.name** – The name of the notebook. It must match `name` in the path.
- **metadata.resourceVersion** – Optional. The resource version you're updating. If the notebook changed since you read it, the request fails with `409`.
- **spec** – The complete notebook content. For details, refer to [Notebook structure](#notebook-structure).

The response contains the updated notebook.

### Example response

The response contains the updated notebook. For an example, refer to the response in [Create a notebook](#create-a-notebook).

### Status codes

- **200:** Updated
- **201:** Created, if the notebook doesn't exist
- **400:** Errors (invalid JSON)
- **401:** Unauthorized
- **403:** Access denied, or notebooks aren't enabled
- **409:** Conflict (the notebook changed since you read it)
- **422:** Invalid notebook, for example because it sets the `grafana.app/folder` annotation or has invalid cell IDs

## Delete a notebook

`DELETE /apis/dashboard.grafana.app/v2beta1/namespaces/{namespace}/notebooks/{name}`

Deletes the notebook with the given name.

**Path parameters**:

- `{namespace}`: To learn more about which namespace to use, refer to the [API overview](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/developer-resources/api-reference/http-api/apis/).
- `{name}`: The name of the notebook.

**Required permissions**: `notebooks:delete`

### Example request

The following example shows a request to delete a notebook:

```http
DELETE /apis/dashboard.grafana.app/v2beta1/namespaces/default/notebooks/high-latency-investigation HTTP/1.1
Accept: application/json
Authorization: Bearer <SERVICE_ACCOUNT_TOKEN>
```

### Example response

The following example shows the response:

```http
HTTP/1.1 200
Content-Type: application/json

{
  "kind": "Status",
  "apiVersion": "v1",
  "metadata": {},
  "status": "Success",
  "details": {
    "name": "high-latency-investigation",
    "group": "dashboard.grafana.app",
    "kind": "notebooks",
    "uid": "b6b4ea2a-0d4b-4b6f-9a0b-5d2a1c0f0e11"
  }
}
```

### Status codes

- **200:** Deleted
- **401:** Unauthorized
- **403:** Access denied, or notebooks aren't enabled
- **404:** Not found
