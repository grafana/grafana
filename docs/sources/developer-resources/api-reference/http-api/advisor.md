---
canonical: https://grafana.com/docs/grafana/latest/developer-resources/api-reference/http-api/advisor/
description: Grafana Advisor HTTP API
keywords:
  - grafana
  - http
  - documentation
  - api
  - advisor
  - checks
labels:
  products:
    - enterprise
    - oss
    - cloud
title: Advisor HTTP API
weight: 100
---

# Advisor HTTP API

{{< admonition type="note" >}}
Available in Grafana 12.0 and later.

This API complies with the new Grafana API structure. To learn more refer to documentation about the [API structure in Grafana](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/developer-resources/api-reference/http-api/apis/).

**This document may not contain the latest version of the API. For the most up-to-date list of available endpoints, refer to [advisor.grafana.app/v0alpha1](https://play.grafana.org/swagger?api=advisor.grafana.app-v0alpha1) in Swagger.**

This API is in `alpha`, so it might change in future releases.

{{< /admonition >}}

The `/apis/advisor.grafana.app/*` API exposes the results of [Grafana Advisor](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/administration/grafana-advisor/), the app that runs regular health checks on your data sources, plugins, and Grafana instance.

Advisor stores each run as a `Check` resource. The check's `status.report` field contains the number of analyzed items and the list of failures. You can [read these checks](#list-checks) to [create an alert based on Grafana Advisor results](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/administration/grafana-advisor/advisor-create-alert/). The rest of the endpoints are for internal use.

## Before you begin

Before you begin, ensure you have the following:

- **Grafana Advisor enabled:** Advisor has generated at least one report. Refer to [Grafana Advisor](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/administration/grafana-advisor/) to generate your first report.
- **A service account token with the Admin role:** Use it to authenticate your requests. Refer to [HTTP API authentication](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/developer-resources/api-reference/http-api/authentication).

## Endpoints

{{< admonition type="note" >}}
Reading checks to build alerts is the only supported public use case. The other endpoints are used internally by Grafana Advisor.
{{< /admonition >}}

These are the available endpoints:

| Method | Summary                            | URI                                                                                  |
| ------ | ---------------------------------- | ------------------------------------------------------------------------------------ |
| GET    | Describe the available resources   | `/apis/advisor.grafana.app/v0alpha1/`                                                |
| GET    | [List checks](#list-checks)        | `/apis/advisor.grafana.app/v0alpha1/namespaces/{namespace}/checks`                   |
| POST   | Create a check                     | `/apis/advisor.grafana.app/v0alpha1/namespaces/{namespace}/checks`                   |
| DELETE | Delete a collection of checks      | `/apis/advisor.grafana.app/v0alpha1/namespaces/{namespace}/checks`                   |
| GET    | Get a check                        | `/apis/advisor.grafana.app/v0alpha1/namespaces/{namespace}/checks/{name}`            |
| PUT    | Replace a check                    | `/apis/advisor.grafana.app/v0alpha1/namespaces/{namespace}/checks/{name}`            |
| PATCH  | Update a check                     | `/apis/advisor.grafana.app/v0alpha1/namespaces/{namespace}/checks/{name}`            |
| DELETE | Delete a check                     | `/apis/advisor.grafana.app/v0alpha1/namespaces/{namespace}/checks/{name}`            |
| GET    | Get the status of a check          | `/apis/advisor.grafana.app/v0alpha1/namespaces/{namespace}/checks/{name}/status`     |
| PUT    | Replace the status of a check      | `/apis/advisor.grafana.app/v0alpha1/namespaces/{namespace}/checks/{name}/status`     |
| PATCH  | Update the status of a check       | `/apis/advisor.grafana.app/v0alpha1/namespaces/{namespace}/checks/{name}/status`     |
| GET    | List check types                   | `/apis/advisor.grafana.app/v0alpha1/namespaces/{namespace}/checktypes`               |
| POST   | Create a check type                | `/apis/advisor.grafana.app/v0alpha1/namespaces/{namespace}/checktypes`               |
| DELETE | Delete a collection of check types | `/apis/advisor.grafana.app/v0alpha1/namespaces/{namespace}/checktypes`               |
| GET    | Get a check type                   | `/apis/advisor.grafana.app/v0alpha1/namespaces/{namespace}/checktypes/{name}`        |
| PUT    | Replace a check type               | `/apis/advisor.grafana.app/v0alpha1/namespaces/{namespace}/checktypes/{name}`        |
| PATCH  | Update a check type                | `/apis/advisor.grafana.app/v0alpha1/namespaces/{namespace}/checktypes/{name}`        |
| DELETE | Delete a check type                | `/apis/advisor.grafana.app/v0alpha1/namespaces/{namespace}/checktypes/{name}`        |
| GET    | Get the status of a check type     | `/apis/advisor.grafana.app/v0alpha1/namespaces/{namespace}/checktypes/{name}/status` |
| PUT    | Replace the status of a check type | `/apis/advisor.grafana.app/v0alpha1/namespaces/{namespace}/checktypes/{name}/status` |
| PATCH  | Update the status of a check type  | `/apis/advisor.grafana.app/v0alpha1/namespaces/{namespace}/checktypes/{name}/status` |
| POST   | Register check types               | `/apis/advisor.grafana.app/v0alpha1/namespaces/{namespace}/register`                 |
| GET    | Get translations                   | `/apis/advisor.grafana.app/v0alpha1/namespaces/{namespace}/translations`             |

## List checks

`GET /apis/advisor.grafana.app/v0alpha1/namespaces/{namespace}/checks`

Lists the checks that Advisor has run in the specified namespace, including their results. Advisor creates a new check every time it runs, so the response contains several checks for each check type. To get the current state, use the most recent check of each type.

**Path parameters**:

- `{namespace}`: To learn more about which namespace to use, refer to the [API overview](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/developer-resources/api-reference/http-api/apis/).

**Query parameters**:

- **`labelSelector`** (optional): Filters checks by label. For example, `advisor.grafana.app/type=datasource` returns only data source checks.
- **`limit`** (optional): Sets the maximum number of checks to return per page.
- **`continue`** (optional): Sets the token from the `metadata.continue` field of a previous response to fetch the next page.

### Example request

The following example shows a request to list checks:

```http
GET /apis/advisor.grafana.app/v0alpha1/namespaces/default/checks HTTP/1.1
Accept: application/json
Authorization: Bearer <SERVICE_ACCOUNT_TOKEN>
```

Replace _`<SERVICE_ACCOUNT_TOKEN>`_ with your service account token.

### Example response

The following example shows the response:

```http
HTTP/1.1 200 OK
Content-Type: application/json

{
  "kind": "CheckList",
  "apiVersion": "advisor.grafana.app/v0alpha1",
  "metadata": {
    "resourceVersion": "1762675200000000"
  },
  "items": [
    {
      "kind": "Check",
      "apiVersion": "advisor.grafana.app/v0alpha1",
      "metadata": {
        "name": "check-7xk2p",
        "namespace": "default",
        "creationTimestamp": "2026-11-09T06:00:00Z",
        "labels": {
          "advisor.grafana.app/type": "datasource"
        },
        "annotations": {
          "advisor.grafana.app/status": "processed"
        }
      },
      "spec": {},
      "status": {
        "report": {
          "count": 4,
          "failures": [
            {
              "severity": "high",
              "stepID": "health-check",
              "item": "Production Prometheus",
              "itemID": "prometheus-prod",
              "links": [
                {
                  "url": "/connections/datasources/edit/prometheus-prod",
                  "message": "Fix me",
                  "messageKey": "advisor.link.fix-me"
                }
              ]
            }
          ]
        }
      }
    },
    {
      "kind": "Check",
      "apiVersion": "advisor.grafana.app/v0alpha1",
      "metadata": {
        "name": "check-m4q9z",
        "namespace": "default",
        "creationTimestamp": "2026-11-09T06:00:05Z",
        "labels": {
          "advisor.grafana.app/type": "plugin"
        },
        "annotations": {
          "advisor.grafana.app/status": "processed"
        }
      },
      "spec": {},
      "status": {
        "report": {
          "count": 12,
          "failures": []
        }
      }
    }
  ]
}
```

Each item in the `items` array is one check. The following fields are the most relevant to evaluate check results:

- **`metadata.labels["advisor.grafana.app/type"]`:** The check type, for example `datasource`, `plugin`, `config`, `instance`, or `ssosetting`.
- **`metadata.annotations["advisor.grafana.app/status"]`:** The processing status of the check. The value is `processed` when the check finishes successfully, or `error` if the check failed to run. The annotation is missing while the check is still running.
- **`metadata.creationTimestamp`:** When the check ran. Use it to find the most recent check of each type.
- **`status.report.count`:** The number of items the check analyzed.
- **`status.report.failures`:** The list of issues the check found. An empty list means that the check found no issues.

Each entry in `status.report.failures` contains the following fields:

- **`severity`:** The severity of the issue: `high` for issues that need action, or `low` for issues that need investigation.
- **`stepID`:** The ID of the check step that found the issue, for example `health-check`.
- **`item`:** The human-readable name of the affected item, for example a data source name.
- **`itemID`:** The ID of the affected item, for example a data source UID.
- **`links`:** Links to pages where you can fix the issue. Each link contains a `url`, a `message`, and an optional `messageKey` with the translation key of the message.

### Status codes

- **200:** OK
- **401:** Unauthorized
- **403:** Access denied, for example if the namespace doesn't belong to your organization

## Related resources

Use the following resources to keep working with Grafana Advisor and the Grafana APIs:

- **Alerting on Advisor results:** Refer to [Create an alert based on Grafana Advisor results](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/administration/grafana-advisor/advisor-create-alert/).
- **Grafana Advisor:** Refer to [Grafana Advisor](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/administration/grafana-advisor/).
- **API structure:** Refer to [API structure in Grafana](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/developer-resources/api-reference/http-api/apis).
