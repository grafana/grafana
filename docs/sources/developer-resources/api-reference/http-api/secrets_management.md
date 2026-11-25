---
aliases:
  - ../../../http_api/secrets_management/ # /docs/grafana/next/http_api/secrets_management/
  - ../../../developers/http_api/secrets_management/ # /docs/grafana/next/developers/http_api/secrets_management/
canonical: https://grafana.com/docs/grafana/latest/developer-resources/api-reference/http-api/secrets_management/
description: Grafana Secrets Management HTTP API
keywords:
  - grafana
  - http
  - documentation
  - api
  - secrets
  - enterprise
labels:
  products:
    - enterprise
    - cloud
title: Secrets Management HTTP API
weight: 100
---

# Secrets Management API

{{< admonition type="note" >}}
Available in Grafana 12.2 and later.

This API complies with the new Grafana API structure. To learn more refer to documentation about the [API structure in Grafana](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/developer-resources/api-reference/http-api/apis/).

**This document may not contain the latest version of the API. For the most up-to-date list of available endpoints, refer to [secret.grafana.app/v1beta1](https://play.grafana.org/swagger?api=secret.grafana.app-v1beta1) in Swagger.**

This API is in `beta`, so it might change in future releases.

{{< /admonition >}}

The Grafana Secrets Management API allows you to manage secrets that are used by other services and applications within your Grafana instance.

## Requirements

If you're running Grafana Enterprise or Grafana Cloud, some endpoints require specific permissions. For more information, refer to [Role-based access control permissions](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/administration/roles-and-permissions/access-control/custom-role-actions-scopes/).

## Endpoints

These are the available endpoints:

**Base path:** `/apis/secret.grafana.app/v1beta1/namespaces/{namespace}/`

Replace `{namespace}` with your namespace. To learn which namespace to use, refer to the [API overview](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/developer-resources/api-reference/http-api/apis/).

| Method | Summary                                         | Path                  |
| ------ | ----------------------------------------------- | --------------------- |
| POST   | [Create a secure value](#create-a-secure-value) | `securevalues`        |
| GET    | [List secure values](#list-secure-values)       | `securevalues`        |
| GET    | [Get a secure value](#get-a-secure-value)       | `securevalues/{name}` |
| PUT    | [Update a secure value](#update-a-secure-value) | `securevalues/{name}` |
| DELETE | [Delete a secure value](#delete-a-secure-value) | `securevalues/{name}` |

## Decrypters

The decrypters field is an allowlist that lets the secure value know which services and apps can decrypt the secret value.

Currently available decrypters:

- `k6-cloud` (for Grafana Cloud k6)
- `provisioning.grafana.app` (for GitSync/Provisioning)
- `synthetic-monitoring` (for Synthetic Monitoring checks)

## Create a secure value

`POST /apis/secret.grafana.app/v1beta1/namespaces/{namespace}/securevalues`

Creates a new secure value.

**Path parameters**:

- `{namespace}`: To learn more about which namespace to use, refer to the [API overview](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/developer-resources/api-reference/http-api/apis/).

**Request body**:

- `metadata.name`: The Grafana unique identifier. If you do not want to provide this, set `metadata.generateName` instead to the prefix you would like for the randomly generated `uid` (can't be an empty string).
- `spec.description`: Short description that explains the purpose of this secure value. Required. Up to 25 characters long.
- `spec.value`: The secret value to store. Required. Up to 24576 bytes long.
- `spec.decrypters`: List of services allowed to decrypt this secure value. Up to 64 items, see note in [decrypters](#decrypters) for a list of supported values.

**Required permissions**:

See note in the [introduction](#secrets-management-api) for an explanation.

<!-- prettier-ignore-start -->
| Action                       | Scope                                     |
| ---------------------------- | ----------------------------------------- |
| `secret.securevalues:create` | <ul><li>`secret.securevalues:*`</li></ul> |
{ .no-spacing-list }
<!-- prettier-ignore-end -->

### Example request

The following example shows a request to create a secure value:

```http
POST /apis/secret.grafana.app/v1beta1/namespaces/default/securevalues HTTP/1.1
Accept: application/json
Content-Type: application/json
Authorization: Bearer <SERVICE_ACCOUNT_TOKEN>

{
  "metadata": {
    "name": "api-key"
  },
  "spec": {
    "description": "External API Key",
    "value": "secret-api-key-12345",
    "decrypters": ["synthetic-monitoring"]
  }
}
```

### Example response

The following example shows the response:

```http
HTTP/1.1 201 Created
Content-Type: application/json; charset=UTF-8
Content-Length: 343

{
  "apiVersion": "secret.grafana.app/v1beta1",
  "kind": "SecureValue",
  "metadata": {
    "name": "api-key",
    "namespace": "default",
    "uid": "f1e2d3c4-b5a6-7890-abcd-ef1234567890",
    "creationTimestamp": "2024-01-15T10:35:00Z"
  },
  "spec": {
    "description": "External API Key",
    "decrypters": ["synthetic-monitoring"]
  },
  "status": {}
}
```

{{< admonition type="note">}}
The `spec.value` field is never returned by API endpoints. Users can't decrypt secrets.
{{< /admonition >}}

## List secure values

`GET /apis/secret.grafana.app/v1beta1/namespaces/{namespace}/securevalues`

List all secure values in a namespace.

**Path parameters**:

- `{namespace}`: To learn more about which namespace to use, refer to the [API overview](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/developer-resources/api-reference/http-api/apis/).

**Query parameters**:

- `labelSelector`: Filter secure values by labels.

**Required permissions**:

See note in the [introduction](#secrets-management-api) for an explanation.

<!-- prettier-ignore-start -->
| Action                       | Scope                                     |
| ---------------------------- | ----------------------------------------- |
| `secret.securevalues:read`   | <ul><li>`secret.securevalues:*`</li></ul> |
{ .no-spacing-list }
<!-- prettier-ignore-end -->

### Example request

The following example shows a request to list secure values:

```http
GET /apis/secret.grafana.app/v1beta1/namespaces/default/securevalues HTTP/1.1
Accept: application/json
Content-Type: application/json
Authorization: Bearer <SERVICE_ACCOUNT_TOKEN>
```

### Example response

The following example shows the response:

```http
HTTP/1.1 200 OK
Content-Type: application/json; charset=UTF-8
Content-Length: 383

{
  "apiVersion": "secret.grafana.app/v1beta1",
  "kind": "SecureValueList",
  "metadata": {
    "resourceVersion": "12345"
  },
  "items": [
    {
      "apiVersion": "secret.grafana.app/v1beta1",
      "kind": "SecureValue",
      "metadata": {
        "name": "database-password",
        "namespace": "default",
        "creationTimestamp": "2024-01-15T10:30:00Z"
      },
      "spec": {
        "description": "Production DB Password",
        "decrypters": ["synthetic-monitoring"]
      },
      "status": {}
    }
  ]
}
```

## Get a secure value

`GET /apis/secret.grafana.app/v1beta1/namespaces/{namespace}/securevalues/{name}`

Get the details of a specific secure value. It will not return the secret value.

**Path parameters**:

- `{namespace}`: To learn more about which namespace to use, refer to the [API overview](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/developer-resources/api-reference/http-api/apis/).
- `{name}`: The name of the secure value.

**Required permissions**:

See note in the [introduction](#secrets-management-api) for an explanation.

<!-- prettier-ignore-start -->
| Action                       | Scope                                     |
| ---------------------------- | ----------------------------------------- |
| `secret.securevalues:read`   | <ul><li>`secret.securevalues:*`</li></ul> |
{ .no-spacing-list }
<!-- prettier-ignore-end -->

### Example request

The following example shows a request to get a secure value:

```http
GET /apis/secret.grafana.app/v1beta1/namespaces/default/securevalues/api-key HTTP/1.1
Accept: application/json
Content-Type: application/json
Authorization: Bearer <SERVICE_ACCOUNT_TOKEN>
```

### Example response

The following example shows the response:

```http
HTTP/1.1 200 OK
Content-Type: application/json; charset=UTF-8
Content-Length: 294

{
  "apiVersion": "secret.grafana.app/v1beta1",
  "kind": "SecureValue",
  "metadata": {
    "name": "api-key",
    "namespace": "default",
    "uid": "f1e2d3c4-b5a6-7890-abcd-ef1234567890",
    "creationTimestamp": "2024-01-15T10:35:00Z"
  },
  "spec": {
    "description": "External API Key",
    "decrypters": ["synthetic-monitoring"]
  },
  "status": {}
}
```

## Update a secure value

`PUT /apis/secret.grafana.app/v1beta1/namespaces/{namespace}/securevalues/{name}`

Replace an existing secure value with a new specification.

**Path parameters**:

- `{namespace}`: To learn more about which namespace to use, refer to the [API overview](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/developer-resources/api-reference/http-api/apis/).
- `{name}`: The name of the secure value.

**Request body**:

- `spec.description`: Short description that explains the purpose of this secure value. Required. Up to 25 characters long.
- `spec.value`: The secret value to store. Required. Up to 24576 bytes long.
- `spec.decrypters`: List of services allowed to decrypt this secure value. Up to 64 items, see note in [decrypters](#decrypters) for a list of supported values.

**Required permissions**:

See note in the [introduction](#secrets-management-api) for an explanation.

<!-- prettier-ignore-start -->
| Action                      | Scope                                     |
| --------------------------- | ----------------------------------------- |
| `secret.securevalues:write` | <ul><li>`secret.securevalues:*`</li></ul> |
{ .no-spacing-list }
<!-- prettier-ignore-end -->

### Example request

The following example shows a request to update a secure value:

```http
PUT /apis/secret.grafana.app/v1beta1/namespaces/default/securevalues/api-key HTTP/1.1
Accept: application/json
Content-Type: application/json
Authorization: Bearer <SERVICE_ACCOUNT_TOKEN>

{
  "metadata": {
    "name": "api-key"
  },
  "spec": {
    "description": "External API Key",
    "value": "new-value-12345",
    "decrypters": ["synthetic-monitoring"]
  }
}
```

### Example response

The following example shows the response:

```http
HTTP/1.1 200 OK
Content-Type: application/json; charset=UTF-8
Content-Length: 282

{
  "apiVersion": "secret.grafana.app/v1beta1",
  "kind": "SecureValue",
  "metadata": {
    "name": "api-key",
    "namespace": "default",
    "uid": "f1e2d3c4-b5a6-7890-abcd-ef1234567890",
    "creationTimestamp": "2024-01-15T10:35:00Z"
  },
  "spec": {
    "description": "External API Key",
    "decrypters": ["synthetic-monitoring"]
  }
}
```

## Delete a secure value

`DELETE /apis/secret.grafana.app/v1beta1/namespaces/{namespace}/securevalues/{name}`

Permanently delete a secure value. This also deletes the underlying stored secret value.

**Path parameters**:

- `{namespace}`: To learn more about which namespace to use, refer to the [API overview](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/developer-resources/api-reference/http-api/apis/).
- `{name}`: The name of the secure value.

**Required permissions**:

See note in the [introduction](#secrets-management-api) for an explanation.

<!-- prettier-ignore-start -->
| Action                       | Scope                                     |
| ---------------------------- | ----------------------------------------- |
| `secret.securevalues:delete` | <ul><li>`secret.securevalues:*`</li></ul> |
{ .no-spacing-list }
<!-- prettier-ignore-end -->

### Example request

The following example shows a request to delete a secure value:

```http
DELETE /apis/secret.grafana.app/v1beta1/namespaces/default/securevalues/api-key HTTP/1.1
Accept: application/json
Content-Type: application/json
Authorization: Bearer <SERVICE_ACCOUNT_TOKEN>
```

### Example response

The following example shows the response:

```http
HTTP/1.1 200 OK
Content-Type: application/json; charset=UTF-8
Content-Length: 65

{
  "apiVersion": "v1",
  "kind": "Status",
  "status": "Success",
  "code": 200
}
```

## Status codes

The endpoints on this page return the following status codes:

| Code  | Meaning                                                                                                      | Returned by                                                                                                                 |
| ----- | ------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------- |
| `200` | OK.                                                                                                          | [List](#list-secure-values), [Get](#get-a-secure-value), [Update](#update-a-secure-value), [Delete](#delete-a-secure-value) |
| `201` | Created.                                                                                                     | [Create](#create-a-secure-value)                                                                                            |
| `400` | Bad request (invalid JSON).                                                                                  | [Create](#create-a-secure-value), [Update](#update-a-secure-value)                                                          |
| `401` | Unauthorized.                                                                                                | All endpoints                                                                                                               |
| `403` | Access denied.                                                                                               | All endpoints                                                                                                               |
| `404` | Not found.                                                                                                   | [Get](#get-a-secure-value), [Update](#update-a-secure-value), [Delete](#delete-a-secure-value)                              |
| `409` | Conflict (a secure value with the same name already exists).                                                 | [Create](#create-a-secure-value)                                                                                            |
| `422` | Invalid secure value, for example because a required field is missing or a field value isn't valid.          | [Create](#create-a-secure-value)                                                                                            |
| `422` | Invalid secure value, for example because a field value isn't valid or you switch between `value` and `ref`. | [Update](#update-a-secure-value)                                                                                            |
