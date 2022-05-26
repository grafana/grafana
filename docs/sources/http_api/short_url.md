---
aliases:
  - /docs/grafana/latest/http_api/short_url/
description: Grafana Short URL HTTP API
keywords:
  - grafana
  - http
  - documentation
  - api
  - shortUrl
title: 'Short URL HTTP API '
---

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
  "path": "d/TxKARsmGz/new-dashboard?orgId=1&from=1599389322894&to=1599410922894"
}
```

JSON body schema:

- **path** – The path to shorten, relative to the Grafana [root_url]({{< relref "../administration/configuration.md#root_url" >}}).

**Example response:**

```http
HTTP/1.1 200
Content-Type: application/json

{
  "uid": AT76wBvGk,
  "url": http://localhost:3000/goto/AT76wBvGk?orgId=1
}

```

Status codes:

- **200** – Created
- **400** – Errors (invalid JSON, missing or invalid fields)
