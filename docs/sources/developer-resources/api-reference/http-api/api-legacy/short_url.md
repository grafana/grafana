---
aliases:
  - ../../../../http_api/short_url/ # /docs/grafana/next/http_api/short_url/
  - ../../../../developers/http_api/short_url/ # /docs/grafana/next/developers/http_api/short_url/
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

{{< docs/shared lookup="developers/deprecated-apis.md" source="grafana" version="<GRAFANA_VERSION>" >}}

{{< admonition type="note" >}}
Grafana announced the deprecation of this API on September 23, 2026. Use the `shorturl.grafana.app/v1beta1` API group instead:

- **Create a short URL:** `POST /apis/shorturl.grafana.app/v1beta1/namespaces/{namespace}/shorturls`
- **Retrieve a short URL:** `GET /apis/shorturl.grafana.app/v1beta1/namespaces/{namespace}/shorturls/{name}`

The new API uses different request and response shapes than the endpoints on this page, so changing the URL alone isn't enough. Refer to the [Short URL API Swagger documentation](https://play.grafana.org/swagger?api=shorturl.grafana.app-v1beta1) for the schemas, and to [API structure in Grafana](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/developer-resources/api-reference/http-api/apis/) for how to determine the `{namespace}` for your instance.
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
Authorization: Bearer <SERVICE_ACCOUNT_TOKEN>

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
