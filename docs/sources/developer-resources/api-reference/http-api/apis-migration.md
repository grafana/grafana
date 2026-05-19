---
aliases:
  - ../../../http_api/new_api_structure/ # /docs/grafana/next/http_api/new_api_structure/
  - ../../../developers/http_api/apis/ # /docs/grafana/next/developers/http_api/apis/
canonical: https://grafana.com/docs/grafana/latest/developer-resources/api-reference/http-api/apis/
description: ''
keywords:
  - grafana
  - http
  - documentation
  - api
labels:
  products:
    - enterprise
    - oss
    - cloud
title: Migrate to the new APIs
menuTitle: Migrate to new APIs
weight: 01
---

# Migrate to the new APIs

{{< admonition type="note" >}}
New APIs available in Grafana 12 and later.
Legacy APIs deprecated in Grafana 13.
{{< /admonition >}}

Grafana is migrating existing APIs to the new `/apis` model, a Kubernetes-style API layer which follows a standardized API structure alongside consistent API versioning. Refer to the [New API structure in Grafana](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/developer-resources/api-reference/http-api/apis) documentation for more details.

**Legacy APIs are not being disabled for the moment**. Removal of legacy APIs is planned for a future major release, and any breaking changes will be announced well in advance to avoid disruptions.

## Migration overview

The API migration process is underway and there may not be an exact `/apis` match to the legacy API you're using. Some legacy APIs may not be migrated at all.

Currently the following replacements apply:

| **Feature** | **Legacy API**      | **New API**                                                                                                                               |
| ----------- | ------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| Dashboards  | `/api/dashboards/*` | [`apis/dashboard.grafana.app/*`](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/developer-resources/api-reference/http-api/dashboard) |
| Folders     | `/api/folders/*`    | [`apis/folder.grafana.app/*`](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/developer-resources/api-reference/http-api/folder)       |

## Deprecation notes

### Query history API

The [Query History API](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/developer-resources/api-reference/http-api/api-legacy/query_history) will not be migrated.

This functionality is being deprecated. Grafana will revert to using local on-device storage for this functionality, since this approach reduces the amount of traffic to the backend with minimal change in functionality. If you're using this API, consider using a similar approach.
