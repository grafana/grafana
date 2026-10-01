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
title: Collections Stars HTTP API
weight: 100
---

# Collections Stars HTTP API

{{< admonition type="note" >}}
Available in Grafana 13.3 and later.

This API complies with the new Grafana API structure. To learn more refer to documentation about the [API structure in Grafana](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/developer-resources/api-reference/http-api/apis).

**This document may not contain the latest version of the API. For the most up-to-date list of available endpoints, refer to [collections.grafana.app/v1](https://play.grafana.org/swagger?api=collections.grafana.app.grafana.app-v1) in Swagger.**

{{< /admonition >}}

Also known as the `collections` API, `/apis/collections.grafana.app/*` allows you to star and unstar your resources in Grafana.

This API replaces `POST` and `DELETE` `/api/user/stars/dashboard/uid/{dashboard_uid}`, which are now are deprecated, although they keep working with no functional change. **Use the generic Collections Stars API for any new integrations**.

## Endpoints

These are the available endpoints:

| Method | Summary |URI |Replaced endpoint
| ------ | ---------------------------- | -------------------------------------- |
| PUT/POST | [Star a resource](#star-a-resource) | /apis/collections.grafana.app/v1alpha1/namespaces/{namespace}/stars/user-{user_uid}/update/{group}/{kind}/{id} | /api/user/stars/dashboard/uid/{dashboard_uid} |
| DELETE | [Unstar a resource](#unstar-a-resource) | /apis/collections.grafana.app/v1alpha1/namespaces/{namespace}/stars/user-{user_uid}/update/{group}/{kind}/{id} | /api/user/stars/dashboard/uid/{dashboard_uid} |

### Path parameters

One endpoint shape now covers every starrable resource instead of one endpoint per kind. The resource name is always `user-`, for example `user-a1b2c3d4`. For a given resource, {group} / {kind} / {id}: identify the resource being starred/unstarred:

- {group} = resource.grafana.app. For example `dashboard.grafana.app` or `folder.grafana.app`
- {kind} = resource. For example: `Dashboard` or `Folder`
- {id} = the resource UID, which has the same value used in the legacy path

Other parameters include:

- {namespace} is the same namespace you already use for other Grafana App Platform APIs.
  - In Grafana Cloud: your stack slug. For example, `my-stack`
  - In Grafana OSS/Enterprise: your organization's ID. For example. `org-1`

- {user_uid}: the signed-in user's UID, not their username or numeric ID. Look this up from the UID field returned by GET /api/user. Refer to [Migration steps](#migration-steps) for more details.

## Star a resource

`PUT /apis/collections.grafana.app/v1alpha1/namespaces/{namespace}/stars/user-{user_uid}/update/{group}/{kind}/{id}`

Stars a resource for the signed-in user.

**Required permissions**

TBC

**Example request**:

None. The star target is fully encoded in the URL path; no JSON body is required or read.

**Example response**:

Status Codes:

- **200** - OK on a successful star (or unstar)
- **204** - No Content when unstarring a resource that has no stars recorded and therefore there's nothing to remove. It's not treated as an error
- **Standard 4xx errors** apply for auth/authorization failures, since you can only manage your own stars

## Unstar a resource

`DELETE /apis/collections.grafana.app/v1alpha1/namespaces/{namespace}/stars/user-{user_uid}/update/{group}/{kind}/{id}`

Unstars a resource for the signed-in user.

Refer to [Star a dashboard](#star-a-dashboard).

## Migration steps

To migrate from `/api/user/stars/*` to `/apis/collections.grafana.app/*` follow these steps:

1. Identify every direct caller of `POST`/`PUT` or `DELETE` `/api/user/stars/dashboard/uid/{uid}` in your integration.

- Skip the Grafana UI itself, which already calls the new API.

1. Use `GET /api/user` to resolve the signed-in user's UID and cache it for the session.
1. Determine the namespace your Grafana instance or stack uses for App Platform API calls.
1. Replace the call with `PUT` (star) or `DELETE` (unstar) against `
/apis/collections.grafana.app/v1alpha1/namespaces/{namespace}/stars/user-{uid}/update/dashboard.grafana.app/Dashboard/{dashboard_uid}`,
   **with no request body**.
1. Update response handling:

- Treat `200` as success for both star and unstar.
- Treat `204` as a no-op success when unstarring something that wasn't starred.

1. Leave any code that reads `GET /api/user/stars` as-is; it's unaffected by this change.

## Example

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

Unstarring is identical, with `DELETE` instead of `PUT`/`POST`.
