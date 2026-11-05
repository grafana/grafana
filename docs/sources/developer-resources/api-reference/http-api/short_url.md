---
aliases:
canonical: https://grafana.com/docs/grafana/latest/developer-resources/api-reference/http-api/short_url/
description: Grafana Short URL HTTP API
keywords:
  - grafana
  - http
  - documentation
  - api
  - dashboard
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
Available in Grafana 12 and later.

This API complies with the new Grafana API structure. To learn more refer to documentation about the [API structure in Grafana](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/developer-resources/api-reference/http-api/apis).

This document may not contain the latest version of the API. For the most up-to-date list of available schemas, refer to [Short URL API Swagger documentation](https://play.grafana.org/swagger?api=shorturl.grafana.app-v1beta1).

{{< /admonition >}}

Use this API to create shortened URLs. A short URL represents a longer URL containing complex query parameters in a smaller and simpler format.

**The Short URL HTTP API (`/apis/shorturl.grafana.app/*`) replaces [`/api/short-urls/`](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/developer-resources/api-reference/http-api/api-legacy/short_url/), but it uses different request and response shapes than the legacy endpoints**, so changing the URL alone isn't enough. Read on the understand the differences.

## Endpoints



To determine the `{namespace}` for your instance, refer to [API structure in Grafana](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/developer-resources/api-reference/http-api/apis/).

| Method | Summary                                       | URI                                                                          |
| ------ | --------------------------------------------- | ---------------------------------------------------------------------------- |
| POST   | [Create a short URL](#create-a-short-url)     | `/apis/shorturl.grafana.app/v1beta1/namespaces/{namespace}/shorturls`        |
| GET    | [Retrieve a short URL](#retrieve-a-short-url) | `/apis/shorturl.grafana.app/v1beta1/namespaces/{namespace}/shorturls/{name}` |

## Create a short URL



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





