+++
title = "Short URL HTTP API "
description = "Grafana Short URL HTTP API"
keywords = ["grafana", "http", "documentation", "api", "shortUrl"]
aliases = ["/docs/grafana/latest/http_api/short_url/"]
type = "docs"
[menu.docs]
name = "Short URL"
parent = "http_api"
+++

# Short URL API

Use this API to create shortened URLs. A short URL represents a longer URL containing complex query parameters in a smaller and simpler format.

## Create short URL

`POST /api/short-urls`

Creates a short URL.

**Example request:**

```http
POST /api/short-urls HTTP/1.1
Accept: application/json
Content-Type: application/json
Authorization: Bearer eyJrIjoiT0tTcG1pUlY2RnVKZTFVaDFsNFZXdE9ZWmNrMkZYbk

{
  "url": "http://localhost:3000/d/TxKARsmGz/new-dashboard?orgId=1&from=1599389322894&to=1599410922894"
}
```

JSON body schema:

- **url** – The url to shorten.

**Example response:**

```http
HTTP/1.1 200
Content-Type: application/json

AT76wBvGk
```

Status codes:

- **200** – Created
- **400** – Errors (invalid JSON, missing or invalid fields)
