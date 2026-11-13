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

Before you begin, ensure you have the following:

- **Grafana Cloud stack:** Alert enrichment is only available in Grafana Cloud.
- **API authentication:** Authenticate your requests with a Grafana Cloud service account token. Refer to [HTTP API authentication](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/developer-resources/api-reference/http-api/authentication/).

## Requirements

Required permissions depend on whether the `AlertEnrichment` resource applies globally (across all alerts or label/annotation matchers) or is scoped to specific alert rules (`spec.alertRuleUids`):

| Scope                     | Read                                                           | Create, update, patch, and delete                                                            |
| ------------------------- | -------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| Global alert enrichment   | Organization **Admin** role                                    | Organization **Admin** role                                                                  |
| Per-rule alert enrichment | `alert.enrichments:read` (`fixed:alerting.enrichments:reader`) | `alert.enrichments:read` and `alert.enrichments:write` (`fixed:alerting.enrichments:writer`) |

For more information, refer to [Manage access using roles](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/alerting/set-up/configure-rbac/access-roles/).

## Endpoints

The following table lists the main endpoints. The Swagger specification also includes `DELETE` on the collection endpoint and watch query parameters.

| Method | Summary                                              | URI                                                                                         |
| ------ | ---------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| GET    | [List alert enrichment resources](#alert-enrichment) | `/apis/alertenrichment.grafana.app/v1beta1/namespaces/{namespace}/alert-enrichments`        |
| GET    | [Get an alert enrichment](#alert-enrichment)         | `/apis/alertenrichment.grafana.app/v1beta1/namespaces/{namespace}/alert-enrichments/{name}` |
| POST   | [Create an alert enrichment](#alert-enrichment)      | `/apis/alertenrichment.grafana.app/v1beta1/namespaces/{namespace}/alert-enrichments`        |
| PUT    | [Update an alert enrichment](#alert-enrichment)      | `/apis/alertenrichment.grafana.app/v1beta1/namespaces/{namespace}/alert-enrichments/{name}` |
| PATCH  | [Patch an alert enrichment](#alert-enrichment)       | `/apis/alertenrichment.grafana.app/v1beta1/namespaces/{namespace}/alert-enrichments/{name}` |
| DELETE | [Delete an alert enrichment](#alert-enrichment)      | `/apis/alertenrichment.grafana.app/v1beta1/namespaces/{namespace}/alert-enrichments/{name}` |

## Alert enrichment

An `AlertEnrichment` resource (`alert-enrichments`) defines an enrichment pipeline and the matching criteria that control which firing alerts run it.

### Schema

An `AlertEnrichment` resource contains the following fields in `metadata` and `spec`:

- **`metadata.name`:** Unique identifier of the enrichment within the stack namespace. Provide `metadata.name` on create or set `metadata.generateName` so Grafana generates one.
- **`spec.title`:** Required. Display title of the enrichment.
- **`spec.description`:** Optional. Human-readable description of what the enrichment adds.
- **`spec.alertRuleUids`:** Optional list of alert rule UIDs this enrichment applies to. When empty, the enrichment applies globally across rules that satisfy the configured matchers.
- **`spec.labelMatchers`:** Optional list of label matchers (`type`, `name`, `value`, where `type` is `=`, `!=`, `=~`, or `!~`) that an alert must match for the enrichment to run.
- **`spec.annotationMatchers`:** Optional list of annotation matchers (`type`, `name`, `value`) that an alert must match.
- **`spec.receivers`:** Optional list of receiver (contact point) names to restrict the enrichment to. When empty, the enrichment runs for all receivers.
- **`spec.steps`:** Required ordered list of pipeline steps. Each step sets:
  - **`type`:** `enricher` (runs a single enrichment step) or `conditional` (evaluates `conditional.if` and branches to `then` or `else` steps).
  - **`timeout`:** Maximum execution duration for the step, such as `"5s"`.
  - **`enricher`:** Step configuration when `type` is `enricher`. Set `enricher.type` to one of the following values along with its matching configuration field:
    - **`assign`** (`assign.annotations`): Sets one or more annotations (`name` and Go template `value`) on the alert.
    - **`dsquery`** (`dataSource`): Queries a Grafana data source (`type: "logs"` with `logs.dataSourceType`, `logs.dataSourceUid`, `logs.expr`, and optional `logs.maxLines`, or `type: "raw"` with `raw.request` and optional `raw.refId`).
    - **`external`** (`external.url`): Sends the alert payload to an external HTTP endpoint URL.
    - **`explain`** (`explain.annotation`): Generates an AI/LLM explanation and stores it in the specified annotation key.
    - **`asserts`** (`asserts: {}`): Adds a link to Root Cause Analysis (RCA) Workbench.
    - **`sift`** (`sift: {}`): Starts a Sift investigation and adds a link to it. Sift is deprecated and reaches end of life soon; use `assistant` instead for new configurations.
    - **`assistant`** (`assistant: {}`): Starts a Grafana Assistant investigation and adds a link to it.
    - **`loop`** (`loop: {}`) or **`querySample`** (`querySample: {}`): Runs a Loop or rule query sample step.

### Operations

Use the following operations on `/apis/alertenrichment.grafana.app/v1beta1/namespaces/{namespace}/alert-enrichments` and `.../alert-enrichments/{name}`:

- **List (`GET /alert-enrichments`):** Returns an `AlertEnrichmentList` in the stack namespace. Supports `limit`, `continue`, `labelSelector`, and `fieldSelector`.
- **Get (`GET /alert-enrichments/{name}`):** Returns a single `AlertEnrichment` resource by `metadata.name`.
- **Create (`POST /alert-enrichments`):** Creates an `AlertEnrichment` resource and returns `201 Created`.
- **Update (`PUT /alert-enrichments/{name}`):** Replaces an existing `AlertEnrichment` resource. Include `metadata.resourceVersion` from the latest version you read to prevent concurrent overwrites.
- **Patch (`PATCH /alert-enrichments/{name}`):** Applies a partial update using `application/merge-patch+json`, `application/json-patch+json`, or `application/strategic-merge-patch+json`.
- **Delete (`DELETE /alert-enrichments/{name}`):** Deletes an `AlertEnrichment` resource by `metadata.name`.

### Details

#### Global vs. per-rule scoping

When `spec.alertRuleUids` is omitted or empty, the enrichment is global and requires the Organization **Admin** role to read or modify. When `spec.alertRuleUids` lists one or more alert rule UIDs, users with `alert.enrichments:read` and `alert.enrichments:write` can manage it for those rules.

#### Example: Create an alert enrichment

The following request creates an enrichment that sets a formatted triage annotation on critical alerts:

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

Replace `stacks-123456` with your stack namespace and `<SERVICE_ACCOUNT_TOKEN>` with your service account token.

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

#### Example: Patch an alert enrichment

The following request updates only `spec.description` using a JSON merge patch:

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

## Status codes

Endpoints in this API return the following status codes:

- **200:** `OK` (get, list, update, patch, or delete)
- **201:** Created
- **400:** Bad request (invalid JSON or invalid matcher or duration syntax)
- **401:** Unauthorized
- **403:** Access denied
- **404:** Alert enrichment not found
- **409:** Conflict (`metadata.name` already exists on create, or `metadata.resourceVersion` doesn't match on update)
- **422:** Schema validation error

## Related resources

Use the following resources to keep working with alert enrichment and Grafana Alerting APIs:

- **Alert enrichment guide:** Refer to [Alert enrichment](https://grafana.com/docs/grafana-cloud/alerting-and-irm/alerting/configure-notifications/alert-enrichment/).
- **Alert rules HTTP API:** Refer to [Alert rules HTTP API](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/developer-resources/api-reference/http-api/alert-rules/).
- **Alert notifications HTTP API:** Refer to [Alert notifications HTTP API](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/developer-resources/api-reference/http-api/alert-notifications/).
- **API structure:** Refer to [API structure in Grafana](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/developer-resources/api-reference/http-api/apis/).
