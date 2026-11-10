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
title: Stars HTTP API
weight: 100
---

# Stars HTTP API

{{< admonition type="note" >}}
Available in Grafana 13 and later.

This API complies with the new Grafana API structure. To learn more refer to documentation about the [API structure in Grafana](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/developer-resources/api-reference/http-api/apis).

**This document may not contain the latest version of the API. For the most up-to-date list of available endpoints, refer to [collections.grafana.app/v1](https://play.grafana.org/swagger?api=collections.grafana.app.grafana.app-v1) in Swagger.**

{{< /admonition >}}

Also known as the `collections` API, `/apis/collections.grafana.app/*` allows you to star and unstar your resources in Grafana.

This API replaces `POST` and `DELETE` `/api/user/stars/dashboard/uid/{dashboard_uid}`, which are now are deprecated, although they keep working with no functional change. **Use the generic Collections Stars API for any new integrations**.

## Endpoints

These are the available endpoints:

| Method   | Summary                                 | URI                                                                                                              | Replaced endpoint                             |
| -------- | --------------------------------------- | ---------------------------------------------------------------------------------------------------------------- | --------------------------------------------- |
| PUT/POST | [Star a resource](#star-a-resource)     | `/apis/collections.grafana.app/v1alpha1/namespaces/{namespace}/stars/user-{user_uid}/update/{group}/{kind}/{id}` | /api/user/stars/dashboard/uid/{dashboard_uid} |
| DELETE   | [Unstar a resource](#unstar-a-resource) | `/apis/collections.grafana.app/v1alpha1/namespaces/{namespace}/stars/user-{user_uid}/update/{group}/{kind}/{id}` | /api/user/stars/dashboard/uid/{dashboard_uid} |

## Star a resource

`PUT /apis/collections.grafana.app/v1alpha1/namespaces/{namespace}/stars/user-{user_uid}/update/{group}/{kind}/{id}`

Stars a resource for the signed-in user. One endpoint shape covers every starrable resource instead of one endpoint per kind. `{group}`, `{kind}`, and `{id}` identify the resource to star.

**Path parameters**:

- `{namespace}`: To learn more about which namespace to use, refer to the [API overview](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/developer-resources/api-reference/http-api/apis/).
- `{user_uid}`: The signed-in user's UID, not their username or numeric ID. Look this up from the UID field returned by GET /api/user. Refer to [Migration steps](#migration-steps) for more details.
  - The resource name is always `user-{user_uid}`, for example `user-a1b2c3d4`.
- `{group}`: The API group of the resource, in the format `<RESOURCE>.grafana.app`. For example, `dashboard.grafana.app` or `folder.grafana.app`.
- `{kind}`: The kind of the resource. For example, `Dashboard` or `Folder`.
- `{id}`: The resource UID, which has the same value used in the legacy path.

### Example request

None. The star target is fully encoded in the URL path; no JSON body is required or read.

### Example response

The response contains the `Stars` resource of the signed-in user.

### Status codes

- **200** - OK on a successful star (or unstar)
- **204** - No Content when unstarring a resource that has no stars recorded and therefore there's nothing to remove. It's not treated as an error
- **Standard 4xx errors** apply for auth/authorization failures, since you can only manage your own stars

## Unstar a resource

`DELETE /apis/collections.grafana.app/v1alpha1/namespaces/{namespace}/stars/user-{user_uid}/update/{group}/{kind}/{id}`

Unstars a resource for the signed-in user. `{group}`, `{kind}`, and `{id}` identify the resource to unstar.

**Path parameters**:

- `{namespace}`: To learn more about which namespace to use, refer to the [API overview](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/developer-resources/api-reference/http-api/apis/).
- `{user_uid}`: The signed-in user's UID, not their username or numeric ID. Look this up from the UID field returned by GET /api/user. Refer to [Migration steps](#migration-steps) for more details.
  - The resource name is always `user-{user_uid}`, for example `user-a1b2c3d4`.
- `{group}`: The API group of the resource, in the format `<RESOURCE>.grafana.app`. For example, `dashboard.grafana.app` or `folder.grafana.app`.
- `{kind}`: The kind of the resource. For example, `Dashboard` or `Folder`.
- `{id}`: The resource UID, which has the same value used in the legacy path.

### Example request

None. The unstar target is fully encoded in the URL path; no JSON body is required or read.

### Example response

The response contains the `Stars` resource of the signed-in user.

### Status codes

- **200** – OK on a successful unstar
- **204** – No Content when unstarring a resource that has no stars recorded and therefore there's nothing to remove. It's not treated as an error
- **Standard 4xx errors** apply for auth/authorization failures, since you can only manage your own stars

Refer to [Star a resource](#star-a-resource) for more details.

## Migration steps

To migrate from `/api/user/stars/*` to `/apis/collections.grafana.app/*` follow these steps:

1. Identify every direct caller of `POST`/`PUT` or `DELETE` `/api/user/stars/dashboard/uid/{uid}` in your integration. Skip the Grafana UI itself, which already calls the new API.
1. Use `GET /api/user` to resolve the signed-in user's UID and cache it for the session.
1. Determine the namespace your Grafana instance or stack uses for App Platform API calls.
1. Replace the call with `PUT` (star) or `DELETE` (unstar) against `/apis/collections.grafana.app/v1alpha1/namespaces/{namespace}/stars/user-{user_uid}/update/dashboard.grafana.app/Dashboard/{dashboard_uid}`, **with no request body**.
1. Update response handling. Treat `200` as success for both star and unstar, and `204` as a no-op success when unstarring something that wasn't starred.
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

Unstarring has an identical behavior, with `DELETE` instead of `PUT`/`POST`.
