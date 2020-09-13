+++
title = "ShortUrl HTTP API "
description = "Grafana ShortUrl HTTP API"
keywords = ["grafana", "http", "documentation", "api", "shortUrl"]
aliases = ["/docs/grafana/latest/http_api/short_url/"]
type = "docs"
[menu.docs]
name = "ShortUrl"
parent = "http_api"
+++

# ShortUrl API

## Get path from short url uid

`GET /api/goto/:uid`

Returns redirect to path associated with the given uid. If it does not exist, returns redirect to `/notfound`

**Example Request**:

```http
GET /api/goto/abcde HTTP/1.1
Accept: application/json
Content-Type: application/json
Authorization: Bearer eyJrIjoiT0tTcG1pUlY2RnVKZTFVaDFsNFZXdE9ZWmNrMkZYbk
```

**Example Response**:

```http
HTTP/1.1 302
Content-Type: application/json

Location: /d/TxKARsmGz/new-dashboard?orgId=1&from=1599389322894&to=1599410922894
```

Status Codes:

- **302** – Redirect to resolved URL

## Create short url

`POST /api/goto`

Creates a new short url.

**Example Request**:

```http
POST /api/goto HTTP/1.1
Accept: application/json
Content-Type: application/json
Authorization: Bearer eyJrIjoiT0tTcG1pUlY2RnVKZTFVaDFsNFZXdE9ZWmNrMkZYbk

{
  "path": "/d/TxKARsmGz/new-dashboard?orgId=1&from=1599389322894&to=1599410922894"
}
```

JSON Body schema:

- **path** – The path to shorten.

**Example Response**:

```http
HTTP/1.1 200
Content-Type: application/json

abcde
```

Status Codes:

- **200** – Created
- **400** – Errors (invalid json, missing or invalid fields, etc)
