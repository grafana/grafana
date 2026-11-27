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
weight: 02
---

# Migrate to the new Grafana APIs

{{< admonition type="note" >}}
New APIs are available in Grafana 12 and later.
Legacy APIs are deprecated starting in Grafana 13.
{{< /admonition >}}

Grafana is migrating existing APIs to the new `/apis` model, a Kubernetes-style API layer which follows a standardized API structure alongside consistent API versioning. Refer to the [New API structure in Grafana](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/developer-resources/api-reference/http-api/apis) documentation for more details.

**Legacy APIs are not being disabled for the moment**. Removal of legacy APIs is planned for a future major release, and any breaking changes will be announced well in advance to avoid disruptions.

## Deprecation notes

The API migration process is underway and there may not be an exact `/apis` match to the legacy API you're using. Some legacy APIs may not be migrated at all. For details, refer to [List of available HTTP APIs](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/developer-resources/api-reference/http-api#list-of-available-http-apis) table.

### Alerting Provisioning API

The [Alerting Provisioning HTTP API](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/developer-resources/api-reference/http-api/api-legacy/alerting_provisioning/) is partially replaced by two `/apis` groups:

- **[Alert rules HTTP API](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/developer-resources/api-reference/http-api/alert-rules/):** Replaces the alert rule and rule group endpoints (`/api/v1/provisioning/alert-rules*` and `/api/v1/provisioning/folder/:folderUid/rule-groups/:group`). To learn how the endpoints match, refer to [Migrate from the legacy Alerting Provisioning API](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/developer-resources/api-reference/http-api/alert-rules/#migrate-from-the-legacy-alerting-provisioning-api).
- **[Alert notifications HTTP API](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/developer-resources/api-reference/http-api/alert-notifications/):** Replaces the contact points, notification policies, template groups, and mute timings endpoints. To learn how the endpoints match, refer to [Migrate from the legacy Alerting Provisioning API](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/developer-resources/api-reference/http-api/alert-notifications/#migrate-from-the-legacy-alerting-provisioning-api).

The file-provisioning `export` endpoints (`/api/v1/provisioning/*/export`) and receiver permission endpoints (`/api/access-control/receivers/*`) don't have `/apis` equivalents yet and remain on the legacy API.

### Query history API

The [Query History API](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/developer-resources/api-reference/http-api/api-legacy/query_history) is partially replaced by the [Queries HTTP API](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/developer-resources/api-reference/http-api/queries/), which is only available in Grafana Enterprise and Grafana Cloud. If you use the Query History API to keep queries on the server, you can save them as saved queries instead. To learn how the endpoints match, refer to [Differences from the legacy Query history API](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/developer-resources/api-reference/http-api/queries/#differences-from-the-legacy-query-history-api).

The rest of the query history functionality is being deprecated. Grafana will revert to using local on-device storage for query history, since this approach reduces the amount of traffic to the backend with minimal change in functionality. If you're using this API to record query history, consider using a similar approach.
