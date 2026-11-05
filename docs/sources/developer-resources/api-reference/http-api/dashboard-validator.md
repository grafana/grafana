---
canonical: https://grafana.com/docs/grafana/latest/developer-resources/api-reference/http-api/dashboard-validator/
description: Grafana Dashboard validator HTTP API
keywords:
  - grafana
  - http
  - documentation
  - api
  - dashboard
  - validator
  - compatibility
labels:
  products:
    - enterprise
    - oss
    - cloud
title: Dashboard validator HTTP API
weight: 100
---

# Dashboard validator HTTP API

{{< admonition type="note" >}}
This API complies with the new Grafana API structure. To learn more refer to documentation about the [API structure in Grafana](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/developer-resources/api-reference/http-api/apis/).

**This document may not contain the latest version of the API. For the most up-to-date list of available endpoints, refer to [dashvalidator.grafana.app/v1alpha1](https://play.grafana.org/swagger?api=dashvalidator.grafana.app-v1alpha1) in Swagger.**
{{< /admonition >}}

Use this API to check whether a dashboard is compatible with a data source before you import it. The API extracts the queries from the dashboard JSON, finds the metrics each query uses, and checks which of those metrics exist in the data source. The response includes a compatibility score and lists the missing metrics for each panel query.

All paths use the `dashvalidator.grafana.app` group and the `v1alpha1` version. Replace `:namespace` with your namespace. To learn more about which namespace to use, refer to the [API overview](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/developer-resources/api-reference/http-api/apis/).

## Before you begin

**This API is experimental (`v1alpha1`) and might change**. For more details about versioning, refer to [New API versioning](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/developer-resources/api-reference/http-api/apis#version).

The API is disabled by default. To enable it in self-managed Grafana, turn on the `dashboardValidatorApp` [feature toggle](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/setup-grafana/configure-grafana/feature-toggles/).

The API currently has the following limitations:

- **Data sources:** Only Prometheus data sources are supported.
- **Number of data sources:** Each request validates the dashboard against exactly one data source.
- **Dashboard format:** Only dashboards in the classic JSON model, with a top-level `panels` array, are supported. Dashboards in the v2 schema, which use `elements` and `layout`, are rejected.

## Requirements

If you're running Grafana Enterprise or Grafana Cloud, you need the following permissions. For more information, refer to [Role-based access control permissions](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/administration/roles-and-permissions/access-control/custom-role-actions-scopes/).

| Action              | Scope                                                 |
| ------------------- | ----------------------------------------------------- |
| `datasources:read`  | `datasources:*` or `datasources:uid:<DATASOURCE_UID>` |
| `datasources:query` | `datasources:*` or `datasources:uid:<DATASOURCE_UID>` |
| `dashboards:create` | Any folder scope, for example `folders:*`             |

The data source scopes must include the data source you validate against. The `dashboards:create` action is checked at any scope, because the API doesn't save the dashboard.

## Endpoints

| Method | URI                                                                  | Summary                                                         |
| ------ | -------------------------------------------------------------------- | --------------------------------------------------------------- |
| POST   | /apis/dashvalidator.grafana.app/v1alpha1/namespaces/:namespace/check | [Check dashboard compatibility](#check-dashboard-compatibility) |

## Check dashboard compatibility

`POST /apis/dashvalidator.grafana.app/v1alpha1/namespaces/:namespace/check`

Checks a dashboard against a data source and returns a compatibility report. The dashboard doesn't need to exist in Grafana, so you can validate a dashboard JSON file before you import it.

- `namespace`: To learn more about which namespace to use, refer to the [API overview](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/developer-resources/api-reference/http-api/apis/).

**Example request**:

```http
POST /apis/dashvalidator.grafana.app/v1alpha1/namespaces/default/check HTTP/1.1
Accept: application/json
Content-Type: application/json
Authorization: Bearer <SERVICE_ACCOUNT_TOKEN>

{
  "dashboardJson": {
    "title": "Node overview",
    "panels": [
      {
        "id": 1,
        "title": "CPU usage",
        "type": "timeseries",
        "datasource": { "type": "prometheus", "uid": "${DS_PROMETHEUS}" },
        "targets": [
          {
            "refId": "A",
            "expr": "rate(node_cpu_seconds_total{mode!=\"idle\"}[$__rate_interval])"
          }
        ]
      },
      {
        "id": 2,
        "title": "Memory usage",
        "type": "timeseries",
        "datasource": { "type": "prometheus", "uid": "${DS_PROMETHEUS}" },
        "targets": [
          {
            "refId": "A",
            "expr": "node_memory_MemTotal_bytes - node_memory_MemAvailable_bytes"
          }
        ]
      }
    ]
  },
  "datasourceMappings": [
    {
      "uid": "prometheus-uid",
      "type": "prometheus",
      "name": "Prometheus"
    }
  ]
}
```

JSON body schema:

- **dashboardJson** – The dashboard JSON model to validate.
- **datasourceMappings** – The data source to validate the dashboard against. Provide exactly one entry.
- **datasourceMappings[].uid** – The UID of the data source.
- **datasourceMappings[].type** – The type of the data source. Must be `prometheus` and match the type of the data source with the given UID.
- **datasourceMappings[].name** – Optional. The name of the data source, returned as-is in the response.

The API validates queries that use the mapped data source UID directly, and queries that reference a Prometheus data source variable such as `${DS_PROMETHEUS}`. If the dashboard has an `__inputs` section, the API uses it to identify Prometheus data source variables. Otherwise, it treats every data source variable as the mapped data source. Queries for other data sources are ignored.

**Example response**:

```http
HTTP/1.1 200
Content-Type: application/json

{
  "compatibilityScore": 0.6666666666666666,
  "datasourceResults": [
    {
      "uid": "prometheus-uid",
      "type": "prometheus",
      "name": "Prometheus",
      "totalQueries": 2,
      "checkedQueries": 2,
      "totalMetrics": 3,
      "foundMetrics": 2,
      "missingMetrics": ["node_memory_MemAvailable_bytes"],
      "queryBreakdown": [
        {
          "panelTitle": "CPU usage",
          "panelID": 1,
          "queryRefId": "A",
          "totalMetrics": 1,
          "foundMetrics": 1,
          "missingMetrics": [],
          "compatibilityScore": 1
        },
        {
          "panelTitle": "Memory usage",
          "panelID": 2,
          "queryRefId": "A",
          "totalMetrics": 2,
          "foundMetrics": 1,
          "missingMetrics": ["node_memory_MemAvailable_bytes"],
          "compatibilityScore": 0.5
        }
      ]
    }
  ]
}
```

The response contains the following fields:

- **compatibilityScore** – The overall compatibility score, from `0` (no metrics found) to `1` (all metrics found).
- **datasourceResults[].totalQueries** – The number of dashboard queries that use the data source.
- **datasourceResults[].checkedQueries** – The number of queries the API could parse.
- **datasourceResults[].totalMetrics** – The number of unique metrics used across all queries.
- **datasourceResults[].foundMetrics** – The number of those metrics that exist in the data source.
- **datasourceResults[].missingMetrics** – The names of the metrics that don't exist in the data source.
- **datasourceResults[].compatibilityScore** – `foundMetrics` divided by `totalMetrics`.
- **datasourceResults[].queryBreakdown** – The results for each query, identified by `panelTitle`, `panelID`, and `queryRefId`. If a query can't be parsed, its entry includes a `parseError` message and a `compatibilityScore` of `0`.

A query that doesn't reference any metric, such as `time()`, has a score of `1`. A dashboard with no queries for the data source also has a score of `1`.

Grafana caches the list of metrics for each data source for five minutes, so recently added metrics might not appear immediately.

Status codes:

- **200** – OK
- **400** – Errors (invalid JSON, not exactly one data source mapping, invalid data source UID, data source type mismatch, or unsupported data source type)
- **401** – Unauthorized, or authentication to the data source failed
- **403** – Access denied to the API or to the data source
- **404** – Data source not found
- **500** – Internal error, for example, an unsupported dashboard format
- **502** – The data source returned an error or an invalid response
- **503** – The data source is unreachable
- **504** – The request to the data source timed out

Error responses include an `error` message and a `code` that identifies the problem:

```http
HTTP/1.1 400
Content-Type: application/json

{
  "error": "datasource type 'loki' is not supported (currently only 'prometheus' is supported)",
  "code": "datasource_unsupported_type"
}
```
