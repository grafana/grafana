+++
title = "Authentication HTTP API "
description = "Grafana Authentication HTTP API"
keywords = ["grafana", "http", "documentation", "api", "authentication"]
aliases = ["/http_api/authentication/"]
type = "docs"
[menu.docs]
name = "Authentication HTTP API"
parent = "http_api"
+++

# Authentication API

## Tokens

Currently you can authenticate via an `API Token` or via a `Session cookie` (acquired using regular login or oauth).

## Basic Auth

If basic auth is enabled (it is enabled by default) you can authenticate your HTTP request via
standard basic auth. Basic auth will also authenticate LDAP users.

curl example:
```bash
?curl http://admin:admin@localhost:3000/api/org
{"id":1,"name":"Main Org."}
```

## Create API Token

Open the sidemenu and click the organization dropdown and select the `API Keys` option.

![](/img/docs/v2/orgdropdown_api_keys.png)

You use the token in all requests in the `Authorization` header, like this:

**Example**:

```http
GET http://your.grafana.com/api/dashboards/db/mydash HTTP/1.1
Accept: application/json
Authorization: Bearer eyJrIjoiT0tTcG1pUlY2RnVKZTFVaDFsNFZXdE9ZWmNrMkZYbk
```

The `Authorization` header value should be `Bearer <your api key>`.

The API Token can also be passed as a Basic authorization password with the special username `api_key`:

curl example:
```bash
?curl http://api_key:eyJrIjoiT0tTcG1pUlY2RnVKZTFVaDFsNFZXdE9ZWmNrMkZYbk@localhost:3000/api/org
{"id":1,"name":"Main Org."}
```

# Auth HTTP resources / actions

## Api Keys

`GET /api/auth/keys`

**Example Request**:

```http
GET /api/auth/keys HTTP/1.1
Accept: application/json
Content-Type: application/json
Authorization: Bearer eyJrIjoiT0tTcG1pUlY2RnVKZTFVaDFsNFZXdE9ZWmNrMkZYbk
```

**Example Response**:

```http
HTTP/1.1 200
Content-Type: application/json

[
  {
    "id": 3,
    "name": "API",
    "role": "Admin"
  },
  {
    "id": 1,
    "name": "TestAdmin",
    "role": "Admin"
  }
]
```

## Create API Key

`POST /api/auth/keys`

**Example Request**:

```http
POST /api/auth/keys HTTP/1.1
Accept: application/json
Content-Type: application/json
Authorization: Bearer eyJrIjoiT0tTcG1pUlY2RnVKZTFVaDFsNFZXdE9ZWmNrMkZYbk

{
  "name": "mykey",
  "role": "Admin"
}
```

JSON Body schema:

- **name** – The key name
- **role** – Sets the access level/Grafana Role for the key. Can be one of the following values: `Viewer`, `Editor` or `Admin`.

**Example Response**:

```http
HTTP/1.1 200
Content-Type: application/json

{"name":"mykey","key":"eyJrIjoiWHZiSWd3NzdCYUZnNUtibE9obUpESmE3bzJYNDRIc0UiLCJuIjoibXlrZXkiLCJpZCI6MX1="}
```

## Delete API Key

`DELETE /api/auth/keys/:id`

**Example Request**:

```http
DELETE /api/auth/keys/3 HTTP/1.1
Accept: application/json
Content-Type: application/json
Authorization: Bearer eyJrIjoiT0tTcG1pUlY2RnVKZTFVaDFsNFZXdE9ZWmNrMkZYbk
```
**Example Response**:

```http
HTTP/1.1 200
Content-Type: application/json

{"message":"API key deleted"}
```