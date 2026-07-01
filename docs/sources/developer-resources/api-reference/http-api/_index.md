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

## List of available HTTP APIs

The following table lists all available HTTP API reference pages. New APIs are listed first, followed by legacy APIs.

| API                                                                               | Type   |
| --------------------------------------------------------------------------------- | ------ |
| [Dashboard HTTP API](./dashboard.md)                                              | New    |
| [Folder HTTP API](./folder.md)                                                    | New    |
| [Playlist HTTP API](./playlist.md)                                                | New    |
| [Resource history HTTP API](./resource-history.md)                                | New    |
| [Secrets Management HTTP API](./secrets_management.md)                            | New    |
| [Admin HTTP API](./api-legacy/admin.md)                                           | Legacy |
| [Alerting Provisioning HTTP API](./api-legacy/alerting_provisioning.md)           | Legacy |
| [Annotations HTTP API](./api-legacy/annotations.md)                               | Legacy |
| [Correlations HTTP API](./api-legacy/correlations.md)                             | Legacy |
| [Dashboard Permissions HTTP API](./api-legacy/dashboard_permissions.md)           | Legacy |
| [Dashboard Versions HTTP API](./api-legacy/dashboard_versions.md)                 | Legacy |
| [Data source HTTP API](./api-legacy/data_source.md)                               | Legacy |
| [Data source LBAC rules HTTP API](./api-legacy/datasource_lbac_rules.md)          | Legacy |
| [Data source permissions HTTP API](./api-legacy/datasource_permissions.md)        | Legacy |
| [Folder/Dashboard Search HTTP API](./api-legacy/folder_dashboard_search.md)       | Legacy |
| [Folder Permissions HTTP API](./api-legacy/folder_permissions.md)                 | Legacy |
| [Library Element HTTP API](./api-legacy/library_element.md)                       | Legacy |
| [Licensing HTTP API](./api-legacy/licensing.md)                                   | Legacy |
| [Organization HTTP API](./api-legacy/org.md)                                      | Legacy |
| [Other HTTP API](./api-legacy/other.md)                                           | Legacy |
| [Preferences API](./api-legacy/preferences.md)                                    | Legacy |
| [Query and Resource Caching HTTP API](./api-legacy/query_and_resource_caching.md) | Legacy |
| [Query History HTTP API](./api-legacy/query_history.md)                           | Legacy |
| [RBAC HTTP API](./api-legacy/access_control.md)                                   | Legacy |
| [Reporting API](./api-legacy/reporting.md)                                        | Legacy |
| [Service account HTTP API](./api-legacy/serviceaccount.md)                        | Legacy |
| [Shared Dashboards HTTP API](./api-legacy/dashboard_public.md)                    | Legacy |
| [Short URL HTTP API](./api-legacy/short_url.md)                                   | Legacy |
| [Snapshot API](./api-legacy/snapshot.md)                                          | Legacy |
| [SSO Settings API](./api-legacy/sso-settings.md)                                  | Legacy |
| [Team HTTP API](./api-legacy/team.md)                                             | Legacy |
| [Team Sync HTTP API](./api-legacy/team_sync.md)                                   | Legacy |
| [User HTTP API](./api-legacy/user.md)                                             | Legacy |
