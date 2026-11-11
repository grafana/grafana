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

You can browse and try out both via the Swagger UI editor, served by the Grafana server, by navigating to `/swagger`.

## Authentication

In OSS, you can authenticate your requests to the HTTP APIs using basic auth or a service account token. In Grafana Cloud, only the service account token option is available. For more details refer to [HTTP API authentication](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/developer-resources/api-reference/http-api/authentication).

## List of available HTTP APIs

The following table lists all available HTTP APIs that comply with the new structure:

| API                                                                                                                                              | Type                                | Replaces legacy API                                                                                                                                                   |
| ------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [Advisor HTTP API](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/developer-resources/api-reference/http-api/advisor/)                       | **New**                             | No                                                                                                                                                                    |
| [Alert enrichment HTTP API (Swagger)](https://play.grafana.org/swagger?api=alertenrichment.grafana.app-v1beta1)                                  | **New**                             | No                                                                                                                                                                    |
| [Alert notifications HTTP API (Swagger)](https://play.grafana.org/swagger?api=notifications.alerting.grafana.app-v1beta1)                        | **New**                             | No                                                                                                                                                                    |
| [Annotations HTTP API](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/developer-resources/api-reference/http-api/annotations/)               | **New**                             | [`/api/annotations/*`](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/developer-resources/api-reference/http-api/api-legacy/annotations/)                         |
| [Banners HTTP API (Swagger)](https://play.grafana.org/swagger?api=banners.grafana.app-v0alpha1)                                                  | **New**                             | No                                                                                                                                                                    |
| [Dashboard HTTP API](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/developer-resources/api-reference/http-api/dashboard/)                   | **New**                             | `/api/dashboards/*`                                                                                                                                                   |
| [Folder HTTP API](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/developer-resources/api-reference/http-api/folder/)                         | **New**                             | `/api/folders/*`                                                                                                                                                      |
| [Notebooks HTTP API](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/developer-resources/api-reference/http-api/notebooks/)                   | **New**                             | No                                                                                                                                                                    |
| [SLO (Swagger) / Kubernetes CRD](https://play.grafana.org/swagger?api=grafana-slo-app.plugins.grafana.com-v1)                                    | **New - Cloud only**                | No                                                                                                                                                                    |
| [Playlist HTTP API](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/developer-resources/api-reference/http-api/playlist/)                     | **New**                             | No                                                                                                                                                                    |
| [Preferences HTTP API](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/developer-resources/api-reference/http-api/preferences/)               | **New**                             | [`/api/*/preferences`](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/developer-resources/api-reference/http-api/api-legacy/preferences/)                         |
| [Queries HTTP API](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/developer-resources/api-reference/http-api/queries/)                       | **New - Enterprise and Cloud only** | Partially, [`/api/query-history/*`](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/developer-resources/api-reference/http-api/api-legacy/query_history/)          |
| [Resource history HTTP API](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/developer-resources/api-reference/http-api/resource-history/)     | **New**                             | [`/api/dashboards/uid/:uid/versions/*`](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/developer-resources/api-reference/http-api/api-legacy/dashboard_versions/) |
| [Secrets Management HTTP API](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/developer-resources/api-reference/http-api/secrets_management/) | **New - Enterprise and Cloud only** | No                                                                                                                                                                    |
| [Short URL HTTP API](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/developer-resources/api-reference/http-api/short_url/)                   | **New**                             | [`/api/short-urls/*`](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/developer-resources/api-reference/http-api/api-legacy/short_url/)                            |
| [Stars HTTP API](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/developer-resources/api-reference/http-api/stars/)                           | **New**                             | `/api/collection/*`                                                                                                                                                   |

### Legacy APIs

These are some of the legacy APIs:

| API                                                                                                                                                                         | Type       | Replaced by                                                                                                                                  |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| [Admin HTTP API](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/developer-resources/api-reference/http-api/api-legacy/admin/)                                           | Deprecated | Not available yet                                                                                                                            |
| [Alerting Provisioning HTTP API](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/developer-resources/api-reference/http-api/api-legacy/alerting_provisioning/)           | Deprecated | Not available yet                                                                                                                            |
| [Annotations HTTP API](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/developer-resources/api-reference/http-api/api-legacy/annotations/)                               | Deprecated | [Annotations HTTP API](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/developer-resources/api-reference/http-api/annotations/)           |
| [Correlations HTTP API](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/developer-resources/api-reference/http-api/api-legacy/correlations/)                             | Deprecated | Not available yet                                                                                                                            |
| [Dashboard Permissions HTTP API](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/developer-resources/api-reference/http-api/api-legacy/dashboard_permissions/)           | Deprecated | Not available yet                                                                                                                            |
| [Dashboard Versions HTTP API](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/developer-resources/api-reference/http-api/api-legacy/dashboard_versions/)                 | Deprecated | [Resource history HTTP API](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/developer-resources/api-reference/http-api/resource-history/) |
| [Data source HTTP API](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/developer-resources/api-reference/http-api/api-legacy/data_source/)                               | Deprecated | Not available yet                                                                                                                            |
| [Data source LBAC rules HTTP API](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/developer-resources/api-reference/http-api/api-legacy/datasource_lbac_rules/)          | Deprecated | Not available yet                                                                                                                            |
| [Data source permissions HTTP API](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/developer-resources/api-reference/http-api/api-legacy/datasource_permissions/)        | Deprecated | Not available yet                                                                                                                            |
| [Folder/Dashboard Search HTTP API](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/developer-resources/api-reference/http-api/api-legacy/folder_dashboard_search/)       | Deprecated | Not available yet                                                                                                                            |
| [Folder Permissions HTTP API](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/developer-resources/api-reference/http-api/api-legacy/folder_permissions/)                 | Deprecated | Not available yet                                                                                                                            |
| [Library Element HTTP API](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/developer-resources/api-reference/http-api/api-legacy/library_element/)                       | Deprecated | Not available yet                                                                                                                            |
| [Licensing HTTP API](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/developer-resources/api-reference/http-api/api-legacy/licensing/)                                   | Deprecated | Not available yet                                                                                                                            |
| [Organization HTTP API](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/developer-resources/api-reference/http-api/api-legacy/org/)                                      | Deprecated | Not available yet                                                                                                                            |
| [Other HTTP API](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/developer-resources/api-reference/http-api/api-legacy/other/)                                           | Deprecated | Not available yet                                                                                                                            |
| [Preferences API](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/developer-resources/api-reference/http-api/api-legacy/preferences/)                                    | Deprecated | [Preferences HTTP API](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/developer-resources/api-reference/http-api/preferences/)           |
| [Query and Resource Caching HTTP API](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/developer-resources/api-reference/http-api/api-legacy/query_and_resource_caching/) | Deprecated | Not available yet                                                                                                                            |
| [Query History HTTP API](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/developer-resources/api-reference/http-api/api-legacy/query_history/)                           | Deprecated | Partially, [Queries HTTP API](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/developer-resources/api-reference/http-api/queries/)        |
| [RBAC HTTP API](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/developer-resources/api-reference/http-api/api-legacy/access_control/)                                   | Deprecated | Not available yet                                                                                                                            |
| [Reporting API](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/developer-resources/api-reference/http-api/api-legacy/reporting/)                                        | Deprecated | Not available yet                                                                                                                            |
| [Service account HTTP API](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/developer-resources/api-reference/http-api/api-legacy/serviceaccount/)                        | Deprecated | Not available yet                                                                                                                            |
| [Shared Dashboards HTTP API](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/developer-resources/api-reference/http-api/api-legacy/dashboard_public/)                    | Deprecated | Not available yet                                                                                                                            |
| [Short URL HTTP API](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/developer-resources/api-reference/http-api/api-legacy/short_url/)                                   | Deprecated | [Short URL HTTP API](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/developer-resources/api-reference/http-api/short_url/)               |
| [Snapshot API](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/developer-resources/api-reference/http-api/api-legacy/snapshot/)                                          | Deprecated | Not available yet                                                                                                                            |
| [SSO Settings API](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/developer-resources/api-reference/http-api/api-legacy/sso-settings/)                                  | Deprecated | Not available yet                                                                                                                            |
| Stars API - `/user/stars/*`                                                                                                                                                 | Deprecated | [Stars HTTP API](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/developer-resources/api-reference/http-api/stars/)                       |
| [Team HTTP API](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/developer-resources/api-reference/http-api/api-legacy/team/)                                             | Deprecated | Not available yet                                                                                                                            |
| [Team Sync HTTP API](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/developer-resources/api-reference/http-api/api-legacy/team_sync/)                                   | Deprecated | Not available yet                                                                                                                            |
| [User HTTP API](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/developer-resources/api-reference/http-api/api-legacy/user/)                                             | Deprecated | Not available yet                                                                                                                            |

## Related resources

Use the following resources to keep working with Grafana APIs:

- **API structure:** Refer to [The new API structure in Grafana](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/developer-resources/api-reference/http-api/apis).
- **Migration guide:** Refer to [Migrate to the new APIs](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/developer-resources/api-reference/http-api/apis-migration).
- **Swagger UI:** Open the `/swagger` page in your Grafana instance to inspect endpoint schemas and try requests.
