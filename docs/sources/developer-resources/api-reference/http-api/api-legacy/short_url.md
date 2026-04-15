---
aliases:
  - ../../../http_api/short_url/ # /docs/grafana/next/http_api/short_url/
  - ../../../developers/http_api/short_url/ # /docs/grafana/next/developers/http_api/short_url/
  - ../../../../developer-resources/api-reference/http-api/short_url/ #legacy folder
canonical: https://grafana.com/docs/grafana/latest/developer-resources/api-reference/http-api/api-legacy/short_url/
description: Grafana Short URL HTTP API
keywords:
  - grafana
  - http
  - documentation
  - api
  - shortUrl
labels:
  products:
    - enterprise
    - oss
    - cloud
title: 'Short URL HTTP API '
---

# Short URL API

{{< admonition type="caution" >}}

Starting in Grafana 13, `/api` endpoints are being deprecated. This change doesn't disrupt or break your current setup: legacy APIs are not being disabled and remain fully accessible and operative. However, `/api` routes will no longer be updated and **will be removed in a future major release.**

To learn more refer to the [new API structure in Grafana](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/developer-resources/api-reference/http-api/apis).

{{< /admonition >}}

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

- **path** – The path to shorten, relative to the Grafana [root_url](/docs/grafana/latest/setup-grafana/configure-grafana/#root_url).

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
