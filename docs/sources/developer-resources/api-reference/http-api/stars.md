---
aliases:
canonical: https://grafana.com/docs/grafana/latest/developer-resources/api-reference/http-api/stars/
description: Grafana Collections HTTP API
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
title: Collections HTTP API
weight: 100
---

# Collections HTTP API

{{< admonition type="note" >}}
Available in Grafana 13.0 and later.

This API complies with the new Grafana API structure. To learn more refer to documentation about the [API structure in Grafana](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/developer-resources/api-reference/http-api/apis/).

This API replaces the legacy `POST` and `DELETE` `/api/user/stars/dashboard/uid/{dashboard_uid}` endpoints of the [User API](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/developer-resources/api-reference/http-api/api-legacy/user/#star-a-dashboard). They're deprecated but still available, and removal will be announced well in advance to avoid disruptions. Refer to [Migration steps](#migration-steps) to learn more about how both APIs match, and how to migrate.

**This document may not contain the latest version of the API. For the most up-to-date list of available endpoints, refer to [collections.grafana.app/v1alpha1](https://play.grafana.org/swagger?api=collections.grafana.app-v1alpha1) in Swagger.**

This API is in `alpha`, so it might change in future releases.

{{< /admonition >}}

The Collections API, `/apis/collections.grafana.app/*`, is designed to group Grafana resources into collections. At the moment, it offers stars: you can star and unstar your resources in Grafana, and manage the list of resources that a user has starred.

**Use the Collections API for any new integrations**.

## Endpoints

These are the available endpoints:

| Method | Summary                                 | URI                                                                                                     | Replaced endpoint                             |
| ------ | --------------------------------------- | ------------------------------------------------------------------------------------------------------- | --------------------------------------------- |
| PUT    | [Star a resource](#star-a-resource)     | `/apis/collections.grafana.app/v1alpha1/namespaces/{namespace}/stars/{name}/update/{group}/{kind}/{id}` | /api/user/stars/dashboard/uid/{dashboard_uid} |
| DELETE | [Unstar a resource](#unstar-a-resource) | `/apis/collections.grafana.app/v1alpha1/namespaces/{namespace}/stars/{name}/update/{group}/{kind}/{id}` | /api/user/stars/dashboard/uid/{dashboard_uid} |
| GET    | [List stars](#list-stars)               | `/apis/collections.grafana.app/v1alpha1/namespaces/{namespace}/stars`                                   |                                               |
| GET    | [Get stars](#get-stars)                 | `/apis/collections.grafana.app/v1alpha1/namespaces/{namespace}/stars/{name}`                            |                                               |
| POST   | [Create stars](#create-stars)           | `/apis/collections.grafana.app/v1alpha1/namespaces/{namespace}/stars`                                   |                                               |
| PUT    | [Replace stars](#replace-stars)         | `/apis/collections.grafana.app/v1alpha1/namespaces/{namespace}/stars/{name}`                            |                                               |
| PATCH  | [Patch stars](#patch-stars)             | `/apis/collections.grafana.app/v1alpha1/namespaces/{namespace}/stars/{name}`                            |                                               |
| DELETE | [Delete stars](#delete-stars)           | `/apis/collections.grafana.app/v1alpha1/namespaces/{namespace}/stars/{name}`                            |                                               |

## Star a resource

`PUT /apis/collections.grafana.app/v1alpha1/namespaces/{namespace}/stars/{name}/update/{group}/{kind}/{id}`

Stars a resource for the signed-in user. One endpoint shape covers every starrable resource instead of one endpoint per kind. `{group}`, `{kind}`, and `{id}` identify the resource to star.

**Path parameters**:

- `{namespace}`: To learn more about which namespace to use, refer to the [API overview](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/developer-resources/api-reference/http-api/apis/).
- `{name}`: The name of the `Stars` resource of the signed-in user, in the format `user-{user_uid}`. For example, `user-a1b2c3d4`. Organization administrators can also use the `Stars` resource of another user in the organization.
  - `{user_uid}` is the signed-in user's UID, not their username or numeric ID. Look this up from the UID field returned by GET /api/user. Refer to [Migration steps](#migration-steps) for more details.
- `{group}`: The API group of the resource, in the format `<RESOURCE>.grafana.app`. For example, `dashboard.grafana.app` or `folder.grafana.app`.
- `{kind}`: The kind of the resource. For example, `Dashboard` or `Folder`.
- `{id}`: The resource UID, which has the same value used in the legacy path.

### Example request

None. The star target is fully encoded in the URL path; no JSON body is required or read.

### Example response

The response is a `Status` object, not the updated `Stars` resource. To get the updated `Stars` resource, use [Get stars](#get-stars). The following example shows the response:

```http
HTTP/1.1 200 OK
Content-Type: application/json

{
  "kind": "Status",
  "apiVersion": "v1",
  "metadata": {},
  "code": 200
}
```

### Status codes

- **200:** OK
- **400:** Bad request (the path doesn't end with `{group}/{kind}/{id}`)
- **401:** Unauthorized
- **403:** Access denied (the `Stars` resource belongs to another user, and you aren't an organization administrator)

## Unstar a resource

`DELETE /apis/collections.grafana.app/v1alpha1/namespaces/{namespace}/stars/{name}/update/{group}/{kind}/{id}`

Unstars a resource for the signed-in user. `{group}`, `{kind}`, and `{id}` identify the resource to unstar. If you unstar the last starred resource, Grafana deletes the `Stars` resource.

**Path parameters**:

- `{namespace}`: To learn more about which namespace to use, refer to the [API overview](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/developer-resources/api-reference/http-api/apis/).
- `{name}`: The name of the `Stars` resource of the signed-in user, in the format `user-{user_uid}`. For example, `user-a1b2c3d4`. Organization administrators can also use the `Stars` resource of another user in the organization.
  - `{user_uid}` is the signed-in user's UID, not their username or numeric ID. Look this up from the UID field returned by GET /api/user. Refer to [Migration steps](#migration-steps) for more details.
- `{group}`: The API group of the resource, in the format `<RESOURCE>.grafana.app`. For example, `dashboard.grafana.app` or `folder.grafana.app`.
- `{kind}`: The kind of the resource. For example, `Dashboard` or `Folder`.
- `{id}`: The resource UID, which has the same value used in the legacy path.

### Example request

None. The unstar target is fully encoded in the URL path; no JSON body is required or read.

### Example response

The response is a `Status` object, not the updated `Stars` resource. To get the updated `Stars` resource, use [Get stars](#get-stars). The following example shows the response:

```http
HTTP/1.1 200 OK
Content-Type: application/json

{
  "kind": "Status",
  "apiVersion": "v1",
  "metadata": {},
  "code": 200
}
```

### Status codes

- **200:** OK
- **204:** No content (the user's `Stars` resource doesn't exist)
- **400:** Bad request (the path doesn't end with `{group}/{kind}/{id}`)
- **401:** Unauthorized
- **403:** Access denied (the `Stars` resource belongs to another user, and you aren't an organization administrator)

Refer to [Star a resource](#star-a-resource) for more details.

## List stars

`GET /apis/collections.grafana.app/v1alpha1/namespaces/{namespace}/stars`

Lists `Stars` resources. Each `Stars` resource contains the starred resources of one user. The response depends on who makes the request:

- **Users:** The response only contains your own `Stars` resource, or an empty list if you haven't starred anything.
- **Service accounts:** The response contains the `Stars` resources of all users in the namespace.
- **Anonymous users:** The response is an empty list.

**Path parameters**:

- `{namespace}`: To learn more about which namespace to use, refer to the [API overview](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/developer-resources/api-reference/http-api/apis/).

**Query parameters**:

- **`limit`** (optional): Maximum number of `Stars` resources to return.
- **`continue`** (optional): Continue token from a previous response to fetch the next page.
- **`labelSelector`** (optional): Return only `Stars` resources whose labels match the selector.
- **`fieldSelector`** (optional): Return only `Stars` resources whose fields match the selector. For example, `metadata.name=user-a1b2c3d4`.

### Example request

The following example shows a request to list stars:

```http
GET /apis/collections.grafana.app/v1alpha1/namespaces/default/stars HTTP/1.1
Accept: application/json
Authorization: Bearer <SERVICE_ACCOUNT_TOKEN>
```

### Example response

The following example shows the response:

```http
HTTP/1.1 200 OK
Content-Type: application/json

{
  "kind": "StarsList",
  "apiVersion": "collections.grafana.app/v1alpha1",
  "metadata": {
    "resourceVersion": "1762790400000000"
  },
  "items": [
    {
      "kind": "Stars",
      "apiVersion": "collections.grafana.app/v1alpha1",
      "metadata": {
        "name": "user-a1b2c3d4",
        "namespace": "default",
        "resourceVersion": "1762790400000000",
        "creationTimestamp": "2026-11-10T16:00:00Z"
      },
      "spec": {
        "resource": [
          {
            "group": "dashboard.grafana.app",
            "kind": "Dashboard",
            "names": ["abc123", "def456"]
          }
        ]
      }
    }
  ]
}
```

### Status codes

- **200:** OK
- **401:** Unauthorized
- **403:** Access denied

## Get stars

`GET /apis/collections.grafana.app/v1alpha1/namespaces/{namespace}/stars/{name}`

Returns the `Stars` resource with the given name, which contains all the resources that the user has starred.

**Path parameters**:

- `{namespace}`: To learn more about which namespace to use, refer to the [API overview](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/developer-resources/api-reference/http-api/apis/).
- `{name}`: The name of the `Stars` resource of the signed-in user, in the format `user-{user_uid}`. For example, `user-a1b2c3d4`.

### Example request

The following example shows a request to get stars:

```http
GET /apis/collections.grafana.app/v1alpha1/namespaces/default/stars/user-a1b2c3d4 HTTP/1.1
Accept: application/json
Authorization: Bearer <SERVICE_ACCOUNT_TOKEN>
```

### Example response

The following example shows the response:

```http
HTTP/1.1 200 OK
Content-Type: application/json

{
  "kind": "Stars",
  "apiVersion": "collections.grafana.app/v1alpha1",
  "metadata": {
    "name": "user-a1b2c3d4",
    "namespace": "default",
    "resourceVersion": "1762790400000000",
    "creationTimestamp": "2026-11-10T16:00:00Z"
  },
  "spec": {
    "resource": [
      {
        "group": "dashboard.grafana.app",
        "kind": "Dashboard",
        "names": ["abc123", "def456"]
      }
    ]
  }
}
```

### Status codes

- **200:** Found
- **401:** Unauthorized
- **403:** Access denied
- **404:** Stars resource not found

## Create stars

`POST /apis/collections.grafana.app/v1alpha1/namespaces/{namespace}/stars`

Creates the `Stars` resource of a user. To add a single resource to an existing `Stars` resource, use [Star a resource](#star-a-resource) instead.

**Path parameters**:

- `{namespace}`: To learn more about which namespace to use, refer to the [API overview](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/developer-resources/api-reference/http-api/apis/).

**Request body**:

- `metadata.name`: Required. The name of the `Stars` resource, in the format `user-{user_uid}`.
- `spec.resource`: Required. The list of starred resources, grouped by resource type. Each entry has a `group`, such as `dashboard.grafana.app`, a `kind`, such as `Dashboard`, and `names`, the list of UIDs of the starred resources of that type.

### Example request

The following example shows a request to create stars:

```http
POST /apis/collections.grafana.app/v1alpha1/namespaces/default/stars HTTP/1.1
Accept: application/json
Content-Type: application/json
Authorization: Bearer <SERVICE_ACCOUNT_TOKEN>

{
  "metadata": {
    "name": "user-a1b2c3d4"
  },
  "spec": {
    "resource": [
      {
        "group": "dashboard.grafana.app",
        "kind": "Dashboard",
        "names": ["abc123", "def456"]
      }
    ]
  }
}
```

### Example response

The following example shows the response:

```http
HTTP/1.1 201 Created
Content-Type: application/json

{
  "kind": "Stars",
  "apiVersion": "collections.grafana.app/v1alpha1",
  "metadata": {
    "name": "user-a1b2c3d4",
    "namespace": "default",
    "resourceVersion": "1762790400000000",
    "creationTimestamp": "2026-11-10T16:00:00Z"
  },
  "spec": {
    "resource": [
      {
        "group": "dashboard.grafana.app",
        "kind": "Dashboard",
        "names": ["abc123", "def456"]
      }
    ]
  }
}
```

### Status codes

- **201:** Created
- **400:** Errors (invalid JSON, missing or invalid fields)
- **401:** Unauthorized
- **403:** Access denied (only organization administrators can create `Stars` resources with `POST`; other users can use [Star a resource](#star-a-resource) or [Replace stars](#replace-stars))
- **409:** Conflict (a `Stars` resource with the same name already exists). If Grafana uses legacy storage for stars, it replaces the existing resource and returns `201` instead.

## Replace stars

`PUT /apis/collections.grafana.app/v1alpha1/namespaces/{namespace}/stars/{name}`

Replaces the `Stars` resource with the given name. The list in `spec.resource` replaces all the starred resources of the user. Include `metadata.resourceVersion` from the latest version you read to avoid overwriting changes.

**Path parameters**:

- `{namespace}`: To learn more about which namespace to use, refer to the [API overview](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/developer-resources/api-reference/http-api/apis/).
- `{name}`: The name of the `Stars` resource of the signed-in user, in the format `user-{user_uid}`. For example, `user-a1b2c3d4`.

**Request body**:

- `metadata.name`: Required. The name of the `Stars` resource, in the format `user-{user_uid}`.
- `spec.resource`: Required. The list of starred resources, grouped by resource type. Each entry has a `group`, such as `dashboard.grafana.app`, a `kind`, such as `Dashboard`, and `names`, the list of UIDs of the starred resources of that type.

### Example request

The following example shows a request to replace stars:

```http
PUT /apis/collections.grafana.app/v1alpha1/namespaces/default/stars/user-a1b2c3d4 HTTP/1.1
Accept: application/json
Content-Type: application/json
Authorization: Bearer <SERVICE_ACCOUNT_TOKEN>

{
  "metadata": {
    "name": "user-a1b2c3d4",
    "resourceVersion": "1762790400000000"
  },
  "spec": {
    "resource": [
      {
        "group": "dashboard.grafana.app",
        "kind": "Dashboard",
        "names": ["abc123"]
      },
      {
        "group": "folder.grafana.app",
        "kind": "Folder",
        "names": ["fold789"]
      }
    ]
  }
}
```

### Example response

The response contains the updated `Stars` resource. For an example, refer to the response in [Get stars](#get-stars).

### Status codes

- **200:** Updated
- **201:** Created, if the `Stars` resource doesn't exist and Grafana uses unified storage for stars
- **400:** Errors (invalid JSON, missing or invalid fields)
- **401:** Unauthorized
- **403:** Access denied
- **404:** Stars resource not found, if Grafana uses legacy storage for stars
- **409:** Conflict (the `Stars` resource changed since you read it)

## Patch stars

`PATCH /apis/collections.grafana.app/v1alpha1/namespaces/{namespace}/stars/{name}`

Updates only the fields you provide. Use a JSON merge patch with the `application/merge-patch+json` content type. A merge patch replaces arrays as a whole, so `spec.resource` must contain the full list of starred resources.

**Path parameters**:

- `{namespace}`: To learn more about which namespace to use, refer to the [API overview](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/developer-resources/api-reference/http-api/apis/).
- `{name}`: The name of the `Stars` resource of the signed-in user, in the format `user-{user_uid}`. For example, `user-a1b2c3d4`.

### Example request

The following example shows a request to patch stars:

```http
PATCH /apis/collections.grafana.app/v1alpha1/namespaces/default/stars/user-a1b2c3d4 HTTP/1.1
Accept: application/json
Content-Type: application/merge-patch+json
Authorization: Bearer <SERVICE_ACCOUNT_TOKEN>

{
  "spec": {
    "resource": [
      {
        "group": "dashboard.grafana.app",
        "kind": "Dashboard",
        "names": ["abc123", "def456", "ghi789"]
      }
    ]
  }
}
```

### Example response

The response contains the updated `Stars` resource. For an example, refer to the response in [Get stars](#get-stars).

### Status codes

- **200:** Updated
- **400:** Errors (invalid JSON or patch)
- **401:** Unauthorized
- **403:** Access denied
- **404:** Stars resource not found
- **409:** Conflict (the `Stars` resource changed since you read it)

## Delete stars

`DELETE /apis/collections.grafana.app/v1alpha1/namespaces/{namespace}/stars/{name}`

Deletes the `Stars` resource with the given name, which removes all the stars of the user. To remove a single resource, use [Unstar a resource](#unstar-a-resource) instead.

**Path parameters**:

- `{namespace}`: To learn more about which namespace to use, refer to the [API overview](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/developer-resources/api-reference/http-api/apis/).
- `{name}`: The name of the `Stars` resource of the signed-in user, in the format `user-{user_uid}`. For example, `user-a1b2c3d4`.

### Example request

The following example shows a request to delete stars:

```http
DELETE /apis/collections.grafana.app/v1alpha1/namespaces/default/stars/user-a1b2c3d4 HTTP/1.1
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
  "details": {
    "name": "user-a1b2c3d4",
    "group": "collections.grafana.app",
    "kind": "stars"
  }
}
```

### Status codes

- **200:** Deleted
- **401:** Unauthorized
- **403:** Access denied
- **404:** Stars resource not found, if Grafana uses unified storage for stars. Legacy storage returns `200` if the resource doesn't exist.

## Migration steps

To migrate from `/api/user/stars/*` to `/apis/collections.grafana.app/*` follow these steps:

1. Identify every direct caller of `POST`/`PUT` or `DELETE` `/api/user/stars/dashboard/uid/{uid}` in your integration. Skip the Grafana UI itself, which already calls the new API.
1. Use `GET /api/user` to resolve the signed-in user's UID and cache it for the session.
1. Determine the namespace your Grafana instance or stack uses for App Platform API calls.
1. Replace the call with `PUT` (star) or `DELETE` (unstar) against `/apis/collections.grafana.app/v1alpha1/namespaces/{namespace}/stars/user-{user_uid}/update/dashboard.grafana.app/Dashboard/{dashboard_uid}`, **with no request body**.
1. Update response handling. Treat `200` as success for both star and unstar.
1. Leave any code that reads `GET /api/user/stars` as-is; it's unaffected by this change.

### Migration example

The following call in the legacy API:

```
  curl -X POST \
    -H "Authorization: Bearer $TOKEN" \
    "https://<your-grafana>/api/user/stars/dashboard/uid/abc123"
```

Becomes:

```
  USER_UID=$(curl -s -H "Authorization: Bearer $TOKEN" \
    "https://<your-grafana>/api/user" | jq -r .uid)

  curl -X PUT \
    -H "Authorization: Bearer $TOKEN" \
    "https://<your-grafana>/apis/collections.grafana.app/v1alpha1/namespaces/default/stars/user-${USER_UID}/update/dashboard.grafana.app/Dashboard/abc123"
```

Unstarring has an identical behavior, with `DELETE` instead of `PUT`.
