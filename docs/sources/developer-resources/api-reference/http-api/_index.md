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

# Grafana HTTP API reference

Every Grafana instance exposes an HTTP API, which is the same API used by the Grafana frontend to manage resources like saving dashboards, creating users, updating data sources, deleting alerts, and more. You can use the HTTP API to programmatically access or manage resources from your Grafana instance.

If you need to manage or access other resources from your [Grafana Cloud Stack](https://grafana.com/docs/grafana-cloud/account-management/cloud-stacks/), refer to the [Grafana Cloud API](https://grafana.com/docs/grafana-cloud/developer-resources/api-reference/cloud-api/) instead.

## New generation HTTP APIs

Grafana is deprecating legacy APIs (`/api`) in favor of a new generation of improved APIs (`/apis`) which follow a standardized API structure alongside consistent API versioning. To learn more refer to the [new API structure in Grafana](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/developer-resources/api-reference/http-api/apis).

These are the available new generation APIs:

- [Dashboards API](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/developer-resources/api-reference/http-api/dashboard/)
- [Folder API](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/developer-resources/api-reference/http-api/folder/)
- [Playlist API](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/developer-resources/api-reference/http-api/playlist/)
- [Resource history API](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/developer-resources/api-reference/http-api/resource-history/)
- [Secrets Management API](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/developer-resources/api-reference/http-api/secrets_management/)

## Grafana API specification

HTTP API specs are available in Swagger:

- [OpenAPI v2 specification](https://editor.swagger.io/?url=https://raw.githubusercontent.com/grafana/grafana/main/public/api-merged.json)
- [OpenAPI v3 specification](https://editor.swagger.io/?url=https://raw.githubusercontent.com/grafana/grafana/main/public/openapi3.json), generated from the v2 specs

You can browser and try out both via the Swagger UI editor (served by the Grafana server) by navigating to `/swagger-ui`.

## Authenticate HTTP API requests

### Grafana OSS

{{< docs/shared lookup="developers/authentication.md" source="grafana" version="<GRAFANA_VERSION>" >}}

### Grafana Cloud

{{< docs/shared source="grafana-cloud" lookup="/developer-resources/authentication.md" version="" >}}

## X-Grafana-Org-Id Header

**X-Grafana-Org-Id** is an optional property that specifies the organization to which the action is applied. If not set, the created key belongs to the current context org. Use this header in all requests except those regarding admin.

**Example Request**:

```http
GET /api/org/ HTTP/1.1
Accept: application/json
Content-Type: application/json
X-Grafana-Org-Id: 2
Authorization: Bearer eyJrIjoiT0tTcG1pUlY2RnVKZTFVaDFsNFZXdE9ZWmNrMkZYbk
```
