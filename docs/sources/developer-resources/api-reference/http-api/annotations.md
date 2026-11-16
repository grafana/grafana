---
canonical: https://grafana.com/docs/grafana/latest/developer-resources/api-reference/http-api/annotations/
description: Grafana Annotations HTTP API
keywords:
  - grafana
  - http
  - documentation
  - api
  - annotation
  - annotations
labels:
  products:
    - enterprise
    - oss
    - cloud
title: Annotations HTTP API
weight: 100
---

# Annotations API

{{< admonition type="note" >}}
Available in Grafana 12.4 and later.

This API complies with the new Grafana API structure. To learn more refer to documentation about the [API structure in Grafana](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/developer-resources/api-reference/http-api/apis/).

The legacy [Annotations API](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/developer-resources/api-reference/http-api/api-legacy/annotations/) is still available, and removal will be announced well in advance to avoid disruptions. Refer to [Migrate from the legacy Annotations API](#migrate-from-the-legacy-annotations-api) to learn more about how both APIs match, and how to migrate.

**This document may not contain the latest version of the API. For the most up-to-date list of available endpoints, refer to [annotation.grafana.app/v0alpha1](https://play.grafana.org/swagger?api=annotation.grafana.app-v0alpha1) in Swagger.**

This API is in `alpha`, so it might change in future releases.

{{< /admonition >}}

Annotations mark points or regions in time with text and tags. An annotation that has a `dashboardUID` belongs to that dashboard, and can also belong to a single panel. An annotation without a `dashboardUID` is an organization annotation, which you can show on any dashboard that uses the Grafana annotations data source.

## Before you begin

**This API is in alpha (`v0alpha1`) and might change**. For more details about versioning, refer to [New API versioning](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/developer-resources/api-reference/http-api/apis#version).

Availability depends on where you run Grafana:

- **Grafana Cloud:** The API is rolling out gradually and might not be available on your stack yet.
- **Self-managed Grafana:** The API is disabled by default. To enable it, set `enabled = true` in the [`[annotations.app_platform]`](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/setup-grafana/configure-grafana/#annotationsapp_platform) section of the Grafana configuration.

**Alert annotations aren't available in this API yet**

## Requirements

If you're running Grafana Enterprise or Grafana Cloud, you need the `annotations` action for the operation, such as `annotations:read` or `annotations:create`, with a scope that matches the annotation type:

- **Organization annotations** (no `dashboardUID`): `annotations:*`, `annotations:type:*`, or `annotations:type:organization`.
- **Dashboard annotations**: `dashboards:*` or `dashboards:uid:<DASHBOARD_UID>`, or the equivalent `folders:*` or `folders:uid:<FOLDER_UID>` scope for the folder that contains the dashboard.

Listing tags requires `annotations:read` with an organization scope. For the full list of actions and scopes, refer to [Role-based access control permissions](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/administration/roles-and-permissions/access-control/custom-role-actions-scopes/).

## Endpoints

These are the available endpoints:

**Base path:** `/apis/annotation.grafana.app/v0alpha1/namespaces/{namespace}/`

Replace `{namespace}` with your namespace. To learn which namespace to use, refer to the [API overview](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/developer-resources/api-reference/http-api/apis/).

| Method | Summary                                                                             | Path                 |
| ------ | ----------------------------------------------------------------------------------- | -------------------- |
| GET    | [List annotations](#list-annotations)                                               | `annotations`        |
| GET    | [Search annotations](#search-annotations)                                           | `search`             |
| GET    | [Find annotation tags](#find-annotation-tags)                                       | `tags`               |
| GET    | [Get an annotation](#get-an-annotation)                                             | `annotations/{name}` |
| POST   | [Create an annotation](#create-an-annotation)                                       | `annotations`        |
| POST   | [Create an annotation in Graphite format](#create-an-annotation-in-graphite-format) | `graphite`           |
| PUT    | [Update an annotation](#update-an-annotation)                                       | `annotations/{name}` |
| PATCH  | [Patch an annotation](#patch-an-annotation)                                         | `annotations/{name}` |
| DELETE | [Delete an annotation](#delete-an-annotation)                                       | `annotations/{name}` |

## The annotation resource

The following example shows an annotation resource:

```json
{
  "kind": "Annotation",
  "apiVersion": "annotation.grafana.app/v0alpha1",
  "metadata": {
    "name": "a-123",
    "namespace": "default",
    "annotations": {
      "grafana.app/createdBy": "user:abc123"
    }
  },
  "spec": {
    "text": "Deployed version 1.2.3",
    "time": 1760000000000,
    "timeEnd": 1760000000000,
    "dashboardUID": "dashboard-uid-1",
    "panelID": 2,
    "tags": ["deploy", "production"]
  }
}
```

`metadata.name` identifies the annotation in request paths. Grafana assigns it when you create the annotation, and sets `metadata.annotations["grafana.app/createdBy"]` to the user who created it.

The `spec` has the following fields:

| Field          | Type            | Required | Description                                                                                                                                                                  |
| -------------- | --------------- | -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `text`         | string          | Yes      | Text of the annotation.                                                                                                                                                      |
| `time`         | integer         | Yes      | Start time of the annotation, in Unix milliseconds. Must be greater than `0` and at most one week in the future.                                                             |
| `timeEnd`      | integer         | No       | End time of the annotation, in Unix milliseconds. Set it to make the annotation a region. Defaults to `time`. Must not be before `time` or more than one week in the future. |
| `dashboardUID` | string          | No       | UID of the dashboard the annotation belongs to. Omit it to create an organization annotation.                                                                                |
| `panelID`      | integer         | No       | ID of the panel the annotation belongs to, within the dashboard set by `dashboardUID`. Omit it to show the annotation on every panel of the dashboard.                       |
| `tags`         | array of string | No       | Tags used to categorize and filter annotations.                                                                                                                              |
| `scopes`       | array of string | No       | Names of the scopes the annotation applies to. Available in Grafana Cloud only. Self-managed Grafana ignores this field.                                                     |

The only fields you can update after creation are `text` and `tags`.

## List annotations

`GET /apis/annotation.grafana.app/v0alpha1/namespaces/{namespace}/annotations`

Lists the annotations in the namespace, up to `limit` at a time. To filter annotations by time range, dashboard, panel, tags, or creator, use [Search annotations](#search-annotations).

**Path parameters**:

- `{namespace}`: To learn more about which namespace to use, refer to the [API overview](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/developer-resources/api-reference/http-api/apis/).

### Example request

The following example shows a request to list annotations:

```http
GET /apis/annotation.grafana.app/v0alpha1/namespaces/default/annotations?limit=2 HTTP/1.1
Accept: application/json
Authorization: Bearer <SERVICE_ACCOUNT_TOKEN>
```

### Example response

The following example shows the response:

```http
HTTP/1.1 200
Content-Type: application/json

{
  "kind": "AnnotationList",
  "apiVersion": "annotation.grafana.app/v0alpha1",
  "metadata": {},
  "items": [
    {
      "kind": "Annotation",
      "apiVersion": "annotation.grafana.app/v0alpha1",
      "metadata": {
        "name": "a-123",
        "namespace": "default",
        "annotations": {
          "grafana.app/createdBy": "user:abc123"
        }
      },
      "spec": {
        "text": "Deployed version 1.2.3",
        "time": 1760000000000,
        "timeEnd": 1760000000000,
        "dashboardUID": "dashboard-uid-1",
        "panelID": 2,
        "tags": ["deploy", "production"]
      }
    }
  ]
}
```

## Search annotations

`GET /apis/annotation.grafana.app/v0alpha1/namespaces/{namespace}/search`

Finds annotations that match the query parameters. Results are returned most recent first. An annotation matches a time range when its `time` to `timeEnd` range overlaps the `from` to `to` range.

**Path parameters**:

- `{namespace}`: To learn more about which namespace to use, refer to the [API overview](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/developer-resources/api-reference/http-api/apis/).

**Query parameters**:

| Parameter        | Type    | Description                                                                                                                                                                                                |
| ---------------- | ------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `dashboardUID`   | string  | Optional. Return only annotations on the dashboard with this UID.                                                                                                                                          |
| `panelID`        | integer | Optional. Return only annotations on the panel with this ID.                                                                                                                                               |
| `from`           | integer | Optional. Start of the time range, in Unix milliseconds.                                                                                                                                                   |
| `to`             | integer | Optional. End of the time range, in Unix milliseconds.                                                                                                                                                     |
| `limit`          | integer | Optional. Maximum number of annotations to return in one page. Default is `100`.                                                                                                                           |
| `continue`       | string  | Optional. The `metadata.continue` value from the previous page. Use it with the same `limit` as the request that returned it.                                                                              |
| `tag`            | string  | Optional. Return only annotations with this tag. Repeat the parameter to filter by several tags.                                                                                                           |
| `tagsMatchAny`   | boolean | Optional. If `true`, return annotations that have any of the tags. If `false`, an annotation must have all of them. Default is `false`.                                                                    |
| `createdBy`      | string  | Optional. Return only annotations created by the user with this UID.                                                                                                                                       |
| `scope`          | string  | Optional. Return only annotations with this scope. Repeat the parameter to filter by several scopes. Available in Grafana Cloud only. Self-managed Grafana ignores it.                                     |
| `scopesMatchAny` | boolean | Optional. If `true`, return annotations that have any of the scopes. If `false`, an annotation must have all of them. Default is `true`. Available in Grafana Cloud only. Self-managed Grafana ignores it. |

### Example request

The following example shows a request to search annotations:

```http
GET /apis/annotation.grafana.app/v0alpha1/namespaces/default/search?dashboardUID=dashboard-uid-1&from=1759990000000&to=1760010000000&tag=deploy&limit=50 HTTP/1.1
Accept: application/json
Authorization: Bearer <SERVICE_ACCOUNT_TOKEN>
```

### Example response

The following example shows the response:

```http
HTTP/1.1 200
Content-Type: application/json

{
  "metadata": {
    "continue": "<CONTINUE_TOKEN>"
  },
  "items": [
    {
      "metadata": {
        "name": "a-123",
        "namespace": "default",
        "annotations": {
          "grafana.app/createdBy": "user:abc123"
        }
      },
      "spec": {
        "text": "Deployed version 1.2.3",
        "time": 1760000000000,
        "timeEnd": 1760000000000,
        "dashboardUID": "dashboard-uid-1",
        "panelID": 2,
        "tags": ["deploy", "production"]
      }
    }
  ]
}
```

If `metadata.continue` is empty or missing, there are no more results. Otherwise, pass its value as the `continue` parameter to get the next page.

## Find annotation tags

`GET /apis/annotation.grafana.app/v0alpha1/namespaces/{namespace}/tags`

Lists the tags used by annotations, with the number of annotations that use each tag.

**Path parameters**:

- `{namespace}`: To learn more about which namespace to use, refer to the [API overview](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/developer-resources/api-reference/http-api/apis/).

**Query parameters**:

- `contains`: string. Optional. Return only tags that contain this value.
- `limit`: integer. Optional. Maximum number of tags to return. Default is `100`.

### Example request

The following example shows a request to find annotation tags:

```http
GET /apis/annotation.grafana.app/v0alpha1/namespaces/default/tags?contains=prod&limit=10 HTTP/1.1
Accept: application/json
Authorization: Bearer <SERVICE_ACCOUNT_TOKEN>
```

### Example response

The following example shows the response:

```http
HTTP/1.1 200
Content-Type: application/json

{
  "tags": [
    {
      "tag": "production",
      "count": 12
    }
  ]
}
```

## Get an annotation

`GET /apis/annotation.grafana.app/v0alpha1/namespaces/{namespace}/annotations/{name}`

Retrieves an annotation by name.

**Path parameters**:

- `{namespace}`: To learn more about which namespace to use, refer to the [API overview](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/developer-resources/api-reference/http-api/apis/).
- `{name}`: The `metadata.name` of the annotation.

### Example request

The following example shows a request to get an annotation:

```http
GET /apis/annotation.grafana.app/v0alpha1/namespaces/default/annotations/a-123 HTTP/1.1
Accept: application/json
Authorization: Bearer <SERVICE_ACCOUNT_TOKEN>
```

### Example response

The following example shows the response:

```http
HTTP/1.1 200
Content-Type: application/json

{
  "kind": "Annotation",
  "apiVersion": "annotation.grafana.app/v0alpha1",
  "metadata": {
    "name": "a-123",
    "namespace": "default",
    "annotations": {
      "grafana.app/createdBy": "user:abc123"
    }
  },
  "spec": {
    "text": "Deployed version 1.2.3",
    "time": 1760000000000,
    "timeEnd": 1760000000000,
    "dashboardUID": "dashboard-uid-1",
    "panelID": 2,
    "tags": ["deploy", "production"]
  }
}
```

## Create an annotation

`POST /apis/annotation.grafana.app/v0alpha1/namespaces/{namespace}/annotations`

Creates an annotation. Set `metadata.generateName` to `a-` and Grafana assigns the name. To create a region annotation, set `timeEnd`. To create an organization annotation, omit `dashboardUID`.

**Path parameters**:

- `{namespace}`: To learn more about which namespace to use, refer to the [API overview](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/developer-resources/api-reference/http-api/apis/).

### Example request

The following example shows a request to create an annotation:

```http
POST /apis/annotation.grafana.app/v0alpha1/namespaces/default/annotations HTTP/1.1
Accept: application/json
Content-Type: application/json
Authorization: Bearer <SERVICE_ACCOUNT_TOKEN>

{
  "kind": "Annotation",
  "apiVersion": "annotation.grafana.app/v0alpha1",
  "metadata": {
    "generateName": "a-"
  },
  "spec": {
    "text": "Deployed version 1.2.3",
    "time": 1760000000000,
    "dashboardUID": "dashboard-uid-1",
    "panelID": 2,
    "tags": ["deploy", "production"]
  }
}
```

### Example response

The following example shows the response:

```http
HTTP/1.1 201 Created
Content-Type: application/json

{
  "kind": "Annotation",
  "apiVersion": "annotation.grafana.app/v0alpha1",
  "metadata": {
    "name": "a-123",
    "namespace": "default",
    "annotations": {
      "grafana.app/createdBy": "user:abc123"
    }
  },
  "spec": {
    "text": "Deployed version 1.2.3",
    "time": 1760000000000,
    "timeEnd": 1760000000000,
    "dashboardUID": "dashboard-uid-1",
    "panelID": 2,
    "tags": ["deploy", "production"]
  }
}
```

## Create an annotation in Graphite format

`POST /apis/annotation.grafana.app/v0alpha1/namespaces/{namespace}/graphite`

Creates an organization annotation by using the Graphite-compatible event format. Grafana joins `what` and `data` into the annotation text, separated by a new line. The `tags` field can also be a string with multiple tags separated by a space.

**Path parameters**:

- `{namespace}`: To learn more about which namespace to use, refer to the [API overview](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/developer-resources/api-reference/http-api/apis/).

**Required JSON body fields**:

- `what`: The title of the event.
- `tags`: The tags of the event, as an array of strings or a single string with the tags separated by spaces.

**Optional JSON body fields**:

- `when`: The time of the event, in Unix **seconds**. Defaults to the current time.
- `data`: More details about the event.

### Example request

The following example shows a request to create an annotation in Graphite format:

```http
POST /apis/annotation.grafana.app/v0alpha1/namespaces/default/graphite HTTP/1.1
Accept: application/json
Content-Type: application/json
Authorization: Bearer <SERVICE_ACCOUNT_TOKEN>

{
  "what": "Event - deploy",
  "tags": ["deploy", "production"],
  "when": 1760000000,
  "data": "version 1.2.3"
}
```

### Example response

The following example shows the response:

```http
HTTP/1.1 200
Content-Type: application/json

{
  "kind": "Annotation",
  "apiVersion": "annotation.grafana.app/v0alpha1",
  "metadata": {
    "name": "a-124",
    "namespace": "default",
    "annotations": {
      "grafana.app/createdBy": "user:abc123"
    }
  },
  "spec": {
    "text": "Event - deploy\nversion 1.2.3",
    "time": 1760000000000,
    "timeEnd": 1760000000000,
    "tags": ["deploy", "production"]
  }
}
```

## Update an annotation

`PUT /apis/annotation.grafana.app/v0alpha1/namespaces/{namespace}/annotations/{name}`

Replaces an annotation. Provide the entire annotation, including `metadata.name` and `metadata.namespace`. You can only change `text` and `tags`. The `time`, `timeEnd`, `dashboardUID`, and `panelID` values must match the existing annotation, and you can't modify them after creation.

**Path parameters**:

- `{namespace}`: To learn more about which namespace to use, refer to the [API overview](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/developer-resources/api-reference/http-api/apis/).
- `{name}`: The `metadata.name` of the annotation.

### Example request

The following example shows a request to update an annotation:

```http
PUT /apis/annotation.grafana.app/v0alpha1/namespaces/default/annotations/a-123 HTTP/1.1
Accept: application/json
Content-Type: application/json
Authorization: Bearer <SERVICE_ACCOUNT_TOKEN>

{
  "kind": "Annotation",
  "apiVersion": "annotation.grafana.app/v0alpha1",
  "metadata": {
    "name": "a-123",
    "namespace": "default"
  },
  "spec": {
    "text": "Deployed version 1.2.4",
    "time": 1760000000000,
    "timeEnd": 1760000000000,
    "dashboardUID": "dashboard-uid-1",
    "panelID": 2,
    "tags": ["deploy", "production", "hotfix"]
  }
}
```

### Example response

The following example shows the response:

```http
HTTP/1.1 200 OK
Content-Type: application/json

{
  "kind": "Annotation",
  "apiVersion": "annotation.grafana.app/v0alpha1",
  "metadata": {
    "name": "a-123",
    "namespace": "default",
    "annotations": {
      "grafana.app/createdBy": "user:abc123"
    }
  },
  "spec": {
    "text": "Deployed version 1.2.4",
    "time": 1760000000000,
    "timeEnd": 1760000000000,
    "dashboardUID": "dashboard-uid-1",
    "panelID": 2,
    "tags": ["deploy", "production", "hotfix"]
  }
}
```

## Patch an annotation

`PATCH /apis/annotation.grafana.app/v0alpha1/namespaces/{namespace}/annotations/{name}`

Updates only the fields you provide, using a JSON merge patch. The same restrictions as for [Update an annotation](#update-an-annotation) apply: You can only change `text` and `tags`, and you can't modify `time`, `timeEnd`, `dashboardUID`, and `panelID` after creation.

**Path parameters**:

- `{namespace}`: To learn more about which namespace to use, refer to the [API overview](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/developer-resources/api-reference/http-api/apis/).
- `{name}`: The `metadata.name` of the annotation.

### Example request

The following example shows a request to patch an annotation:

```http
PATCH /apis/annotation.grafana.app/v0alpha1/namespaces/default/annotations/a-123 HTTP/1.1
Accept: application/json
Content-Type: application/merge-patch+json
Authorization: Bearer <SERVICE_ACCOUNT_TOKEN>

{
  "spec": {
    "text": "Deployed version 1.2.4",
    "tags": ["deploy", "hotfix"]
  }
}
```

### Example response

The following example shows the response:

```http
HTTP/1.1 200 OK
Content-Type: application/json

{
  "kind": "Annotation",
  "apiVersion": "annotation.grafana.app/v0alpha1",
  "metadata": {
    "name": "a-123",
    "namespace": "default",
    "annotations": {
      "grafana.app/createdBy": "user:abc123"
    }
  },
  "spec": {
    "text": "Deployed version 1.2.4",
    "time": 1760000000000,
    "timeEnd": 1760000000000,
    "dashboardUID": "dashboard-uid-1",
    "panelID": 2,
    "tags": ["deploy", "hotfix"]
  }
}
```

## Delete an annotation

`DELETE /apis/annotation.grafana.app/v0alpha1/namespaces/{namespace}/annotations/{name}`

Deletes an annotation.

**Path parameters**:

- `{namespace}`: To learn more about which namespace to use, refer to the [API overview](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/developer-resources/api-reference/http-api/apis/).
- `{name}`: The `metadata.name` of the annotation.

### Example request

The following example shows a request to delete an annotation:

```http
DELETE /apis/annotation.grafana.app/v0alpha1/namespaces/default/annotations/a-123 HTTP/1.1
Accept: application/json
Authorization: Bearer <SERVICE_ACCOUNT_TOKEN>
```

### Example response

The following example shows the response:

```http
HTTP/1.1 200 OK
Content-Type: application/json

{
  "kind": "Status",
  "apiVersion": "v1",
  "metadata": {},
  "status": "Success",
  "code": 200
}
```

## Status codes

The endpoints on this page return the following status codes:

| Code  | Meaning                                                                                                                                                                      | Returned by                                                                                                                                                                                                                                                                                              |
| ----- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `200` | OK.                                                                                                                                                                          | [List](#list-annotations), [Search](#search-annotations), [Find](#find-annotation-tags), [Get](#get-an-annotation), [Create an annotation in Graphite format](#create-an-annotation-in-graphite-format), [Update](#update-an-annotation), [Patch](#patch-an-annotation), [Delete](#delete-an-annotation) |
| `201` | Created.                                                                                                                                                                     | [Create an annotation](#create-an-annotation)                                                                                                                                                                                                                                                            |
| `400` | The request is invalid. For example, `time` is missing, `timeEnd` is before `time`, or neither `metadata.name` nor `metadata.generateName` is set.                           | [Create an annotation](#create-an-annotation)                                                                                                                                                                                                                                                            |
| `400` | The request is invalid. For example, `what` is empty, `tags` has an invalid format, or `when` is more than one week in the future.                                           | [Create an annotation in Graphite format](#create-an-annotation-in-graphite-format)                                                                                                                                                                                                                      |
| `400` | The request is invalid. For example, `time` is missing, `timeEnd` is before `time`, or an immutable field was changed.                                                       | [Update](#update-an-annotation)                                                                                                                                                                                                                                                                          |
| `400` | The request is invalid. For example, the patch isn't valid JSON or changes an immutable field.                                                                               | [Patch](#patch-an-annotation)                                                                                                                                                                                                                                                                            |
| `400` | The request is invalid. For example, a selector isn't supported, or the `continue` token isn't valid or doesn't match `limit`.                                               | [List](#list-annotations), [Search](#search-annotations)                                                                                                                                                                                                                                                 |
| `400` | The request is invalid. For example, the query parameters can't be combined.                                                                                                 | [Find](#find-annotation-tags)                                                                                                                                                                                                                                                                            |
| `401` | Unauthorized.                                                                                                                                                                | All endpoints                                                                                                                                                                                                                                                                                            |
| `403` | Access denied (for [List](#list-annotations), [Search](#search-annotations), and [Get](#get-an-annotation), only if the namespace doesn't belong to your organization).      | All endpoints                                                                                                                                                                                                                                                                                            |
| `404` | The annotation doesn't exist, or you don't have access to it.                                                                                                                | [Get](#get-an-annotation)                                                                                                                                                                                                                                                                                |
| `404` | The annotation doesn't exist.                                                                                                                                                | [Update](#update-an-annotation), [Patch](#patch-an-annotation)                                                                                                                                                                                                                                           |
| `404` | The annotation doesn't exist, or you don't have read access to it.                                                                                                           | [Delete](#delete-an-annotation)                                                                                                                                                                                                                                                                          |
| `409` | Conflict (an annotation with the same `metadata.name` already exists).                                                                                                       | [Create an annotation](#create-an-annotation)                                                                                                                                                                                                                                                            |
| `410` | The annotation was deleted. Only storage backends that keep deleted annotations return this code. With the default `legacy-sql` backend, a deleted annotation returns `404`. | [Get](#get-an-annotation), [Update](#update-an-annotation), [Patch](#patch-an-annotation)                                                                                                                                                                                                                |

## Migrate from the legacy Annotations API

This API replaces the legacy [Annotations API](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/developer-resources/api-reference/http-api/api-legacy/annotations/) (`/api/annotations`).

**Alert annotations aren't available in this API yet**. For the moment, use the legacy API to work with them.

The following table describes how the legacy API maps to this API:

| Legacy API                                                            | New API                                                                                                                           |
| --------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| Annotation identified by numeric `id`.                                | Annotation identified by `metadata.name`.                                                                                         |
| `POST /api/annotations` returns `message` and `id`.                   | `POST /annotations` returns the created annotation.                                                                               |
| `GET /api/annotations` with query parameters.                         | `GET /search` with query parameters.                                                                                              |
| `dashboardId` and `dashboardUID`, `panelId`.                          | `dashboardUID` and `panelID`. `dashboardId` isn't supported.                                                                      |
| `tags` (repeated) and `matchAny`.                                     | `tag` (repeated) and `tagsMatchAny`.                                                                                              |
| `userId` filter.                                                      | `createdBy` filter, which takes a user UID.                                                                                       |
| `userId`, `userName`, `login`, `email`, and `avatarUrl` in responses. | The creator is in `metadata.annotations["grafana.app/createdBy"]`, in the format `user:<UID>`.                                    |
| `alertId`, `alertName`, `newState`, `prevState`, and `type`.          | Not available.                                                                                                                    |
| `data`.                                                               | Not available.                                                                                                                    |
| `PUT` and `PATCH` can change `time` and `timeEnd`.                    | `PUT` and `PATCH` can update `text` and `tags`. You can't modify `time`, `timeEnd`, `dashboardUID`, and `panelID` after creation. |
| `GET /api/annotations/tags` with `tag` filter. Tags are in `result`.  | `GET /tags` with `contains` filter. Tags are at the top level of the response.                                                    |
| `POST /api/annotations/mass-delete`.                                  | Not available. Delete annotations individually.                                                                                   |
| `POST /api/annotations/graphite`.                                     | `POST /graphite`, with the same request body. The response is the created annotation.                                             |
