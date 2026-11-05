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

These are the available endpoints:

| Method | Summary                                       | URI                                                                          |
| ------ | --------------------------------------------- | ---------------------------------------------------------------------------- |
| POST   | [Create a short URL](#create-a-short-url)     | `/apis/shorturl.grafana.app/v1beta1/namespaces/{namespace}/shorturls`        |
| GET    | [Retrieve a short URL](#retrieve-a-short-url) | `/apis/shorturl.grafana.app/v1beta1/namespaces/{namespace}/shorturls/{name}` |

To determine the `{namespace}` for your instance, refer to [API structure in Grafana](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/developer-resources/api-reference/http-api/apis/).

## Create a short URL







