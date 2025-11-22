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
refs:
  api-overview:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/developers/http_api/apis/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/developer-resources/api-reference/http-api/apis/
  rbac-permissions:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/administration/roles-and-permissions/access-control/custom-role-actions-scopes/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/security-and-account-management/authentication-and-permissions/access-control/custom-role-actions-scopes/
---

# Secrets Management API

> If you are running Grafana Enterprise, you need to have specific permissions for some endpoints . Refer to [Role-based access control permissions](ref:rbac-permissions) for more information.

> To view more about the new API structure, refer to [API overview](ref:api-overview).

{{< admonition type="caution" >}}
The API is currently in [public preview](https://grafana.com/docs/release-life-cycle/#public-preview) and might be subject to changes.
{{< /admonition >}}

The Grafana Secrets Management API allows you to manage secrets that are used by other services and applications within your Grafana instance.

### Decrypters

The decrypters field is an allowlist that lets the secure value know which services and apps can decrypt the secret value.

Currently available decrypters:

- `synthetic-monitoring` (for Synthetic Monitoring checks)
- `provisioning.grafana.app` (for GitSync/Provisioning)

## Create a secure value

`POST /apis/secret.grafana.app/v1beta1/namespaces/:namespace/securevalues`

Creates a new secure value.

**URL parameters**

- `namespace`: To read more about which namespace to use, see the [API overview](ref:api-overview).

**Request body**

- `metadata.name`: The Grafana unique identifier. If you do not want to provide this, set `metadata.generateName` instead to the prefix you would like for the randomly generated uid (can't be an empty string).
- `spec.description`: Short description that explains the purpose of this secure value. Required. Up to 25 characters long.
- `spec.value`: The secret value to store. Required. Up to 24576 bytes long.
- `spec.decrypters`: List of services allowed to decrypt this secure value. Up to 64 items, see note in [decrypters](#decrypters) for a list of supported values.

**Required permissions**

See note in the [introduction](#secrets-management-api) for an explanation.

<!-- prettier-ignore-start -->
| Action                       | Scope                                     |
| ---------------------------- | ----------------------------------------- |
| `secret.securevalues:create` | <ul><li>`secret.securevalues:*`</li></ul> |
{ .no-spacing-list }
<!-- prettier-ignore-end -->

**Example create request**:

```http
POST /apis/secret.grafana.app/v1beta1/namespaces/default/securevalues HTTP/1.1
Accept: application/json
Content-Type: application/json
Authorization: Bearer eyJrIjoiT0tTcG1pUlY2RnVKZTFVaDFsNFZXdE9ZWmNrMkZYbk

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

**Example response**:

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

Status Codes:

- **201** – Created
- **400** – Errors (invalid JSON, missing or invalid fields, etc)
- **401** – Unauthorized
- **403** – Access denied
- **409** – Conflict (secure value with the same name already exists)

{{< admonition type="note">}}
The `spec.value` field is never returned by API endpoints. Users cannot not decrypt secrets.
{{< /admonition >}}

## List secure values

`GET /apis/secret.grafana.app/v1beta1/namespaces/:namespace/securevalues`

List all secure values in a namespace.

**URL parameters**

- `namespace`: To read more about which namespace to use, see the [API overview](ref:api-overview).

**Query parameters**

- `labelSelector`: Filter secure values by labels.

**Required permissions**

See note in the [introduction](#secrets-management-api) for an explanation.

<!-- prettier-ignore-start -->
| Action                       | Scope                                     |
| ---------------------------- | ----------------------------------------- |
| `secret.securevalues:read`   | <ul><li>`secret.securevalues:*`</li></ul> |
{ .no-spacing-list }
<!-- prettier-ignore-end -->

**Example list request**:

```http
GET /apis/secret.grafana.app/v1beta1/namespaces/default/securevalues HTTP/1.1
Accept: application/json
Content-Type: application/json
Authorization: Bearer eyJrIjoiT0tTcG1pUlY2RnVKZTFVaDFsNFZXdE9ZWmNrMkZYbk
```

**Example response**:

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

Status Codes:

- **200** – OK
- **401** – Unauthorized
- **403** – Access denied

## Get a secure value

`GET /apis/secret.grafana.app/v1beta1/namespaces/:namespace/securevalues/:name`

Get the details of a specific secure value. It will not return the secret value.

**URL parameters**

- `namespace`: To read more about which namespace to use, see the [API overview](ref:api-overview).
- `name`: The name of the secure value.

**Required permissions**

See note in the [introduction](#secrets-management-api) for an explanation.

<!-- prettier-ignore-start -->
| Action                       | Scope                                     |
| ---------------------------- | ----------------------------------------- |
| `secret.securevalues:read`   | <ul><li>`secret.securevalues:*`</li></ul> |
{ .no-spacing-list }
<!-- prettier-ignore-end -->

**Example get request**:

```http
GET /apis/secret.grafana.app/v1beta1/namespaces/default/securevalues/api-key HTTP/1.1
Accept: application/json
Content-Type: application/json
Authorization: Bearer eyJrIjoiT0tTcG1pUlY2RnVKZTFVaDFsNFZXdE9ZWmNrMkZYbk
```

**Example response**:

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

Status Codes:

- **200** – OK
- **401** – Unauthorized
- **403** – Access denied
- **404** – Not found

## Update a secure value

`PUT /apis/secret.grafana.app/v1beta1/namespaces/:namespace/securevalues/:name`

Replace an existing secure value with a new specification.

**URL parameters**

- `namespace`: To read more about which namespace to use, see the [API overview](ref:api-overview).
- `name`: The name of the secure value.

**Request body**

- `spec.description`: Short description that explains the purpose of this secure value. Required. Up to 25 characters long.
- `spec.value`: The secret value to store. Required. Up to 24576 bytes long.
- `spec.decrypters`: List of services allowed to decrypt this secure value. Up to 64 items, see note in [decrypters](#decrypters) for a list of supported values.

**Required permissions**

See note in the [introduction](#secrets-management-api) for an explanation.

<!-- prettier-ignore-start -->
| Action                      | Scope                                     |
| --------------------------- | ----------------------------------------- |
| `secret.securevalues:write` | <ul><li>`secret.securevalues:*`</li></ul> |
{ .no-spacing-list }
<!-- prettier-ignore-end -->

**Example update request**:

```http
PUT /apis/secret.grafana.app/v1beta1/namespaces/default/securevalues/api-key HTTP/1.1
Accept: application/json
Content-Type: application/json
Authorization: Bearer eyJrIjoiT0tTcG1pUlY2RnVKZTFVaDFsNFZXdE9ZWmNrMkZYbk

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

**Example response**:

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

Status Codes:

- **200** – OK
- **400** – Errors (invalid JSON, missing or invalid fields, etc)
- **401** – Unauthorized
- **403** – Access denied
- **404** – Not found

## Delete a secure value

`DELETE /apis/secret.grafana.app/v1beta1/namespaces/:namespace/securevalues/:name`

Permanently delete a secure value. This also deletes the underlying stored secret value.

**URL parameters**

- `namespace`: To read more about the namespace to use, see the [API overview](ref:api-overview).
- `name`: The name of the secure value.

**Required permissions**

See note in the [introduction](#secrets-management-api) for an explanation.

<!-- prettier-ignore-start -->
| Action                       | Scope                                     |
| ---------------------------- | ----------------------------------------- |
| `secret.securevalues:delete` | <ul><li>`secret.securevalues:*`</li></ul> |
{ .no-spacing-list }
<!-- prettier-ignore-end -->

**Example delete request**:

```http
DELETE /apis/secret.grafana.app/v1beta1/namespaces/default/securevalues/api-key HTTP/1.1
Accept: application/json
Content-Type: application/json
Authorization: Bearer eyJrIjoiT0tTcG1pUlY2RnVKZTFVaDFsNFZXdE9ZWmNrMkZYbk
```

**Example response**:

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

Status Codes:

- **200** – OK
- **401** – Unauthorized
- **403** – Access denied
- **404** – Not found
