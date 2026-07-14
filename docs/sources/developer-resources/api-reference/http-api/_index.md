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

To learn more refer to:

- The new [API structure in Grafana](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/developer-resources/api-reference/http-api/apis/) for information on the new HTTP API structure.
- The [API migration guide](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/developer-resources/api-reference/http-api/apis-migration/) for details on the legacy API deprecation process.

## The Grafana API specification

Grafana HTTP APIs comply both with the [OpenAPI v2 specification (Swagger 2.0)](https://editor.swagger.io/?url=https://raw.githubusercontent.com/grafana/grafana/main/public/api-merged.json) and [OpenAPI v3 specification](https://editor.swagger.io/?url=https://raw.githubusercontent.com/grafana/grafana/main/public/openapi3.json). While both describe the exact same set of Grafana HTTP API routes (dashboards, folders, data sources, organizations, users, teams, RBAC, alerting provisioning...), v2 is the canonical specification and source of truth, and v3 is converted from the v2 file using a conversion script.

If you're consuming a Grafana HTTP API:

- Use v2 if your tooling (SDK generators, older Swagger UI, `terraform-provider-grafana`) expects Swagger 2.0.
- Use v3 if your tooling requires OpenAPI 3.x (for example, newer codegen tools, some API gateways, Postman's newer import features).

You can browse and try out both via the Swagger UI editor, served by the Grafana server, by navigating to `/swagger-ui`.

## Authentication

In OSS, you can authenticate your requests to the HTTP APIs using basic auth or a service account token. In Grafana Cloud, only the service account token option is available. For more details refer to [HTTP API authentication](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/developer-resources/api-reference/http-api/authentication).

## List of available HTTP APIs

The following table lists all available HTTP API reference pages. New APIs are listed first, followed by legacy APIs.

| API                                                                                                                                                                         | Type                 | Replaces legacy API |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------- | ------------------- |
| [Alert enrichment HTTP API (Swagger)](https://play.grafana.org/swagger?api=alertenrichment.grafana.app-v1beta1)                                                             | **New**              | No                  |
| [Alert notifications HTTP API (Swagger)](https://play.grafana.org/swagger?api=notifications.alerting.grafana.app-v1beta1)                                                   | **New**              | No                  |
| [Banners HTTP API (Swagger)](https://play.grafana.org/swagger?api=banners.grafana.app-v0alpha1)                                                                             | **New**              | No                  |
| [Dashboard HTTP API](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/developer-resources/api-reference/http-api/dashboard/)                                              | **New**              | `/api/dashboards/*` |
| [Folder HTTP API](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/developer-resources/api-reference/http-api/folder/)                                                    | **New**              | `/api/folders/*`    |
| [SLO (Swagger)](https://play.grafana.org/swagger?api=grafana-slo-app.plugins.grafana.com-v1)                                                                                | **New - Cloud only** | No                  |
| [Playlist HTTP API](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/developer-resources/api-reference/http-api/playlist/)                                                | **New**              | No                  |
| [Resource history HTTP API](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/developer-resources/api-reference/http-api/resource-history/)                                | **New**              | No                  |
| [Secrets Management HTTP API](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/developer-resources/api-reference/http-api/secrets_management/)                            | **New**              | No                  |
| [Admin HTTP API](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/developer-resources/api-reference/http-api/api-legacy/admin/)                                           | Deprecated           | Not Applicable      |
| [Alerting Provisioning HTTP API](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/developer-resources/api-reference/http-api/api-legacy/alerting_provisioning/)           | Deprecated           | Not Applicable      |
| [Annotations HTTP API](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/developer-resources/api-reference/http-api/api-legacy/annotations/)                               | Deprecated           | Not Applicable      |
| [Correlations HTTP API](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/developer-resources/api-reference/http-api/api-legacy/correlations/)                             | Deprecated           | Not Applicable      |
| [Dashboard Permissions HTTP API](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/developer-resources/api-reference/http-api/api-legacy/dashboard_permissions/)           | Deprecated           | Not Applicable      |
| [Dashboard Versions HTTP API](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/developer-resources/api-reference/http-api/api-legacy/dashboard_versions/)                 | Deprecated           | Not Applicable      |
| [Data source HTTP API](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/developer-resources/api-reference/http-api/api-legacy/data_source/)                               | Deprecated           | Not Applicable      |
| [Data source LBAC rules HTTP API](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/developer-resources/api-reference/http-api/api-legacy/datasource_lbac_rules/)          | Deprecated           | Not Applicable      |
| [Data source permissions HTTP API](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/developer-resources/api-reference/http-api/api-legacy/datasource_permissions/)        | Deprecated           | Not Applicable      |
| [Folder/Dashboard Search HTTP API](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/developer-resources/api-reference/http-api/api-legacy/folder_dashboard_search/)       | Deprecated           | Not Applicable      |
| [Folder Permissions HTTP API](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/developer-resources/api-reference/http-api/api-legacy/folder_permissions/)                 | Deprecated           | Not Applicable      |
| [Library Element HTTP API](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/developer-resources/api-reference/http-api/api-legacy/library_element/)                       | Deprecated           | Not Applicable      |
| [Licensing HTTP API](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/developer-resources/api-reference/http-api/api-legacy/licensing/)                                   | Deprecated           | Not Applicable      |
| [Organization HTTP API](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/developer-resources/api-reference/http-api/api-legacy/org/)                                      | Deprecated           | Not Applicable      |
| [Other HTTP API](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/developer-resources/api-reference/http-api/api-legacy/other/)                                           | Deprecated           | Not Applicable      |
| [Preferences API](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/developer-resources/api-reference/http-api/api-legacy/preferences/)                                    | Deprecated           | Not Applicable      |
| [Query and Resource Caching HTTP API](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/developer-resources/api-reference/http-api/api-legacy/query_and_resource_caching/) | Deprecated           | Not Applicable      |
| [Query History HTTP API](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/developer-resources/api-reference/http-api/api-legacy/query_history/)                           | Deprecated           | Not Applicable      |
| [RBAC HTTP API](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/developer-resources/api-reference/http-api/api-legacy/access_control/)                                   | Deprecated           | Not Applicable      |
| [Reporting API](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/developer-resources/api-reference/http-api/api-legacy/reporting/)                                        | Deprecated           | Not Applicable      |
| [Service account HTTP API](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/developer-resources/api-reference/http-api/api-legacy/serviceaccount/)                        | Deprecated           | Not Applicable      |
| [Shared Dashboards HTTP API](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/developer-resources/api-reference/http-api/api-legacy/dashboard_public/)                    | Deprecated           | Not Applicable      |
| [Short URL HTTP API](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/developer-resources/api-reference/http-api/api-legacy/short_url/)                                   | Deprecated           | Not Applicable      |
| [Snapshot API](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/developer-resources/api-reference/http-api/api-legacy/snapshot/)                                          | Deprecated           | Not Applicable      |
| [SSO Settings API](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/developer-resources/api-reference/http-api/api-legacy/sso-settings/)                                  | Deprecated           | Not Applicable      |
| [Team HTTP API](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/developer-resources/api-reference/http-api/api-legacy/team/)                                             | Deprecated           | Not Applicable      |
| [Team Sync HTTP API](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/developer-resources/api-reference/http-api/api-legacy/team_sync/)                                   | Deprecated           | Not Applicable      |
| [User HTTP API](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/developer-resources/api-reference/http-api/api-legacy/user/)                                             | Deprecated           | Not Applicable      |

## Related resources

Use the following resources to keep working with Grafana APIs:

- **API structure:** Refer to [The new API structure in Grafana](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/developer-resources/api-reference/http-api/apis).
- **Migration guide:** Refer to [Migrate to the new APIs](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/developer-resources/api-reference/http-api/apis-migration).
- **Swagger UI:** Open the `/swagger` page in your Grafana instance to inspect endpoint schemas and try requests.
