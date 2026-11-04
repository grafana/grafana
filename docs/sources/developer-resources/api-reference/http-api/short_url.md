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

{{< /admonition >}}




- **Create a short URL:** `POST /apis/shorturl.grafana.app/v1beta1/namespaces/{namespace}/shorturls`
- **Retrieve a short URL:** `GET /apis/shorturl.grafana.app/v1beta1/namespaces/{namespace}/shorturls/{name}`

The new API uses different request and response shapes than the endpoints on this page, so changing the URL alone isn't enough. Refer to the [Short URL API Swagger documentation](https://play.grafana.org/swagger?api=shorturl.grafana.app-v1beta1) for the schemas, and to [API structure in Grafana](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/developer-resources/api-reference/http-api/apis/) for how to determine the `{namespace}` for your instance.
{{< /admonition >}}

Use this API to create shortened URLs. A short URL represents a longer URL containing complex query parameters in a smaller and simpler format.



The Dashboard API (`/apis/dashboard.grafana.app/*`) replaces [`/api/dashboards/*`](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/developer-resources/api-reference/http-api/api-legacy/dashboard_public/), although there may not be an exact match for all legacy endpoints.

## Requirements

If you're running Grafana Enterprise, you'll need to have specific permissions for some endpoints. Refer to [Role-based access control permissions](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/administration/roles-and-permissions/access-control/custom-role-actions-scopes/) for more information.

## Endpoints

This document may not contain the latest version of the API. For the most up-to-date list of available endpoints, refer to [dashboard.grafana.app/v2](https://play.grafana.org/swagger?api=dashboard.grafana.app-v2) in Swagger.

| Method | Summary                                      | URI                                                                      |
| ------ | -------------------------------------------- | ------------------------------------------------------------------------ |
| POST   | [Create Dashboard](#create-dashboard)        | /apis/dashboard.grafana.app/v1/namespaces/:namespace/dashboards          |
| PUT    | [Update Dashboard](#update-dashboard)        | /apis/dashboard.grafana.app/v1/namespaces/:namespace/dashboards/:uid     |
| GET    | [Get Dashboard](#get-dashboard)              | /apis/dashboard.grafana.app/v1/namespaces/:namespace/dashboards/:uid     |
| GET    | [Get Dashboard (DTO format)](#get-dashboard) | /apis/dashboard.grafana.app/v1/namespaces/:namespace/dashboards/:uid/dto |
| GET    | [List Dashboards](#list-dashboards)          | /apis/dashboard.grafana.app/v1/namespaces/:namespace/dashboards          |
| DELETE | [Delete Dashboard](#delete-dashboard)        | /apis/dashboard.grafana.app/v1/namespaces/:namespace/dashboards/:uid     |

## Create Dashboard

`POST /apis/dashboard.grafana.app/v1/namespaces/:namespace/dashboards`

