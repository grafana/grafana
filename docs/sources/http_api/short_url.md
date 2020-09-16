+++
title = "ShortURL HTTP API "
description = "Grafana ShortURL HTTP API"
keywords = ["grafana", "http", "documentation", "api", "shortUrl"]
aliases = ["/docs/grafana/latest/http_api/short_url/"]
type = "docs"
[menu.docs]
name = "ShortURL"
parent = "http_api"
+++

# ShortURL API

## Redirect to full path from short URL UID

`GET /api/goto/:uid`

Redirects to the URL path associated with the given UID if it exists. Otherwise redirects to `/notfound`.

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

## Create short URL

`POST /api/goto`

Creates a new short URL.

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

AT76wBvGk
```

Status Codes:

- **200** – Created
- **400** – Errors (invalid json, missing or invalid fields)
