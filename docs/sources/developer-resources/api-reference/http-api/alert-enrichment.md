---
canonical: https://grafana.com/docs/grafana/latest/developer-resources/api-reference/http-api/alert-enrichment/
description: Grafana Alert enrichment HTTP API
keywords:
  - grafana
  - http
  - documentation
  - api
  - alert enrichment
labels:
  products:
    - cloud
title: Alert enrichment HTTP API
weight: 100
---

# Alert enrichment HTTP API

{{< admonition type="note" >}}
Available in Grafana Cloud.

This API complies with the new Grafana API structure. To learn more refer to documentation about the [API structure in Grafana](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/developer-resources/api-reference/http-api/apis/).

**This document may not contain the latest version of the API. For the most up-to-date list of available endpoints, refer to [alertenrichment.grafana.app/v1beta1](https://play.grafana.org/swagger?api=alertenrichment.grafana.app-v1beta1) in Swagger.**

This API is in `beta`, so it might change in future releases.

{{< /admonition >}}

Use this API to manage [alert enrichment](https://grafana.com/docs/grafana-cloud/alerting-and-irm/alerting/configure-notifications/alert-enrichment/) in Grafana Cloud. An `AlertEnrichment` resource runs one or more enrichment steps when an alert fires and attaches additional context—such as data source query results, annotations, AI-generated explanations, or investigation links—before the alert notification is delivered.

All paths use the `alertenrichment.grafana.app` group and the `v1beta1` version. Replace `{namespace}` with your stack namespace (`stacks-<STACK_ID>`). To learn more about namespaces in Grafana Cloud, refer to the [API overview](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/developer-resources/api-reference/http-api/apis/#grafana-cloud).

## Before you begin

Alert enrichment is only available in Grafana Cloud. Authenticate your requests with a Grafana Cloud service account token. Refer to [HTTP API authentication](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/developer-resources/api-reference/http-api/authentication/).

## Requirements

Required permissions depend on whether the `AlertEnrichment` resource applies globally (across all alerts or label/annotation matchers) or is scoped to specific alert rules (`spec.alertRuleUids`):

| Scope                     | Read                                                           | Create, update, patch, and delete                                                            |
| ------------------------- | -------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| Global alert enrichment   | Organization **Admin** role                                    | Organization **Admin** role                                                                  |
| Per-rule alert enrichment | `alert.enrichments:read` (`fixed:alerting.enrichments:reader`) | `alert.enrichments:read` and `alert.enrichments:write` (`fixed:alerting.enrichments:writer`) |

For more information, refer to [Manage access using roles](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/alerting/set-up/configure-rbac/access-roles/).

## Endpoints

The following table lists the available endpoints. The Swagger documentation also includes `DELETE` on the collection endpoint and watch query parameters.

| Method | Summary                                                             | URI                                                                                         |
| ------ | ------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| GET    | [List alert enrichment resources](#list-alert-enrichment-resources) | `/apis/alertenrichment.grafana.app/v1beta1/namespaces/{namespace}/alert-enrichments`        |
| GET    | [Get an alert enrichment](#get-an-alert-enrichment)                 | `/apis/alertenrichment.grafana.app/v1beta1/namespaces/{namespace}/alert-enrichments/{name}` |
| POST   | [Create an alert enrichment](#create-an-alert-enrichment)           | `/apis/alertenrichment.grafana.app/v1beta1/namespaces/{namespace}/alert-enrichments`        |
| PUT    | [Update an alert enrichment](#update-an-alert-enrichment)           | `/apis/alertenrichment.grafana.app/v1beta1/namespaces/{namespace}/alert-enrichments/{name}` |
| PATCH  | [Patch an alert enrichment](#patch-an-alert-enrichment)             | `/apis/alertenrichment.grafana.app/v1beta1/namespaces/{namespace}/alert-enrichments/{name}` |
| DELETE | [Delete an alert enrichment](#delete-an-alert-enrichment)           | `/apis/alertenrichment.grafana.app/v1beta1/namespaces/{namespace}/alert-enrichments/{name}` |

## Alert enrichment structure

An `AlertEnrichment` resource has the following fields in `spec`:

- **`title`:** Required. Display title of the enrichment.
- **`description`:** Optional. Human-readable description of what the enrichment adds.
- **`alertRuleUids`:** Optional list of alert rule UIDs this enrichment applies to. When empty, the enrichment applies globally across rules that satisfy the configured matchers.
- **`labelMatchers`:** Optional list of label matchers (`type`, `name`, `value`, where `type` is `=`, `!=`, `=~`, or `!~`) that an alert must match for the enrichment to run.
- **`annotationMatchers`:** Optional list of annotation matchers (`type`, `name`, `value`) that an alert must match.
- **`receivers`:** Optional list of receiver (contact point) names to restrict the enrichment to. When empty, the enrichment runs for all receivers.
- **`steps`:** Required ordered list of pipeline steps. Each step sets:
  - **`type`:** `enricher` (runs a single enrichment step) or `conditional` (evaluates `conditional.if` and branches to `then` or `else` steps).
  - **`timeout`:** Maximum execution duration for the step, such as `"5s"`.
  - **`enricher`:** Step configuration when `type` is `enricher`. Set `enricher.type` to one of the following values along with its matching configuration field:
    - **`assign`** (`assign.annotations`): Sets one or more annotations (`name` and Go template `value`) on the alert.
    - **`dsquery`** (`dataSource`): Queries a Grafana data source (`type: "logs"` with `logs.dataSourceType`, `logs.dataSourceUid`, `logs.expr`, and optional `logs.maxLines`, or `type: "raw"` with `raw.request` and optional `raw.refId`).
    - **`external`** (`external.url`): Sends the alert payload to an external HTTP endpoint URL.
    - **`explain`** (`explain.annotation`): Generates an AI/LLM explanation and stores it in the specified annotation key.
    - **`asserts`** (`asserts: {}`): Adds a link to Root Cause Analysis (RCA) Workbench.
    - **`sift`** (`sift: {}`): Starts a Sift investigation and adds a link to it.
    - **`assistant`** (`assistant: {}`): Starts a Grafana Assistant investigation and adds a link to it.
    - **`loop`** (`loop: {}`) or **`querySample`** (`querySample: {}`): Runs a Loop or rule query sample step.

## List alert enrichment resources

`GET /apis/alertenrichment.grafana.app/v1beta1/namespaces/{namespace}/alert-enrichments`

Lists the `AlertEnrichment` resources in the stack namespace.

**Path parameters**:

- `{namespace}`: Your Grafana Cloud stack namespace, in the format `stacks-<STACK_ID>`.

**Query parameters**:

- **`limit`** (optional): Maximum number of `AlertEnrichment` resources to return per page.
- **`continue`** (optional): Token from `metadata.continue` in a previous response to fetch the next page.
- **`labelSelector`** (optional): Filter `AlertEnrichment` resources by `metadata.labels`.
- **`fieldSelector`** (optional): Filter `AlertEnrichment` resources by selectable fields.

### Example request

The following example lists `AlertEnrichment` resources in a stack:

```http
GET /apis/alertenrichment.grafana.app/v1beta1/namespaces/stacks-123456/alert-enrichments HTTP/1.1
Accept: application/json
Authorization: Bearer <SERVICE_ACCOUNT_TOKEN>
```

Replace `stacks-123456` with your stack namespace and `<SERVICE_ACCOUNT_TOKEN>` with your service account token.

### Example response

The following example shows the response:

```http
HTTP/1.1 200 OK
Content-Type: application/json

{
  "kind": "AlertEnrichmentList",
  "apiVersion": "alertenrichment.grafana.app/v1beta1",
  "metadata": {
    "resourceVersion": "1762938000000000"
  },
  "items": [
    {
      "kind": "AlertEnrichment",
      "apiVersion": "alertenrichment.grafana.app/v1beta1",
      "metadata": {
        "name": "attach-recent-logs",
        "namespace": "stacks-123456",
        "uid": "e3b0c442-98fc-1c14-9afb-f4c8996fb924",
        "resourceVersion": "1762938000000000",
        "creationTimestamp": "2026-11-12T09:00:00Z"
      },
      "spec": {
        "title": "Attach recent error logs",
        "description": "Adds recent Loki error logs to critical alerts",
        "labelMatchers": [
          {
            "type": "=",
            "name": "severity",
            "value": "critical"
          }
        ],
        "steps": [
          {
            "type": "enricher",
            "timeout": "5s",
            "enricher": {
              "type": "dsquery",
              "dataSource": {
                "type": "logs",
                "logs": {
                  "dataSourceType": "loki",
                  "dataSourceUid": "<LOKI_DATASOURCE_UID>",
                  "expr": "{service_name=\"checkout\"} |= \"error\"",
                  "maxLines": 5
                }
              }
            }
          }
        ]
      }
    }
  ]
}
```

### Status codes

- **200:** `OK`
- **401:** Unauthorized
- **403:** Access denied

## Get an alert enrichment

`GET /apis/alertenrichment.grafana.app/v1beta1/namespaces/{namespace}/alert-enrichments/{name}`

Retrieves an alert enrichment by `metadata.name`.

**Path parameters**:

- `{namespace}`: Your Grafana Cloud stack namespace (`stacks-<STACK_ID>`).
- `{name}`: The `metadata.name` of the alert enrichment.

### Example request

The following example retrieves an alert enrichment:

```http
GET /apis/alertenrichment.grafana.app/v1beta1/namespaces/stacks-123456/alert-enrichments/attach-recent-logs HTTP/1.1
Accept: application/json
Authorization: Bearer <SERVICE_ACCOUNT_TOKEN>
```

### Example response

The response returns the `AlertEnrichment` object shown in [List alert enrichment resources](#list-alert-enrichment-resources).

### Status codes

- **200:** `OK`
- **401:** Unauthorized
- **403:** Access denied
- **404:** Alert enrichment not found

## Create an alert enrichment

`POST /apis/alertenrichment.grafana.app/v1beta1/namespaces/{namespace}/alert-enrichments`

Creates an alert enrichment. Provide `metadata.name` or set `metadata.generateName` so Grafana generates a unique name.

**Path parameters**:

- `{namespace}`: Your Grafana Cloud stack namespace (`stacks-<STACK_ID>`).

### Example request

The following example creates an enrichment that sets a runbook annotation on critical alerts:

```http
POST /apis/alertenrichment.grafana.app/v1beta1/namespaces/stacks-123456/alert-enrichments HTTP/1.1
Accept: application/json
Content-Type: application/json
Authorization: Bearer <SERVICE_ACCOUNT_TOKEN>

{
  "apiVersion": "alertenrichment.grafana.app/v1beta1",
  "kind": "AlertEnrichment",
  "metadata": {
    "name": "add-runbook-note"
  },
  "spec": {
    "title": "Add runbook note",
    "description": "Adds a formatted triage note from alert labels",
    "labelMatchers": [
      {
        "type": "=",
        "name": "severity",
        "value": "critical"
      }
    ],
    "steps": [
      {
        "type": "enricher",
        "timeout": "5s",
        "enricher": {
          "type": "assign",
          "assign": {
            "annotations": [
              {
                "name": "triage_note",
                "value": "Check service {{ $labels.service }} in {{ $labels.cluster }}"
              }
            ]
          }
        }
      }
    ]
  }
}
```

### Example response

The following example shows the response:

```http
HTTP/1.1 201 Created
Content-Type: application/json

{
  "kind": "AlertEnrichment",
  "apiVersion": "alertenrichment.grafana.app/v1beta1",
  "metadata": {
    "name": "add-runbook-note",
    "namespace": "stacks-123456",
    "uid": "9a1b2c3d-4e5f-6789-abcd-0123456789ab",
    "resourceVersion": "1762938060000000",
    "generation": 1,
    "creationTimestamp": "2026-11-12T09:01:00Z"
  },
  "spec": {
    "title": "Add runbook note",
    "description": "Adds a formatted triage note from alert labels",
    "labelMatchers": [
      {
        "type": "=",
        "name": "severity",
        "value": "critical"
      }
    ],
    "steps": [
      {
        "type": "enricher",
        "timeout": "5s",
        "enricher": {
          "type": "assign",
          "assign": {
            "annotations": [
              {
                "name": "triage_note",
                "value": "Check service {{ $labels.service }} in {{ $labels.cluster }}"
              }
            ]
          }
        }
      }
    ]
  }
}
```

### Status codes

- **201:** Created
- **400:** Bad request (invalid JSON or invalid matcher/duration syntax)
- **401:** Unauthorized
- **403:** Access denied
- **409:** Conflict (an alert enrichment with the same `metadata.name` already exists)
- **422:** Schema validation error

## Update an alert enrichment

`PUT /apis/alertenrichment.grafana.app/v1beta1/namespaces/{namespace}/alert-enrichments/{name}`

Replaces an existing alert enrichment. Include `metadata.resourceVersion` from the latest version you read to prevent concurrent overwrites.

**Path parameters**:

- `{namespace}`: Your Grafana Cloud stack namespace (`stacks-<STACK_ID>`).
- `{name}`: The `metadata.name` of the alert enrichment.

### Example request

The following example updates the enrichment created earlier:

```http
PUT /apis/alertenrichment.grafana.app/v1beta1/namespaces/stacks-123456/alert-enrichments/add-runbook-note HTTP/1.1
Accept: application/json
Content-Type: application/json
Authorization: Bearer <SERVICE_ACCOUNT_TOKEN>

{
  "apiVersion": "alertenrichment.grafana.app/v1beta1",
  "kind": "AlertEnrichment",
  "metadata": {
    "name": "add-runbook-note",
    "resourceVersion": "1762938060000000"
  },
  "spec": {
    "title": "Add runbook note",
    "description": "Adds a formatted triage note for critical and error alerts",
    "labelMatchers": [
      {
        "type": "=~",
        "name": "severity",
        "value": "critical|error"
      }
    ],
    "steps": [
      {
        "type": "enricher",
        "timeout": "5s",
        "enricher": {
          "type": "assign",
          "assign": {
            "annotations": [
              {
                "name": "triage_note",
                "value": "Check service {{ $labels.service }} in {{ $labels.cluster }}"
              }
            ]
          }
        }
      }
    ]
  }
}
```

### Example response

The response returns `200 OK` with the updated `AlertEnrichment` resource and an incremented `metadata.resourceVersion`.

### Status codes

- **200:** Updated
- **400:** Bad request (invalid JSON)
- **401:** Unauthorized
- **403:** Access denied
- **404:** Alert enrichment not found
- **409:** Conflict (`metadata.resourceVersion` doesn't match the stored version)
- **422:** Schema validation error

## Patch an alert enrichment

`PATCH /apis/alertenrichment.grafana.app/v1beta1/namespaces/{namespace}/alert-enrichments/{name}`

Applies a partial update to an alert enrichment using `application/merge-patch+json`, `application/json-patch+json`, or `application/strategic-merge-patch+json`.

### Example request

The following example updates only the enrichment's `description`:

```http
PATCH /apis/alertenrichment.grafana.app/v1beta1/namespaces/stacks-123456/alert-enrichments/add-runbook-note HTTP/1.1
Accept: application/json
Content-Type: application/merge-patch+json
Authorization: Bearer <SERVICE_ACCOUNT_TOKEN>

{
  "spec": {
    "description": "Updated description for runbook triage notes"
  }
}
```

### Example response

The response returns `200 OK` with the updated `AlertEnrichment` resource. Status codes match [Update an alert enrichment](#update-an-alert-enrichment).

## Delete an alert enrichment

`DELETE /apis/alertenrichment.grafana.app/v1beta1/namespaces/{namespace}/alert-enrichments/{name}`

Deletes an alert enrichment by `metadata.name`.

### Example request

The following example deletes an alert enrichment:

```http
DELETE /apis/alertenrichment.grafana.app/v1beta1/namespaces/stacks-123456/alert-enrichments/add-runbook-note HTTP/1.1
Accept: application/json
Authorization: Bearer <SERVICE_ACCOUNT_TOKEN>
```

### Example response

The following example shows the response:

```http
HTTP/1.1 200 OK
Content-Type: application/json

{
  "kind": "Status",
  "apiVersion": "v1",
  "metadata": {},
  "status": "Success",
  "code": 200
}
```

### Status codes

- **200:** Deleted
- **401:** Unauthorized
- **403:** Access denied
- **404:** Alert enrichment not found

## Related resources

Use the following resources to keep working with alert enrichment and Grafana Alerting APIs:

- **Alert enrichment guide:** Refer to [Alert enrichment](https://grafana.com/docs/grafana-cloud/alerting-and-irm/alerting/configure-notifications/alert-enrichment/).
- **Alert rules HTTP API:** Refer to [Alert rules HTTP API](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/developer-resources/api-reference/http-api/alert-rules/).
- **Alert notifications HTTP API:** Refer to [Alert notifications HTTP API](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/developer-resources/api-reference/http-api/alert-notifications/).
- **API structure:** Refer to [API structure in Grafana](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/developer-resources/api-reference/http-api/apis/).
