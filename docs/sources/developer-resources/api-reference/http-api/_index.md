---
aliases:
  - ../../http_api/ # /docs/grafana/next/http_api/
  - ../../overview/ # /docs/grafana/next/overview/
  - ../../../developers/http_api/ # /docs/grafana/developers/http_api/
  - ../../developers/http_api/ # /docs/grafana/next/developers/http_api/
canonical: https://grafana.com/docs/grafana/latest/developer-resources/api-reference/http-api/
description: Grafana HTTP API
keywords:
  - grafana
  - http
  - documentation
  - api
  - overview
labels:
  products:
    - enterprise
    - oss
    - cloud
title: HTTP API
weight: 100
---

# Grafana HTTP API reference guide

Every Grafana instance exposes an HTTP API, used by the Grafana frontend to manage resources like saving dashboards, creating users, updating data sources, deleting alerts, and more. You can use the HTTP API to programmatically access or manage resources from your Grafana instance.

If you need to manage or access other resources from your [Grafana Cloud Stack](https://grafana.com/docs/grafana-cloud/account-management/cloud-stacks/), refer to the [Grafana Cloud API](https://grafana.com/docs/grafana-cloud/developer-resources/api-reference/cloud-api/) instead.

## New generation HTTP APIs

Grafana is deprecating legacy APIs (`/api`) in favor of a new generation of improved APIs (`/apis`) which follow a standardized API structure alongside consistent API versioning.

To learn more refer to the new [API structure in Grafana](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/developer-resources/api-reference/http-api/apis/) and the [API migration guide](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/developer-resources/api-reference/http-api/apis-migration/).

## The Grafana API specification

HTTP API specs are available in Swagger:

- [OpenAPI v2 specification](https://editor.swagger.io/?url=https://raw.githubusercontent.com/grafana/grafana/main/public/api-merged.json)
- [OpenAPI v3 specification](https://editor.swagger.io/?url=https://raw.githubusercontent.com/grafana/grafana/main/public/openapi3.json), generated from the v2 specs

You can browse and try out both via the Swagger UI editor (served by the Grafana server) by navigating to `/swagger-ui`.

## Authentication

In OSS, you can authenticate your requests to the HTTP APIs using basic auth or a service account token. In Grafana Cloud, only the service account token option is available. For more details refer to [HTTP API authentication](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/developer-resources/api-reference/http-api/authentication).
