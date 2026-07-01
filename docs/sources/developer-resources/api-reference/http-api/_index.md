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

| API                                                                                                                                                                         | Type   | Legacy API replaced |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ | ------------------- |
| [Dashboard HTTP API](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/developer-resources/api-reference/http-api/dashboard/)                                              | New    | `/api/dashboards/*` |
| [Folder HTTP API](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/developer-resources/api-reference/http-api/folder/)                                                    | New    | `/api/folders/*`    |
| [Playlist HTTP API](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/developer-resources/api-reference/http-api/playlist/)                                                | New    | Not available       |
| [Resource history HTTP API](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/developer-resources/api-reference/http-api/resource-history/)                                | New    | Not available       |
| [Secrets Management HTTP API](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/developer-resources/api-reference/http-api/secrets_management/)                            | New    | Not available       |
| [Admin HTTP API](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/developer-resources/api-reference/http-api/api-legacy/admin/)                                           | Legacy | Not Applicable      |
| [Alerting Provisioning HTTP API](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/developer-resources/api-reference/http-api/api-legacy/alerting_provisioning/)           | Legacy | Not Applicable      |
| [Annotations HTTP API](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/developer-resources/api-reference/http-api/api-legacy/annotations/)                               | Legacy | Not Applicable      |
| [Correlations HTTP API](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/developer-resources/api-reference/http-api/api-legacy/correlations/)                             | Legacy | Not Applicable      |
| [Dashboard Permissions HTTP API](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/developer-resources/api-reference/http-api/api-legacy/dashboard_permissions/)           | Legacy | Not Applicable      |
| [Dashboard Versions HTTP API](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/developer-resources/api-reference/http-api/api-legacy/dashboard_versions/)                 | Legacy | Not Applicable      |
| [Data source HTTP API](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/developer-resources/api-reference/http-api/api-legacy/data_source/)                               | Legacy | Not Applicable      |
| [Data source LBAC rules HTTP API](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/developer-resources/api-reference/http-api/api-legacy/datasource_lbac_rules/)          | Legacy | Not Applicable      |
| [Data source permissions HTTP API](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/developer-resources/api-reference/http-api/api-legacy/datasource_permissions/)        | Legacy | Not Applicable      |
| [Folder/Dashboard Search HTTP API](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/developer-resources/api-reference/http-api/api-legacy/folder_dashboard_search/)       | Legacy | Not Applicable      |
| [Folder Permissions HTTP API](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/developer-resources/api-reference/http-api/api-legacy/folder_permissions/)                 | Legacy | Not Applicable      |
| [Library Element HTTP API](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/developer-resources/api-reference/http-api/api-legacy/library_element/)                       | Legacy | Not Applicable      |
| [Licensing HTTP API](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/developer-resources/api-reference/http-api/api-legacy/licensing/)                                   | Legacy | Not Applicable      |
| [Organization HTTP API](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/developer-resources/api-reference/http-api/api-legacy/org/)                                      | Legacy | Not Applicable      |
| [Other HTTP API](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/developer-resources/api-reference/http-api/api-legacy/other/)                                           | Legacy | Not Applicable      |
| [Preferences API](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/developer-resources/api-reference/http-api/api-legacy/preferences/)                                    | Legacy | Not Applicable      |
| [Query and Resource Caching HTTP API](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/developer-resources/api-reference/http-api/api-legacy/query_and_resource_caching/) | Legacy | Not Applicable      |
| [Query History HTTP API](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/developer-resources/api-reference/http-api/api-legacy/query_history/)                           | Legacy | Not Applicable      |
| [RBAC HTTP API](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/developer-resources/api-reference/http-api/api-legacy/access_control/)                                   | Legacy | Not Applicable      |
| [Reporting API](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/developer-resources/api-reference/http-api/api-legacy/reporting/)                                        | Legacy | Not Applicable      |
| [Service account HTTP API](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/developer-resources/api-reference/http-api/api-legacy/serviceaccount/)                        | Legacy | Not Applicable      |
| [Shared Dashboards HTTP API](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/developer-resources/api-reference/http-api/api-legacy/dashboard_public/)                    | Legacy | Not Applicable      |
| [Short URL HTTP API](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/developer-resources/api-reference/http-api/api-legacy/short_url/)                                   | Legacy | Not Applicable      |
| [Snapshot API](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/developer-resources/api-reference/http-api/api-legacy/snapshot/)                                          | Legacy | Not Applicable      |
| [SSO Settings API](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/developer-resources/api-reference/http-api/api-legacy/sso-settings/)                                  | Legacy | Not Applicable      |
| [Team HTTP API](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/developer-resources/api-reference/http-api/api-legacy/team/)                                             | Legacy | Not Applicable      |
| [Team Sync HTTP API](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/developer-resources/api-reference/http-api/api-legacy/team_sync/)                                   | Legacy | Not Applicable      |
| [User HTTP API](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/developer-resources/api-reference/http-api/api-legacy/user/)                                             | Legacy | Not Applicable      |
