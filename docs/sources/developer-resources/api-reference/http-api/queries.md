---
canonical: https://grafana.com/docs/grafana/latest/developer-resources/api-reference/http-api/queries/
description: Grafana Queries HTTP API
keywords:
  - grafana
  - http
  - documentation
  - api
  - queries
  - saved queries
  - query library
labels:
  products:
    - enterprise
    - cloud
title: Queries HTTP API
weight: 100
---

# Queries HTTP API

{{< admonition type="note" >}}
Available in Grafana 12.2 and later.

This API complies with the new Grafana API structure. To learn more refer to documentation about the [API structure in Grafana](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/developer-resources/api-reference/http-api/apis/).

The legacy [Query history API](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/developer-resources/api-reference/http-api/api-legacy/query_history/) is still available. This API is related to it, but it isn't a full replacement. Refer to [Differences from the legacy Query history API](#differences-from-the-legacy-query-history-api) to learn more about how both APIs match.

**This document may not contain the latest version of the API. For the most up-to-date list of available endpoints, refer to [queries.grafana.app/v1](https://play.grafana.org/swagger?api=queries.grafana.app-v1) in Swagger.**

{{< /admonition >}}

Use this API to manage [saved queries](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/visualizations/panels-visualizations/query-transform-data/#saved-queries), also known as the query library. A saved query stores one or more data source queries with a title, description, and tags, so you and your team can reuse them in Explore and dashboards.

All paths use the `queries.grafana.app` group and the `v1` version. Replace `{namespace}` with your namespace. To learn more about which namespace to use, refer to the [API overview](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/developer-resources/api-reference/http-api/apis/).

## Before you begin

Saved queries are only available in Grafana Enterprise and Grafana Cloud.

## Requirements

You need the following permissions. For more information, refer to [Role-based access control permissions](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/administration/roles-and-permissions/access-control/custom-role-actions-scopes/).

| Operation                  | Action          | Fixed role             |
| -------------------------- | --------------- | ---------------------- |
| Get and list               | `queries:read`  | `fixed:queries:reader` |
| Create, update, and delete | `queries:write` | `fixed:queries:writer` |

By default, the Viewer basic role includes `fixed:queries:reader`, and the Editor basic role includes `fixed:queries:writer`.

## Endpoints

The following table lists the main endpoints. The Swagger documentation also includes endpoints to search saved queries, delete a collection of saved queries, apply partial updates with `PATCH`, and render a saved query with its template variables replaced.

| Method | Summary                                       | URI                                                                  |
| ------ | --------------------------------------------- | -------------------------------------------------------------------- |
| GET    | [List saved queries](#list-saved-queries)     | `/apis/queries.grafana.app/v1/namespaces/{namespace}/queries`        |
| GET    | [Get a saved query](#get-a-saved-query)       | `/apis/queries.grafana.app/v1/namespaces/{namespace}/queries/{name}` |
| POST   | [Create a saved query](#create-a-saved-query) | `/apis/queries.grafana.app/v1/namespaces/{namespace}/queries`        |
| PUT    | [Update a saved query](#update-a-saved-query) | `/apis/queries.grafana.app/v1/namespaces/{namespace}/queries/{name}` |
| DELETE | [Delete a saved query](#delete-a-saved-query) | `/apis/queries.grafana.app/v1/namespaces/{namespace}/queries/{name}` |

## List saved queries

`GET /apis/queries.grafana.app/v1/namespaces/{namespace}/queries`

Returns the saved queries in the organization. Use the `limit` query parameter to control the maximum number of saved queries returned. To retrieve more saved queries, use the `continue` token from the response to fetch the next page.

**Path parameters**:

- `{namespace}`: To learn more about which namespace to use, refer to the [API overview](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/developer-resources/api-reference/http-api/apis/).

**Query parameters**:

- **`limit`** (optional): Maximum number of saved queries to return.
- **`continue`** (optional): Continue token from a previous response to fetch the next page.
- **`labelSelector`** (optional): Return only saved queries whose labels match the selector.

**Required permissions**: `queries:read`

### Example request

The following example shows a request to list saved queries:

```http
GET /apis/queries.grafana.app/v1/namespaces/default/queries?limit=1 HTTP/1.1
Accept: application/json
Authorization: Bearer <SERVICE_ACCOUNT_TOKEN>
```

### Example response

The following example shows the response:

```http
HTTP/1.1 200
Content-Type: application/json

{
  "kind": "QueryList",
  "apiVersion": "queries.grafana.app/v1",
  "metadata": {
    "continue": "eyJvIjoxNTIsInYiOjE3NjE3MDQyMjQyMDcxODksInMiOmZhbHNlfQ=="
  },
  "items": [
    {
      "kind": "Query",
      "apiVersion": "queries.grafana.app/v1",
      "metadata": {
        "name": "cpu-usage-by-instance",
        "namespace": "default",
        "uid": "65327fce-c545-489d-ada5-16f909453d12",
        "resourceVersion": "1762325460000",
        "creationTimestamp": "2026-11-05T06:51:00Z",
        "annotations": {
          "grafana.app/createdBy": "user:u000000001"
        }
      },
      "spec": {
        "title": "CPU usage by instance",
        "description": "Non-idle CPU usage, grouped by instance",
        "tags": ["cpu", "node"],
        "isVisible": true,
        "isLocked": false,
        "targets": [
          {
            "variables": {},
            "properties": {
              "refId": "A",
              "datasource": {
                "type": "prometheus",
                "uid": "prometheus-uid"
              },
              "expr": "sum by (instance) (rate(node_cpu_seconds_total{mode!=\"idle\"}[5m]))"
            }
          }
        ]
      }
    }
  ]
}
```

Continue making requests with the updated `continue` token until you receive a response without a `continue` field in the metadata, which means you've reached the last page.

### Status codes

- **200:** OK
- **401:** Unauthorized
- **403:** Access denied

## Get a saved query

`GET /apis/queries.grafana.app/v1/namespaces/{namespace}/queries/{name}`

Returns the saved query with the given name.

**Path parameters**:

- `{namespace}`: To learn more about which namespace to use, refer to the [API overview](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/developer-resources/api-reference/http-api/apis/).
- `{name}`: The unique identifier of the saved query. This is the `metadata.name` field in the saved query response.

**Required permissions**: `queries:read`

### Example request

The following example shows a request to get a saved query:

```http
GET /apis/queries.grafana.app/v1/namespaces/default/queries/cpu-usage-by-instance HTTP/1.1
Accept: application/json
Authorization: Bearer <SERVICE_ACCOUNT_TOKEN>
```

### Example response

The following example shows the response:

```http
HTTP/1.1 200
Content-Type: application/json

{
  "kind": "Query",
  "apiVersion": "queries.grafana.app/v1",
  "metadata": {
    "name": "cpu-usage-by-instance",
    "namespace": "default",
    "uid": "65327fce-c545-489d-ada5-16f909453d12",
    "resourceVersion": "1762325460000",
    "creationTimestamp": "2026-11-05T06:51:00Z",
    "annotations": {
      "grafana.app/createdBy": "user:u000000001"
    }
  },
  "spec": {
    "title": "CPU usage by instance",
    "description": "Non-idle CPU usage, grouped by instance",
    "tags": ["cpu", "node"],
    "isVisible": true,
    "isLocked": false,
    "targets": [
      {
        "variables": {},
        "properties": {
          "refId": "A",
          "datasource": {
            "type": "prometheus",
            "uid": "prometheus-uid"
          },
          "expr": "sum by (instance) (rate(node_cpu_seconds_total{mode!=\"idle\"}[5m]))"
        }
      }
    ]
  }
}
```

### Status codes

- **200:** Found
- **401:** Unauthorized
- **403:** Access denied
- **404:** Saved query not found, or you don't have query access to all referenced data sources

## Create a saved query

`POST /apis/queries.grafana.app/v1/namespaces/{namespace}/queries`

Creates a saved query.

**Path parameters**:

- `{namespace}`: To learn more about which namespace to use, refer to the [API overview](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/developer-resources/api-reference/http-api/apis/).

**Required permissions**: `queries:write`

### Example request

The following example shows a request to create a saved query:

```http
POST /apis/queries.grafana.app/v1/namespaces/default/queries HTTP/1.1
Accept: application/json
Content-Type: application/json
Authorization: Bearer <SERVICE_ACCOUNT_TOKEN>

{
  "metadata": {
    "generateName": "cpu-"
  },
  "spec": {
    "title": "CPU usage by instance",
    "description": "Non-idle CPU usage, grouped by instance",
    "tags": ["cpu", "node"],
    "isVisible": true,
    "isLocked": false,
    "targets": [
      {
        "variables": {},
        "properties": {
          "refId": "A",
          "datasource": {
            "type": "prometheus",
            "uid": "prometheus-uid"
          },
          "expr": "sum by (instance) (rate(node_cpu_seconds_total{mode!=\"idle\"}[5m]))"
        }
      }
    ]
  }
}
```

JSON body schema:

- **metadata.name** – The unique identifier of the saved query. If you don't want to provide one, set `metadata.generateName` to the prefix you want, and Grafana generates the rest of the name.
- **spec.title** – The title of the saved query.
- **spec.description** – A description of the saved query. Use an empty string if you don't want a description.
- **spec.tags** – A list of tags to organize and find the saved query. Use an empty list if you don't want tags.
- **spec.isVisible** – Whether the saved query is visible in the query library.
- **spec.isLocked** – Whether the saved query is shown as locked in the UI. This flag controls UI display only. Permissions are enforced separately.
- **spec.targets** – The data source queries to save.
  - **properties** – The query, in the format the data source plugin uses. Include `refId` and `datasource`.
  - **variables** – Where to replace template variables in the query. Use an empty object if the query doesn't use template variables.
- **spec.vars** – Optional. The template variables the saved query uses, each with a `key` and optional `defaultValues`.

### Example response

The following example shows the response:

```http
HTTP/1.1 201
Content-Type: application/json

{
  "kind": "Query",
  "apiVersion": "queries.grafana.app/v1",
  "metadata": {
    "name": "cpu-7xkq2",
    "namespace": "default",
    "uid": "a1f3c2e4-9b7d-4c1e-8f2a-3d5b6c7e8f90",
    "resourceVersion": "1762325460000",
    "creationTimestamp": "2026-11-05T06:51:00Z",
    "annotations": {
      "grafana.app/createdBy": "service-account:cef2t2rfm73lsb"
    }
  },
  "spec": {
    "title": "CPU usage by instance",
    "description": "Non-idle CPU usage, grouped by instance",
    "tags": ["cpu", "node"],
    "isVisible": true,
    "isLocked": false,
    "targets": [
      {
        "variables": {},
        "properties": {
          "refId": "A",
          "datasource": {
            "type": "prometheus",
            "uid": "prometheus-uid"
          },
          "expr": "sum by (instance) (rate(node_cpu_seconds_total{mode!=\"idle\"}[5m]))"
        }
      }
    ]
  }
}
```

### Status codes

- **201:** Created
- **400:** Errors (invalid JSON)
- **401:** Unauthorized
- **403:** Access denied, for example if you don't have query access to all referenced data sources
- **409:** Conflict (a saved query with the same `metadata.name` already exists)

## Update a saved query

`PUT /apis/queries.grafana.app/v1/namespaces/{namespace}/queries/{name}`

Replaces an existing saved query identified by name. Provide the full object, including `metadata.resourceVersion` from the latest version of the saved query.

**Path parameters**:

- `{namespace}`: To learn more about which namespace to use, refer to the [API overview](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/developer-resources/api-reference/http-api/apis/).
- `{name}`: The unique identifier of the saved query.

**Required permissions**: `queries:write`

### Example request

The following example shows a request to update a saved query:

```http
PUT /apis/queries.grafana.app/v1/namespaces/default/queries/cpu-usage-by-instance HTTP/1.1
Accept: application/json
Content-Type: application/json
Authorization: Bearer <SERVICE_ACCOUNT_TOKEN>

{
  "kind": "Query",
  "apiVersion": "queries.grafana.app/v1",
  "metadata": {
    "name": "cpu-usage-by-instance",
    "resourceVersion": "1762325460000"
  },
  "spec": {
    "title": "CPU usage by instance",
    "description": "Non-idle CPU usage over 1 minute, grouped by instance",
    "tags": ["cpu", "node"],
    "isVisible": true,
    "isLocked": true,
    "targets": [
      {
        "variables": {},
        "properties": {
          "refId": "A",
          "datasource": {
            "type": "prometheus",
            "uid": "prometheus-uid"
          },
          "expr": "sum by (instance) (rate(node_cpu_seconds_total{mode!=\"idle\"}[1m]))"
        }
      }
    ]
  }
}
```

### Example response

The following example shows the response:

```http
HTTP/1.1 200
Content-Type: application/json

{
  "kind": "Query",
  "apiVersion": "queries.grafana.app/v1",
  "metadata": {
    "name": "cpu-usage-by-instance",
    "namespace": "default",
    "uid": "65327fce-c545-489d-ada5-16f909453d12",
    "resourceVersion": "1762325999000",
    "creationTimestamp": "2026-11-05T06:51:00Z",
    "annotations": {
      "grafana.app/createdBy": "user:u000000001",
      "grafana.app/updatedBy": "service-account:cef2t2rfm73lsb",
      "grafana.app/updatedTimestamp": "2026-11-05T07:00:00Z"
    }
  },
  "spec": {
    "title": "CPU usage by instance",
    "description": "Non-idle CPU usage over 1 minute, grouped by instance",
    "tags": ["cpu", "node"],
    "isVisible": true,
    "isLocked": true,
    "targets": [
      {
        "variables": {},
        "properties": {
          "refId": "A",
          "datasource": {
            "type": "prometheus",
            "uid": "prometheus-uid"
          },
          "expr": "sum by (instance) (rate(node_cpu_seconds_total{mode!=\"idle\"}[1m]))"
        }
      }
    ]
  }
}
```

### Status codes

- **200:** Updated
- **400:** Errors (invalid JSON)
- **401:** Unauthorized
- **403:** Access denied, for example if you don't have query access to all referenced data sources in the updated query
- **404:** Saved query not found, or you don't have query access to all referenced data sources in the existing query
- **409:** Conflict (the saved query changed since you read it)

## Delete a saved query

`DELETE /apis/queries.grafana.app/v1/namespaces/{namespace}/queries/{name}`

Deletes an existing saved query identified by name. This operation can't be reverted.

**Path parameters**:

- `{namespace}`: To learn more about which namespace to use, refer to the [API overview](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/developer-resources/api-reference/http-api/apis/).
- `{name}`: The unique identifier of the saved query.

**Required permissions**: `queries:write`

### Example request

The following example shows a request to delete a saved query:

```http
DELETE /apis/queries.grafana.app/v1/namespaces/default/queries/cpu-usage-by-instance HTTP/1.1
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
  "code": 200
}
```

### Status codes

- **200:** Deleted
- **401:** Unauthorized
- **403:** Access denied
- **404:** Saved query not found, or you don't have query access to all referenced data sources

## Differences from the legacy Query history API

The Saved queries API and the legacy [Query history API](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/developer-resources/api-reference/http-api/api-legacy/query_history/) both store data source queries on the server, but they serve different purposes:

- **Query history** records the queries each user runs in Explore, so they can find them again later.
- **Saved queries** are queries you choose to save, with a title, description, and tags, and share with your organization.

If you use the Query history API to keep queries on the server, you can use the Saved queries API instead. The following table shows how the endpoints match:

| Legacy endpoint                                  | Saved queries endpoint                                                      |
| ------------------------------------------------ | --------------------------------------------------------------------------- |
| `POST /api/query-history`                        | `POST /apis/queries.grafana.app/v1/namespaces/{namespace}/queries`          |
| `GET /api/query-history`                         | `GET /apis/queries.grafana.app/v1/namespaces/{namespace}/queries`           |
| `PATCH /api/query-history/:uid`                  | `PATCH /apis/queries.grafana.app/v1/namespaces/{namespace}/queries/{name}`  |
| `DELETE /api/query-history/:uid`                 | `DELETE /apis/queries.grafana.app/v1/namespaces/{namespace}/queries/{name}` |
| `POST` and `DELETE /api/query-history/star/:uid` | No equivalent                                                               |

Consider the following differences:

- **Availability:** Saved queries are only available in Grafana Enterprise and Grafana Cloud.
- **Request body:** The legacy `datasourceUid` and `queries` fields map to `spec.targets`, where each target's `properties` contains one query, including its `datasource`. The legacy `comment` field maps to `spec.description`.
- **Search:** The legacy search parameters, such as `searchString`, `sort`, `onlyStarred`, and `from`/`to`, have no direct equivalent in the list endpoint. Use the search endpoint documented in Swagger to filter saved queries.
- **Stars:** Saved queries don't have a starred state.
