---
canonical: https://grafana.com/docs/grafana/latest/developer-resources/api-reference/http-api/resource-history/
description: ''
keywords:
  - grafana
  - http
  - documentation
  - api
  - history
  - versioning
labels:
  products:
    - enterprise
    - oss
    - cloud
title: Resource history HTTP API
menuTitle: Resource History API
weight: 100
---

# Resource History HTTP API

{{< admonition type="note" >}}
Available in Grafana 12.0 and later.

This API complies with the new Grafana API structure. To learn more refer to documentation about the [API structure in Grafana](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/developer-resources/api-reference/http-api/apis/).

The legacy [Dashboard Versions API](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/developer-resources/api-reference/http-api/api-legacy/dashboard_versions/) is still available, and removal will be announced well in advance to avoid disruptions. Refer to [Migrate from the legacy Dashboard Versions API](#migrate-from-the-legacy-dashboard-versions-api) to learn more about how both APIs match, and how to migrate.

**This document may not contain the latest version of the API. For the most up-to-date list of available endpoints, refer to the specification of each API in [Swagger](https://play.grafana.org/swagger).**

{{< /admonition >}}

The new Grafana APIs track version history for resources. You can retrieve the history of any resource by using the standard List endpoint with specific query parameters. This page documents how to list resource history, using dashboards as an example. The same pattern applies to any resource.

**Resource history is available on all stable (GA) API versions (for example, `v1`, `v2`)**. Alpha or beta versions may not support it.

## Endpoints

These are the available endpoints:

| Method | Summary                                                     | URI                                                                                                                                       |
| ------ | ----------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| GET    | [List resource history](#list-resource-history)             | `/apis/{group}/{version}/namespaces/{namespace}/{resource}?labelSelector=grafana.app/get-history=true&fieldSelector=metadata.name=<NAME>` |
| GET    | [Retrieve a specific version](#retrieve-a-specific-version) | `/apis/{group}/{version}/namespaces/{namespace}/{resource}/{name}?resourceVersion=<RESOURCE_VERSION>`                                     |

## List resource history

`GET /apis/{group}/{version}/namespaces/{namespace}/{resource}?labelSelector=grafana.app/get-history=true&fieldSelector=metadata.name=<NAME>`

Lists the version history of a specific resource. This uses the standard List endpoint with two required query parameters.

**Path parameters**:

- `{group}`: The API group of the resource. For example, `dashboard.grafana.app`.
- `{version}`: The API version of the resource. For example, `v1`.
- `{namespace}`: To learn more about which namespace to use, refer to the [API overview](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/developer-resources/api-reference/http-api/apis/).
- `{resource}`: The resource type, in plural. For example, `dashboards`.

**Query parameters**:

- **`labelSelector`** (required): Must be set to `grafana.app/get-history=true` to request history instead of a normal list.
- **`fieldSelector`** (required): Must be set to `metadata.name=<NAME>` to identify the specific resource. `<NAME>` is the `metadata.name` field of the resource (the Grafana UID).
- **`limit`** (optional): Maximum number of history entries to return per page.
- **`continue`** (optional): Token from a previous response to fetch the next page.

History entries are returned in reverse chronological order (newest first).

### Example request

The following request retrieves the version history for a dashboard with `metadata.name` of `production-overview` in the `default` namespace:

```http
GET /apis/dashboard.grafana.app/v1/namespaces/default/dashboards?labelSelector=grafana.app/get-history=true&fieldSelector=metadata.name=production-overview HTTP/1.1
Accept: application/json
Content-Type: application/json
Authorization: Bearer <SERVICE_ACCOUNT_TOKEN>
```

### Example response

The following example shows the response:

```http
HTTP/1.1 200 OK
Content-Type: application/json

{
  "kind": "DashboardList",
  "apiVersion": "dashboard.grafana.app/v1",
  "metadata": {
    "resourceVersion": "1758777451428472",
    "continue": "eyJvIjoxNTIsInYiOjE3NjE3MDQyMjQyMDcxODksInMiOmZhbHNlfQ=="
  },
  "items": [
    {
      "kind": "Dashboard",
      "apiVersion": "dashboard.grafana.app/v1",
      "metadata": {
        "name": "production-overview",
        "namespace": "default",
        "uid": "a1b2c3d4-e5f6-7890-g1h2-i3j4k5l6m7n8",
        "resourceVersion": "1758777451428472",
        "generation": 3,
        "creationTimestamp": "2026-03-01T08:00:00Z",
        "annotations": {
          "grafana.app/updatedBy": "user:u000000001",
          "grafana.app/updatedTimestamp": "2026-03-15T14:22:10Z",
          "grafana.app/message": "Added latency panel"
        }
      },
      "spec": {
        "title": "Production Overview",
        "schemaVersion": 41,
        ...
      }
    },
    {
      "kind": "Dashboard",
      "apiVersion": "dashboard.grafana.app/v1",
      "metadata": {
        "name": "production-overview",
        "namespace": "default",
        "uid": "a1b2c3d4-e5f6-7890-g1h2-i3j4k5l6m7n8",
        "resourceVersion": "1758777451428100",
        "generation": 2,
        "creationTimestamp": "2026-03-01T08:00:00Z",
        "annotations": {
          "grafana.app/updatedBy": "user:u000000001",
          "grafana.app/updatedTimestamp": "2026-03-10T09:15:30Z",
          "grafana.app/message": "Updated thresholds"
        }
      },
      "spec": {
        "title": "Production Overview",
        "schemaVersion": 41,
        ...
      }
    }
  ]
}
```

Each item in the `items` array represents a historical version of the resource. The following metadata fields are especially relevant for history:

- **`metadata.generation`**: The version number. This increments each time the resource changes, for example when its spec changes or it moves to another folder.
- **`metadata.resourceVersion`**: A unique identifier for this specific version. Use this for pagination and change detection.
- **`metadata.creationTimestamp`**: When the resource was first created. This value is the same in every version.
- **`metadata.annotations.grafana.app/updatedTimestamp`**: When this specific version was saved. The first version doesn't have this annotation, so use `metadata.creationTimestamp` instead.
- **`metadata.annotations.grafana.app/updatedBy`**: The user who saved this version, in the format `<user-type>:<uid>`.
- **`metadata.annotations.grafana.app/message`**: An optional commit message set during the update. You can set this annotation when [updating a resource](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/developers/http_api/dashboard/#update-dashboard).
- **`spec`**: The full resource spec as it existed at that version.

### Status codes

- **200:** OK
- **400:** Bad request (missing `fieldSelector`, invalid `labelSelector`)
- **401:** Unauthorized
- **403:** Access denied

## Pagination

You can paginate through history using `limit` and `continue`, the same way you paginate a standard List request.

### Example request with pagination

The following example shows a request that returns two history entries per page:

```http
GET /apis/dashboard.grafana.app/v1/namespaces/default/dashboards?labelSelector=grafana.app/get-history=true&fieldSelector=metadata.name=production-overview&limit=2 HTTP/1.1
Accept: application/json
Content-Type: application/json
Authorization: Bearer <SERVICE_ACCOUNT_TOKEN>
```

If the response includes a `metadata.continue` field, pass it as the `continue` query parameter in the next request to fetch the next page. When the response doesn't include a `continue` field, you've reached the last page.

### Example request for the next page

The following example shows a request for the next page, using the `continue` token from the previous response:

```http
GET /apis/dashboard.grafana.app/v1/namespaces/default/dashboards?labelSelector=grafana.app/get-history=true&fieldSelector=metadata.name=production-overview&limit=2&continue=eyJvIjoxNTIsInYiOjE3NjE3MDQyMjQyMDcxODksInMiOmZhbHNlfQ== HTTP/1.1
Accept: application/json
Content-Type: application/json
Authorization: Bearer <SERVICE_ACCOUNT_TOKEN>
```

## Retrieve a specific version

To retrieve the full resource at a specific historical version, use the standard Get endpoint with the `resourceVersion` query parameter set to the `metadata.resourceVersion` from the history list.

### Example request

The following example shows a request to retrieve a specific version of a dashboard:

```http
GET /apis/dashboard.grafana.app/v1/namespaces/default/dashboards/production-overview?resourceVersion=1758777451428100 HTTP/1.1
Accept: application/json
Content-Type: application/json
Authorization: Bearer <SERVICE_ACCOUNT_TOKEN>
```

### Example response

This returns the complete resource as it existed at that version. For an example of a dashboard response, refer to [Get Dashboard](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/developer-resources/api-reference/http-api/dashboard/#get-dashboard).

### Status codes

- **200:** OK
- **400:** The resource version is newer than the latest version
- **401:** Unauthorized
- **403:** Access denied
- **404:** Resource or version not found

## Migrate from the legacy Dashboard Versions API

This API replaces the legacy [Dashboard Versions API](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/developer-resources/api-reference/http-api/api-legacy/dashboard_versions/) (`/api/dashboards/uid/:uid/versions`). The legacy API only works with dashboards, while this API works with any resource on a stable API version.

The following table describes how the legacy endpoints map to this API:

| Legacy endpoint                                  | Resource history endpoint                                                                                                                           |
| ------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GET /api/dashboards/uid/:uid/versions`          | `GET /apis/dashboard.grafana.app/v1/namespaces/{namespace}/dashboards?labelSelector=grafana.app/get-history=true&fieldSelector=metadata.name=<UID>` |
| `GET /api/dashboards/uid/:uid/versions/:version` | `GET /apis/dashboard.grafana.app/v1/namespaces/{namespace}/dashboards/<UID>?resourceVersion=<RESOURCE_VERSION>`                                     |

Consider the following differences:

- **Version identifier:** The legacy API identifies a version by its `version` number, which is the same value as `metadata.generation`. This API uses `metadata.resourceVersion` to retrieve a specific version. To find the `resourceVersion` of a version number, list the history and find the item whose `metadata.generation` matches that number.
- **Pagination:** The legacy `start` query parameter has no equivalent. The legacy `continueToken` query parameter and response field map to the `continue` query parameter and the `metadata.continue` field. For details, refer to [Pagination](#pagination).
- **Response format:** Each history item is a full resource object. The version details are in `metadata`, and the dashboard is in `spec`.
- **Users:** The legacy `createdBy` field contains the user's login. This API returns the user in the format `<user-type>:<uid>`.
- **Messages:** The legacy list endpoint replaces the message of the first version with `Initial save`. This API returns the stored message, which can be empty.

The following table describes how the legacy response fields map to this API:

| Legacy field    | Resource history field                                                                                                       |
| --------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| `id`            | `metadata.generation`                                                                                                        |
| `uid`           | `metadata.name`                                                                                                              |
| `dashboardId`   | `metadata.labels.grafana.app/deprecatedInternalID`                                                                           |
| `version`       | `metadata.generation`                                                                                                        |
| `parentVersion` | No equivalent. The value is `metadata.generation` minus 1.                                                                   |
| `restoredFrom`  | No equivalent. If the version is a restore, `metadata.annotations.grafana.app/message` is `Restored from version <VERSION>`. |
| `created`       | `metadata.annotations.grafana.app/updatedTimestamp`, or `metadata.creationTimestamp` if the annotation isn't set             |
| `createdBy`     | `metadata.annotations.grafana.app/updatedBy`, or `metadata.annotations.grafana.app/createdBy` for the first version          |
| `message`       | `metadata.annotations.grafana.app/message`                                                                                   |
| `data`          | `spec`                                                                                                                       |
