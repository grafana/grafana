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
This API complies with the new Grafana API structure. To learn more refer to documentation about the [API structure in Grafana](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/developer-resources/api-reference/http-api/apis).

This is an alpha API (`v0alpha1`) and might change. Availability depends on where you run Grafana:

- **Grafana Cloud:** The API is rolling out gradually and might not be available on your stack yet.
- **Self-managed Grafana:** The API is disabled by default. To enable it, set `enabled = true` in the [`[annotations.app_platform]`](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/setup-grafana/configure-grafana/#annotationsapp_platform) section of the Grafana configuration.

The legacy [Annotations API](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/developer-resources/api-reference/http-api/api-legacy/annotations/) (`/api/annotations`) remains available. To learn about the differences, refer to [Migrate from the legacy Annotations API](#migrate-from-the-legacy-annotations-api).
{{< /admonition >}}

Annotations mark points or regions in time with text and tags. An annotation that has a `dashboardUID` belongs to that dashboard, and can also belong to a single panel. An annotation without a `dashboardUID` is an organization annotation, which you can show on any dashboard that uses the Grafana annotations data source.

All paths use the `annotation.grafana.app` group and the `v0alpha1` version. Replace `:namespace` with your namespace. To learn more about which namespace to use, refer to the [API overview](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/developer-resources/api-reference/http-api/apis/).

## Requirements

If you are running Grafana Enterprise or Grafana Cloud, you need specific permissions. For more information, refer to [Role-based access control permissions](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/administration/roles-and-permissions/access-control/custom-role-actions-scopes/).

| Operation                          | Action               |
| ---------------------------------- | -------------------- |
| Get, list, search, and list tags   | `annotations:read`   |
| Create (including Graphite format) | `annotations:create` |
| Update and patch                   | `annotations:write`  |
| Delete                             | `annotations:delete` |

The scope you need depends on the annotation:

- **Organization annotations** (no `dashboardUID`): `annotations:*`, `annotations:type:*`, or `annotations:type:organization`.
- **Dashboard annotations**: `dashboards:*` or `dashboards:uid:<DASHBOARD_UID>`, or the equivalent `folders:*` or `folders:uid:<FOLDER_UID>` scope for the folder that contains the dashboard.

Listing tags requires `annotations:read` with an organization scope.

## The annotation resource

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

`GET /apis/annotation.grafana.app/v0alpha1/namespaces/:namespace/annotations`

Lists the annotations in the namespace, up to `limit` at a time. To filter annotations by time range, dashboard, panel, tags, or creator, use [Search annotations](#search-annotations).

**Example Request**:

```http
GET /apis/annotation.grafana.app/v0alpha1/namespaces/default/annotations?limit=2 HTTP/1.1
Accept: application/json
Authorization: Bearer <SERVICE_ACCOUNT_TOKEN>
```

**Example Response**:

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

`GET /apis/annotation.grafana.app/v0alpha1/namespaces/:namespace/search`

Finds annotations that match the query parameters. Results are returned most recent first. An annotation matches a time range when its `time` to `timeEnd` range overlaps the `from` to `to` range.

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

**Example Request**:

```http
GET /apis/annotation.grafana.app/v0alpha1/namespaces/default/search?dashboardUID=dashboard-uid-1&from=1759990000000&to=1760010000000&tag=deploy&limit=50 HTTP/1.1
Accept: application/json
Authorization: Bearer <SERVICE_ACCOUNT_TOKEN>
```

**Example Response**:

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

`GET /apis/annotation.grafana.app/v0alpha1/namespaces/:namespace/tags`

Lists the tags used by annotations, with the number of annotations that use each tag.

**Query parameters**:

- `contains`: string. Optional. Return only tags that contain this value.
- `limit`: integer. Optional. Maximum number of tags to return. Default is `100`.

**Example Request**:

```http
GET /apis/annotation.grafana.app/v0alpha1/namespaces/default/tags?contains=prod&limit=10 HTTP/1.1
Accept: application/json
Authorization: Bearer <SERVICE_ACCOUNT_TOKEN>
```

**Example Response**:

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

`GET /apis/annotation.grafana.app/v0alpha1/namespaces/:namespace/annotations/:name`

Retrieves an annotation by name.

- `name`: The `metadata.name` of the annotation.

**Example Request**:

```http
GET /apis/annotation.grafana.app/v0alpha1/namespaces/default/annotations/a-123 HTTP/1.1
Accept: application/json
Authorization: Bearer <SERVICE_ACCOUNT_TOKEN>
```

**Example Response**:

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

`POST /apis/annotation.grafana.app/v0alpha1/namespaces/:namespace/annotations`

Creates an annotation. Set `metadata.generateName` to `a-` and Grafana assigns the name. To create a region annotation, set `timeEnd`. To create an organization annotation, omit `dashboardUID`.

**Example Request**:

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

**Example Response**:

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

`POST /apis/annotation.grafana.app/v0alpha1/namespaces/:namespace/graphite`

Creates an organization annotation by using the Graphite-compatible event format. Grafana joins `what` and `data` into the annotation text, separated by a new line. The `tags` field can also be a string with multiple tags separated by a space.

**Required JSON body fields**:

- `what`: The title of the event.
- `tags`: The tags of the event, as an array of strings or a single string with the tags separated by spaces.

**Optional JSON body fields**:

- `when`: The time of the event, in Unix **seconds**. Defaults to the current time.
- `data`: More details about the event.

**Example Request**:

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

**Example Response**:

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

`PUT /apis/annotation.grafana.app/v0alpha1/namespaces/:namespace/annotations/:name`

Replaces an annotation. Provide the entire annotation, including `metadata.name` and `metadata.namespace`. You can change `text` and `tags`. The `time`, `timeEnd`, `dashboardUID`, and `panelID` values must match the existing annotation.

- `name`: The `metadata.name` of the annotation.

**Example Request**:

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

**Example Response**:

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

`PATCH /apis/annotation.grafana.app/v0alpha1/namespaces/:namespace/annotations/:name`

Updates only the fields you provide, using a JSON merge patch. The same restrictions as for [Update an annotation](#update-an-annotation) apply.

- `name`: The `metadata.name` of the annotation.

**Example Request**:

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

**Example Response**:

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

`DELETE /apis/annotation.grafana.app/v0alpha1/namespaces/:namespace/annotations/:name`

Deletes an annotation.

- `name`: The `metadata.name` of the annotation.

**Example Request**:

```http
DELETE /apis/annotation.grafana.app/v0alpha1/namespaces/default/annotations/a-123 HTTP/1.1
Accept: application/json
Authorization: Bearer <SERVICE_ACCOUNT_TOKEN>
```

**Example Response**:

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

| Code | Description                                                                                                            |
| ---- | ---------------------------------------------------------------------------------------------------------------------- |
| 400  | The request is invalid. For example, `time` is missing, `timeEnd` is before `time`, or an immutable field was changed. |
| 403  | You don't have permission to create, update, or delete the annotation.                                                 |
| 404  | The annotation doesn't exist.                                                                                          |

## Migrate from the legacy Annotations API

This API replaces the legacy [Annotations API](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/developer-resources/api-reference/http-api/api-legacy/annotations/) (`/api/annotations`).

Alert annotations aren't available in this API. Use the legacy API to work with them.

The following table describes how the legacy API maps to this API:

| Legacy API                                                            | New API                                                                                                                       |
| --------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| Annotation identified by numeric `id`.                                | Annotation identified by `metadata.name`.                                                                                     |
| `POST /api/annotations` returns `message` and `id`.                   | `POST /annotations` returns the created annotation.                                                                           |
| `GET /api/annotations` with query parameters.                         | `GET /search` with query parameters.                                                                                          |
| `dashboardId` and `dashboardUID`, `panelId`.                          | `dashboardUID` and `panelID`. `dashboardId` isn't supported.                                                                  |
| `tags` (repeated) and `matchAny`.                                     | `tag` (repeated) and `tagsMatchAny`.                                                                                          |
| `userId` filter.                                                      | `createdBy` filter, which takes a user UID.                                                                                   |
| `userId`, `userName`, `login`, `email`, and `avatarUrl` in responses. | The creator is in `metadata.annotations["grafana.app/createdBy"]`, in the format `user:<UID>`.                                |
| `alertId`, `alertName`, `newState`, `prevState`, and `type`.          | Not available.                                                                                                                |
| `data`.                                                               | Not available.                                                                                                                |
| `PUT` and `PATCH` can change `time` and `timeEnd`.                    | `PUT` and `PATCH` can change `text` and `tags`. `time`, `timeEnd`, `dashboardUID`, and `panelID` can't change after creation. |
| `GET /api/annotations/tags` with `tag` filter. Tags are in `result`.  | `GET /tags` with `contains` filter. Tags are at the top level of the response.                                                |
| `POST /api/annotations/mass-delete`.                                  | Not available. Delete annotations individually.                                                                               |
| `POST /api/annotations/graphite`.                                     | `POST /graphite`, with the same request body. The response is the created annotation.                                         |
