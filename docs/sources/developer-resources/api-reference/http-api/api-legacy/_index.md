---
aliases:
  - ../../http_api/ # /docs/grafana/next/http_api/
  - ../../overview/ # /docs/grafana/next/overview/
  - ../../../developers/http_api/ # /docs/grafana/developers/http_api/
  - ../../developers/http_api/ # /docs/grafana/next/developers/http_api/
canonical: https://grafana.com/docs/grafana/latest/developer-resources/api-reference/http-api/api-legacy
description: Legacy Grafana HTTP API
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
title: Legacy Grafana HTTP API
weight: 1000
---

# Legacy Grafana HTTP API

Grafana 13 marks the deprecation of legacy API endpoints in favor of a new generation of improved APIs (`/apis`), a Kubernetes-style API layer which follows a standardized API structure alongside consistent API versioning. To learn more refer to the [new API structure in Grafana](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/developer-resources/api-reference/http-api/apis).

This change doesn't disrupt or break your current setup. Legacy `/api` endpoints are not being disabled or removed, they remain fully accessible and will continue to work. However, `/api` routes will no longer be updated and **will be removed in a future major release.**
