---
canonical: https://grafana.com/docs/grafana/latest/developer-resources/api-reference/http-api/short_url/
description: Grafana Short URL HTTP API
keywords:
  - grafana
  - http
  - documentation
  - api
  - shortUrl
  - url
labels:
  products:
    - enterprise
    - oss
    - cloud
title: Short URL HTTP API
weight: 100
---

# Short URL HTTP API

{{< admonition type="note" >}}
Available in Grafana 12.4 and later.

This API complies with the new Grafana API structure. To learn more refer to documentation about the [API structure in Grafana](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/developer-resources/api-reference/http-api/apis/).

The legacy [Short URL API](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/developer-resources/api-reference/http-api/api-legacy/short_url/) is still available, and removal will be announced well in advance to avoid disruptions. Refer to [Migrate from the legacy Short URL API](#migrate-from-the-legacy-short-url-api) to learn more about how both APIs match, and how to migrate.

**This document may not contain the latest version of the API. For the most up-to-date list of available endpoints, refer to [shorturl.grafana.app/v1beta1](https://play.grafana.org/swagger?api=shorturl.grafana.app-v1beta1) in Swagger.**

This API is in `beta`, so it might change in future releases.

{{< /admonition >}}

Use this API to create shortened URLs. A short URL represents a longer URL containing complex query parameters in a smaller and simpler format.

All paths use the `shorturl.grafana.app` group and the `v1beta1` version. Replace `{namespace}` with your namespace. To learn more about which namespace to use, refer to the [API overview](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/developer-resources/api-reference/http-api/apis/).

## Requirements

Short URLs don't use role-based access control actions. Access depends on the organization role of the user or service account that sends the request:

| Operation                                     | Required role                                   |
| --------------------------------------------- | ----------------------------------------------- |
| Create, get, and resolve (`goto`) a short URL | Any authenticated user, including role **None** |
| List, update, patch, and delete short URLs    | **Admin**                                       |

Listing is restricted to admins because it exposes every short URL in the organization. Updating and deleting are restricted because they can change or remove short URLs that other users created.

## Endpoints

The following table lists the main endpoints. The Swagger documentation also includes endpoints to search short URLs, delete a collection of short URLs, apply partial updates with `PATCH`, and read or update the `status` subresource.

| Method | Summary                                     | URI                                                                               |
| ------ | ------------------------------------------- | --------------------------------------------------------------------------------- |
| GET    | [List short URLs](#list-short-urls)         | `/apis/shorturl.grafana.app/v1beta1/namespaces/{namespace}/shorturls`             |
| GET    | [Get a short URL](#get-a-short-url)         | `/apis/shorturl.grafana.app/v1beta1/namespaces/{namespace}/shorturls/{name}`      |
| GET    | [Resolve a short URL](#resolve-a-short-url) | `/apis/shorturl.grafana.app/v1beta1/namespaces/{namespace}/shorturls/{name}/goto` |
| POST   | [Create a short URL](#create-a-short-url)   | `/apis/shorturl.grafana.app/v1beta1/namespaces/{namespace}/shorturls`             |
| PUT    | [Update a short URL](#update-a-short-url)   | `/apis/shorturl.grafana.app/v1beta1/namespaces/{namespace}/shorturls/{name}`      |
| DELETE | [Delete a short URL](#delete-a-short-url)   | `/apis/shorturl.grafana.app/v1beta1/namespaces/{namespace}/shorturls/{name}`      |

## List short URLs

`GET /apis/shorturl.grafana.app/v1beta1/namespaces/{namespace}/shorturls`

Returns all short URLs in the organization. Use the `limit` query parameter to control the maximum number of short URLs returned. To retrieve more short URLs, use the `continue` token from the response to fetch the next page.

**Path parameters**:

- `{namespace}`: To learn more about which namespace to use, refer to the [API overview](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/developer-resources/api-reference/http-api/apis/).

**Query parameters**:

- **`limit`** (optional): Maximum number of short URLs to return.
- **`continue`** (optional): Continue token from a previous response to fetch the next page.

**Required permissions**: Admin role.

### Example request

The following example shows a request to list short URLs:

```http
GET /apis/shorturl.grafana.app/v1beta1/namespaces/default/shorturls HTTP/1.1
Accept: application/json
Authorization: Bearer <SERVICE_ACCOUNT_TOKEN>
```

### Example response

The following example shows the response:

```http
HTTP/1.1 200
Content-Type: application/json

{
  "kind": "ShortURLList",
  "apiVersion": "shorturl.grafana.app/v1beta1",
  "metadata": {},
  "items": [
    {
      "kind": "ShortURL",
      "apiVersion": "shorturl.grafana.app/v1beta1",
      "metadata": {
        "name": "AT76wBvGk",
        "namespace": "default",
        "resourceVersion": "1762325460",
        "creationTimestamp": "2026-11-05T06:51:00Z"
      },
      "spec": {
        "path": "d/TxKARsmGz/new-dashboard?orgId=1&from=1599389322894&to=1599410922894"
      },
      "status": {
        "lastSeenAt": 0
      }
    }
  ]
}
```

### Status codes

- **200:** OK
- **401:** Unauthorized
- **403:** Access denied (only organization administrators can list short URLs)

## Get a short URL

`GET /apis/shorturl.grafana.app/v1beta1/namespaces/{namespace}/shorturls/{name}`

Returns the short URL with the given name.

**Path parameters**:

- `{namespace}`: To learn more about which namespace to use, refer to the [API overview](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/developer-resources/api-reference/http-api/apis/).
- `{name}`: The unique identifier of the short URL. This is the `metadata.name` field in the short URL response.

**Required permissions**: Any authenticated user.

### Example request

The following example shows a request to get a short URL:

```http
GET /apis/shorturl.grafana.app/v1beta1/namespaces/default/shorturls/AT76wBvGk HTTP/1.1
Accept: application/json
Authorization: Bearer <SERVICE_ACCOUNT_TOKEN>
```

### Example response

The following example shows the response:

```http
HTTP/1.1 200
Content-Type: application/json

{
  "kind": "ShortURL",
  "apiVersion": "shorturl.grafana.app/v1beta1",
  "metadata": {
    "name": "AT76wBvGk",
    "namespace": "default",
    "resourceVersion": "1762325460",
    "creationTimestamp": "2026-11-05T06:51:00Z"
  },
  "spec": {
    "path": "d/TxKARsmGz/new-dashboard?orgId=1&from=1599389322894&to=1599410922894"
  },
  "status": {
    "lastSeenAt": 1762325712000
  }
}
```

The response contains the following fields:

- **metadata.name** – The unique identifier of the short URL.
- **spec.path** – The path the short URL links to, relative to the Grafana [`root_url`](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/setup-grafana/configure-grafana/#root_url).
- **status.lastSeenAt** – The last time someone used the short URL, in milliseconds since the Unix epoch. The initial value is `0`.

### Status codes

- **200:** Found
- **401:** Unauthorized
- **403:** Access denied
- **404:** Short URL not found

## Resolve a short URL

`GET /apis/shorturl.grafana.app/v1beta1/namespaces/{namespace}/shorturls/{name}/goto`

Redirects to the full URL that the short URL links to. Grafana builds the full URL from its [`root_url`](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/setup-grafana/configure-grafana/#root_url) and the `spec.path` of the short URL, and updates `status.lastSeenAt`.

**Path parameters**:

- `{namespace}`: To learn more about which namespace to use, refer to the [API overview](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/developer-resources/api-reference/http-api/apis/).
- `{name}`: The unique identifier of the short URL.

**Query parameters**:

- **`redirect`** (optional): Set to `false` to return the full URL in a JSON body instead of redirecting.

**Required permissions**: Any authenticated user.

### Example request

The following example shows a request to resolve a short URL:

```http
GET /apis/shorturl.grafana.app/v1beta1/namespaces/default/shorturls/AT76wBvGk/goto HTTP/1.1
Authorization: Bearer <SERVICE_ACCOUNT_TOKEN>
```

### Example response

The following example shows the response:

```http
HTTP/1.1 302 Found
Location: https://grafana.example.com/d/TxKARsmGz/new-dashboard?orgId=1&from=1599389322894&to=1599410922894
```

### Example request with `redirect=false`

The following example shows a request with `redirect=false`, which returns the full URL in the response body instead of redirecting:

```http
GET /apis/shorturl.grafana.app/v1beta1/namespaces/default/shorturls/AT76wBvGk/goto?redirect=false HTTP/1.1
Accept: application/json
Authorization: Bearer <SERVICE_ACCOUNT_TOKEN>
```

### Example response

The following example shows the response:

```http
HTTP/1.1 200
Content-Type: application/json

{
  "url": "https://grafana.example.com/d/TxKARsmGz/new-dashboard?orgId=1&from=1599389322894&to=1599410922894"
}
```

### Status codes

- **200:** OK, when `redirect=false`
- **302:** Found, redirects to the full URL
- **401:** Unauthorized
- **404:** Short URL not found

## Create a short URL

`POST /apis/shorturl.grafana.app/v1beta1/namespaces/{namespace}/shorturls`

Creates a short URL.

**Path parameters**:

- `{namespace}`: To learn more about which namespace to use, refer to the [API overview](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/developer-resources/api-reference/http-api/apis/).

**Required permissions**: Any authenticated user.

### Example request

The following example shows a request to create a short URL:

```http
POST /apis/shorturl.grafana.app/v1beta1/namespaces/default/shorturls HTTP/1.1
Accept: application/json
Content-Type: application/json
Authorization: Bearer <SERVICE_ACCOUNT_TOKEN>

{
  "metadata": {
    "generateName": "dash-"
  },
  "spec": {
    "path": "d/TxKARsmGz/new-dashboard?orgId=1&from=1599389322894&to=1599410922894"
  }
}
```

JSON body schema:

- **metadata.name** – The unique identifier of the short URL. If you don't want to provide one, set `metadata.generateName` to the prefix you want, and Grafana generates the rest of the name.
- **spec.path** – The path to shorten, relative to the Grafana [`root_url`](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/setup-grafana/configure-grafana/#root_url). For example, `d/TxKARsmGz/new-dashboard` or `explore?from=123&to=456`.

The path must be relative. Grafana rejects the following paths:

- Absolute paths that start with `/`
- Paths that contain `../` or `..\`
- Paths that start with `//` or `\`
- Paths that contain a URL scheme, such as `https://` or `javascript:`

### Example response

The following example shows the response:

```http
HTTP/1.1 201
Content-Type: application/json

{
  "kind": "ShortURL",
  "apiVersion": "shorturl.grafana.app/v1beta1",
  "metadata": {
    "name": "dash-7xkq2",
    "namespace": "default",
    "resourceVersion": "1762325460",
    "creationTimestamp": "2026-11-05T06:51:00Z"
  },
  "spec": {
    "path": "d/TxKARsmGz/new-dashboard?orgId=1&from=1599389322894&to=1599410922894"
  },
  "status": {
    "lastSeenAt": 0
  }
}
```

To share the short URL, use `<GRAFANA_URL>/goto/<NAME>?orgId=<ORG_ID>`, where `<NAME>` is the `metadata.name` from the response.

### Status codes

- **201:** Created
- **400:** Errors (invalid JSON, missing or invalid fields)
- **401:** Unauthorized
- **403:** Access denied, or the path is invalid
- **409:** Conflict (a short URL with the same name already exists)

## Update a short URL

`PUT /apis/shorturl.grafana.app/v1beta1/namespaces/{namespace}/shorturls/{name}`

Replaces an existing short URL identified by name. Provide the full object, including `metadata.resourceVersion` from the latest version of the short URL.

**Path parameters**:

- `{namespace}`: To learn more about which namespace to use, refer to the [API overview](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/developer-resources/api-reference/http-api/apis/).
- `{name}`: The unique identifier of the short URL.

**Required permissions**: Admin role.

### Example request

The following example shows a request to update a short URL:

```http
PUT /apis/shorturl.grafana.app/v1beta1/namespaces/default/shorturls/AT76wBvGk HTTP/1.1
Accept: application/json
Content-Type: application/json
Authorization: Bearer <SERVICE_ACCOUNT_TOKEN>

{
  "kind": "ShortURL",
  "apiVersion": "shorturl.grafana.app/v1beta1",
  "metadata": {
    "name": "AT76wBvGk",
    "resourceVersion": "1762325460"
  },
  "spec": {
    "path": "d/TxKARsmGz/new-dashboard?orgId=1&from=now-6h&to=now"
  }
}
```

### Example response

The following example shows the response:

```http
HTTP/1.1 200
Content-Type: application/json

{
  "kind": "ShortURL",
  "apiVersion": "shorturl.grafana.app/v1beta1",
  "metadata": {
    "name": "AT76wBvGk",
    "namespace": "default",
    "resourceVersion": "1762325999",
    "creationTimestamp": "2026-11-05T06:51:00Z"
  },
  "spec": {
    "path": "d/TxKARsmGz/new-dashboard?orgId=1&from=now-6h&to=now"
  },
  "status": {
    "lastSeenAt": 1762325712000
  }
}
```

### Status codes

- **200:** Updated
- **201:** Created, if the short URL doesn't exist
- **400:** Errors (invalid JSON, missing or invalid fields)
- **401:** Unauthorized
- **403:** Access denied (only organization administrators can update short URLs), or the path is invalid
- **409:** Conflict (the short URL changed since you read it)

## Delete a short URL

`DELETE /apis/shorturl.grafana.app/v1beta1/namespaces/{namespace}/shorturls/{name}`

Deletes an existing short URL identified by name. This operation can't be reverted.

**Path parameters**:

- `{namespace}`: To learn more about which namespace to use, refer to the [API overview](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/developer-resources/api-reference/http-api/apis/).
- `{name}`: The unique identifier of the short URL.

**Required permissions**: Admin role.

### Example request

The following example shows a request to delete a short URL:

```http
DELETE /apis/shorturl.grafana.app/v1beta1/namespaces/default/shorturls/AT76wBvGk HTTP/1.1
Accept: application/json
Authorization: Bearer <SERVICE_ACCOUNT_TOKEN>
```

### Example response

The following example shows the response:

```http
HTTP/1.1 200
Content-Type: application/json

{
  "kind": "ShortURL",
  "apiVersion": "shorturl.grafana.app/v1beta1",
  "metadata": {
    "name": "AT76wBvGk",
    "namespace": "default",
    "resourceVersion": "1762325999",
    "creationTimestamp": "2026-11-05T06:51:00Z"
  },
  "spec": {
    "path": "d/TxKARsmGz/new-dashboard?orgId=1&from=now-6h&to=now"
  },
  "status": {
    "lastSeenAt": 1762325712000
  }
}
```

### Status codes

- **200:** Deleted
- **401:** Unauthorized
- **403:** Access denied (only organization administrators can delete short URLs)
- **404:** Short URL not found

## Migrate from the legacy Short URL API

The new API uses different request and response shapes than the legacy `/api/short-urls` endpoints, so changing the URL alone isn't enough. The following table shows how the endpoints match:

| Legacy endpoint            | New endpoint                                                                          |
| -------------------------- | ------------------------------------------------------------------------------------- |
| `POST /api/short-urls`     | `POST /apis/shorturl.grafana.app/v1beta1/namespaces/{namespace}/shorturls`            |
| `GET /api/short-urls/:uid` | `GET /apis/shorturl.grafana.app/v1beta1/namespaces/{namespace}/shorturls/{name}`      |
| `GET /goto/:uid`           | `GET /apis/shorturl.grafana.app/v1beta1/namespaces/{namespace}/shorturls/{name}/goto` |

When you migrate, consider the following differences:

- **Request body:** The legacy `path` and `uid` fields move to `spec.path` and `metadata.name`.
- **Response body:** The legacy API returns `uid` and a ready-to-share `url`. The new API returns the full `ShortURL` object, so build the shareable URL from `metadata.name` as described in [Create a short URL](#create-a-short-url).
- **New operations:** The new API also supports listing, updating, and deleting short URLs, which require the Admin role.
