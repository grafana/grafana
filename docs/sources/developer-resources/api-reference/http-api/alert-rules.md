---
canonical: https://grafana.com/docs/grafana/latest/developer-resources/api-reference/http-api/alert-rules/
description: Grafana Alert rules HTTP API
keywords:
  - grafana
  - http
  - documentation
  - api
  - alerting
  - alert rules
  - recording rules
  - rule sequences
labels:
  products:
    - enterprise
    - oss
    - cloud
title: Alert rules HTTP API
weight: 100
---

# Alert rules HTTP API

{{< admonition type="note" >}}
Available in Grafana 13.3 and later.

This API complies with the new Grafana API structure. To learn more refer to documentation about the [API structure in Grafana](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/developer-resources/api-reference/http-api/apis/).

The legacy [Alerting Provisioning HTTP API](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/developer-resources/api-reference/http-api/api-legacy/alerting_provisioning/) is still available. Together with the [Alert notifications HTTP API](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/developer-resources/api-reference/http-api/alert-notifications/), this API partially replaces it. Refer to [Migrate from the legacy Alerting Provisioning API](#migrate-from-the-legacy-alerting-provisioning-api) to learn how both APIs match.

**This document may not contain the latest version of the API. For the most up-to-date list of available endpoints, refer to [rules.alerting.grafana.app/v1beta1](https://play.grafana.org/swagger?api=rules.alerting.grafana.app-v1beta1) in Swagger.**

This API is in `beta`, so it might change in future releases.

{{< /admonition >}}

Use this API to manage Grafana-managed alert rules, recording rules, and rule sequences as standalone resources. Each rule has its own versioned, schema-validated resource, so you can create, read, update, and delete a single rule without rewriting an entire rule group.

Grafana also serves the earlier `v0alpha1` version for backward compatibility, including an experimental `configs` resource and rule search routes in `v0alpha1`. Use `v1beta1` for new integrations. In `v1beta1`, alert rule `notificationSettings` must include `type` (`SimplifiedRouting` or `NamedRoutingTree`), and `RuleSequence` uses `spec.alertRules` instead of `spec.alertingRules`.

## Before you begin

Before you begin, ensure you have the following:

- **Grafana Alerting enabled:** Grafana Alerting must be enabled on your instance.
- **A target folder:** Alert rules, recording rules, and rule sequences must belong to a folder. Pass the folder UID in `metadata.annotations["grafana.app/folder"]`. Root-level placement isn't supported.
- **API authentication:** Authenticate with a service account token or basic authentication (OSS and Enterprise). Refer to [HTTP API authentication](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/developer-resources/api-reference/http-api/authentication/).

## Requirements

By default, users with the **Viewer** basic role can read alert rules, recording rules, and rule sequences in folders they have access to, and users with the **Editor** or **Admin** basic role can also create, update, and delete them.

If you're running Grafana Enterprise or Grafana Cloud and want to configure granular role-based access control (RBAC) permissions, including folder scopes, data source query permissions, and provenance permissions for `grafana.com/provenance`, refer to [Configure RBAC for Grafana Alerting](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/alerting/set-up/configure-rbac/).

## Alert rules

An `AlertRule` resource (`alertrules`) defines a Grafana-managed alert rule: its queries and expressions, evaluation interval, pending and keep-firing durations, no-data and execution-error handling, labels, annotations, and notification routing.

### Schema

An `AlertRule` resource contains the following fields in `metadata`, `spec`, and `status`:

- **`metadata.name`:** Required on legacy storage; optional if unified storage is enabled and `metadata.generateName` is set. Identifies the rule UID in request paths.
- **`metadata.annotations["grafana.app/folder"]`:** Required. UID of the folder that contains the rule.
- **`metadata.annotations["grafana.com/provenance"]`:** Optional. Set to `api` to mark the rule as provisioned so it can't be edited in the Grafana UI, or omit it to allow UI edits.
- **`spec.title`:** Required. Display title of the alert rule (up to 190 characters).
- **`spec.trigger.interval`:** Required. Evaluation interval as a Prometheus duration string, such as `1m`, that is a multiple of your instance's base evaluation interval.
- **`spec.expressions`:** Required. Map of query and expression nodes keyed by `refId` (for example, `A`, `B`, `C`). Exactly one expression must set `"source": true` to mark the alert condition. Omit `datasourceUID` on server-side expression nodes (`__expr__`).
- **`spec.noDataState`:** Required. State when evaluation returns no data: `NoData`, `Ok`, `Alerting`, or `KeepLast`.
- **`spec.execErrState`:** Required. State when evaluation fails with an error: `Error`, `Ok`, `Alerting`, or `KeepLast`.
- **`spec.for`:** Optional. Pending duration before the rule transitions to firing, such as `5m`.
- **`spec.keepFiringFor`:** Optional. Duration to keep firing after the condition resolves, such as `2m`.
- **`spec.paused`:** Optional. Set to `true` to pause evaluation.
- **`spec.labels` and `spec.annotations`:** Optional maps of key-value template strings attached to firing alert instances.
- **`spec.panelRef`:** Optional link to a dashboard panel, with `dashboardUID` and `panelID`.
- **`spec.notificationSettings`:** Optional routing configuration. When omitted, alerts use the default notification policy tree. When set, `type` is required in `v1beta1`:
  - **`SimplifiedRouting`:** Routes directly to a contact point (`receiver`), with optional `groupBy`, `groupWait`, `groupInterval`, `repeatInterval`, `muteTimeIntervals`, and `activeTimeIntervals`.
  - **`NamedRoutingTree`:** Routes to a named notification policy tree (`routingTree`).
- **`status`:** Read-only runtime status reported by Grafana, including `health` (`Unknown`, `OK`, `Paused`, `Error`, `NoData`), `state` (`Inactive`, `Healthy`, `Firing`, `Pending`, `Recovering`), `stateReason`, `lastEvaluationTime`, `evaluationDuration`, `lastError`, and per-state instance counts in `totals`.

### Endpoints

The following table lists the main endpoints for `AlertRule` resources. For `PATCH`, collection `DELETE`, `POST /alertrules/search`, and `/status` sub-resource endpoints, refer to [Swagger](https://play.grafana.org/swagger?api=rules.alerting.grafana.app-v1beta1).

**Base path:** `/apis/rules.alerting.grafana.app/v1beta1/namespaces/{namespace}/`

Replace `{namespace}` with your namespace. To learn which namespace to use, refer to the [API overview](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/developer-resources/api-reference/http-api/apis/).

| Method | Summary                                       | Path                |
| ------ | --------------------------------------------- | ------------------- |
| GET    | [List alert rules](#list-alert-rules)         | `alertrules`        |
| GET    | [Get an alert rule](#get-an-alert-rule)       | `alertrules/{name}` |
| POST   | [Create an alert rule](#create-an-alert-rule) | `alertrules`        |
| PUT    | [Update an alert rule](#update-an-alert-rule) | `alertrules/{name}` |
| DELETE | [Delete an alert rule](#delete-an-alert-rule) | `alertrules/{name}` |

#### List alert rules

`GET /apis/rules.alerting.grafana.app/v1beta1/namespaces/{namespace}/alertrules`

Lists the `AlertRule` resources in the namespace.

**Path parameters**:

- `{namespace}`: To learn more about which namespace to use, refer to the [API overview](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/developer-resources/api-reference/http-api/apis/).

**Query parameters**:

- **`limit`** (optional): Maximum number of alert rules to return per page.
- **`continue`** (optional): Token from `metadata.continue` in a previous response to fetch the next page.
- **`labelSelector`** (optional): Filter by folder (`grafana.app/folder=<FOLDER_UID>`) or rule group (`grafana.com/group=<GROUP_NAME>`).
- **`fieldSelector`** (optional): Filter by selectable `spec` fields (refer to [Details](#details)).

##### Example request

The following example lists alert rules in a specific folder:

```http
GET /apis/rules.alerting.grafana.app/v1beta1/namespaces/default/alertrules?labelSelector=grafana.app/folder=<FOLDER_UID> HTTP/1.1
Accept: application/json
Authorization: Bearer <SERVICE_ACCOUNT_TOKEN>
```

##### Example response

The response returns `200 OK` with an `AlertRuleList` object containing matching `AlertRule` items in `items`.

#### Get an alert rule

`GET /apis/rules.alerting.grafana.app/v1beta1/namespaces/{namespace}/alertrules/{name}`

Retrieves an `AlertRule` resource by `metadata.name`, including its runtime `status`.

**Path parameters**:

- `{namespace}`: To learn more about which namespace to use, refer to the [API overview](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/developer-resources/api-reference/http-api/apis/).
- `{name}`: The `metadata.name` (rule UID) of the alert rule.

##### Example request

The following example gets an alert rule:

```http
GET /apis/rules.alerting.grafana.app/v1beta1/namespaces/default/alertrules/high-cpu-usage HTTP/1.1
Accept: application/json
Authorization: Bearer <SERVICE_ACCOUNT_TOKEN>
```

##### Example response

The response returns `200 OK` with the `AlertRule` object shown in [Create an alert rule](#create-an-alert-rule).

#### Create an alert rule

`POST /apis/rules.alerting.grafana.app/v1beta1/namespaces/{namespace}/alertrules`

Creates an `AlertRule` resource in the folder specified by `metadata.annotations["grafana.app/folder"]`.

**Path parameters**:

- `{namespace}`: To learn more about which namespace to use, refer to the [API overview](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/developer-resources/api-reference/http-api/apis/).

##### Example request

The following example creates an alert rule that queries a Prometheus data source and routes notifications directly to a contact point:

```http
POST /apis/rules.alerting.grafana.app/v1beta1/namespaces/default/alertrules HTTP/1.1
Accept: application/json
Content-Type: application/json
Authorization: Bearer <SERVICE_ACCOUNT_TOKEN>

{
  "apiVersion": "rules.alerting.grafana.app/v1beta1",
  "kind": "AlertRule",
  "metadata": {
    "name": "high-cpu-usage",
    "annotations": {
      "grafana.app/folder": "<FOLDER_UID>"
    }
  },
  "spec": {
    "title": "High CPU usage",
    "trigger": {
      "interval": "1m"
    },
    "for": "5m",
    "noDataState": "NoData",
    "execErrState": "Error",
    "labels": {
      "severity": "warning"
    },
    "annotations": {
      "summary": "CPU usage is above 80%"
    },
    "notificationSettings": {
      "type": "SimplifiedRouting",
      "receiver": "oncall-slack"
    },
    "expressions": {
      "A": {
        "queryType": "",
        "datasourceUID": "<DATASOURCE_UID>",
        "relativeTimeRange": {
          "from": "5m",
          "to": "0s"
        },
        "model": {
          "expr": "100 - (avg by (instance) (rate(node_cpu_seconds_total{mode=\"idle\"}[5m])) * 100)"
        }
      },
      "B": {
        "model": {
          "type": "reduce",
          "expression": "A",
          "reducer": "last"
        }
      },
      "C": {
        "source": true,
        "model": {
          "type": "threshold",
          "expression": "B",
          "conditions": [
            {
              "evaluator": {
                "type": "gt",
                "params": [80]
              }
            }
          ]
        }
      }
    }
  }
}
```

Replace `<SERVICE_ACCOUNT_TOKEN>`, `<FOLDER_UID>`, and `<DATASOURCE_UID>` with values from your Grafana instance.

##### Example response

The following example shows the response:

```http
HTTP/1.1 201 Created
Content-Type: application/json

{
  "kind": "AlertRule",
  "apiVersion": "rules.alerting.grafana.app/v1beta1",
  "metadata": {
    "name": "high-cpu-usage",
    "namespace": "default",
    "uid": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "resourceVersion": "1",
    "labels": {
      "grafana.app/folder": "<FOLDER_UID>"
    },
    "annotations": {
      "grafana.app/folder": "<FOLDER_UID>",
      "grafana.app/updatedBy": "service-account:cef2t2rfm73lsb",
      "grafana.app/updatedTimestamp": "2026-11-12T09:00:00Z"
    }
  },
  "spec": {
    "title": "High CPU usage",
    "trigger": {
      "interval": "1m"
    },
    "for": "5m",
    "noDataState": "NoData",
    "execErrState": "Error",
    "labels": {
      "severity": "warning"
    },
    "annotations": {
      "summary": "CPU usage is above 80%"
    },
    "notificationSettings": {
      "type": "SimplifiedRouting",
      "receiver": "oncall-slack"
    },
    "expressions": {
      "A": {
        "queryType": "",
        "datasourceUID": "<DATASOURCE_UID>",
        "relativeTimeRange": {
          "from": "5m",
          "to": "0s"
        },
        "model": {
          "expr": "100 - (avg by (instance) (rate(node_cpu_seconds_total{mode=\"idle\"}[5m])) * 100)"
        }
      },
      "B": {
        "model": {
          "type": "reduce",
          "expression": "A",
          "reducer": "last"
        }
      },
      "C": {
        "source": true,
        "model": {
          "type": "threshold",
          "expression": "B",
          "conditions": [
            {
              "evaluator": {
                "type": "gt",
                "params": [80]
              }
            }
          ]
        }
      }
    }
  },
  "status": {}
}
```

#### Update an alert rule

`PUT /apis/rules.alerting.grafana.app/v1beta1/namespaces/{namespace}/alertrules/{name}`

Replaces an existing `AlertRule` resource. Retrieve the current resource first and pass its `metadata.resourceVersion` in the `PUT` body so concurrent updates don't overwrite each other. For partial updates, send a `PATCH` request to the same path instead.

**Path parameters**:

- `{namespace}`: To learn more about which namespace to use, refer to the [API overview](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/developer-resources/api-reference/http-api/apis/).
- `{name}`: The `metadata.name` of the alert rule.

##### Example request

The following example updates the alert rule's title and pending duration:

```http
PUT /apis/rules.alerting.grafana.app/v1beta1/namespaces/default/alertrules/high-cpu-usage HTTP/1.1
Accept: application/json
Content-Type: application/json
Authorization: Bearer <SERVICE_ACCOUNT_TOKEN>

{
  "apiVersion": "rules.alerting.grafana.app/v1beta1",
  "kind": "AlertRule",
  "metadata": {
    "name": "high-cpu-usage",
    "resourceVersion": "1",
    "annotations": {
      "grafana.app/folder": "<FOLDER_UID>"
    }
  },
  "spec": {
    "title": "High CPU usage (sustained)",
    "trigger": {
      "interval": "1m"
    },
    "for": "10m",
    "noDataState": "NoData",
    "execErrState": "Error",
    "notificationSettings": {
      "type": "SimplifiedRouting",
      "receiver": "oncall-slack"
    },
    "expressions": {
      "A": {
        "queryType": "",
        "datasourceUID": "<DATASOURCE_UID>",
        "relativeTimeRange": {
          "from": "5m",
          "to": "0s"
        },
        "model": {
          "expr": "100 - (avg by (instance) (rate(node_cpu_seconds_total{mode=\"idle\"}[5m])) * 100)"
        }
      },
      "B": {
        "model": {
          "type": "reduce",
          "expression": "A",
          "reducer": "last"
        }
      },
      "C": {
        "source": true,
        "model": {
          "type": "threshold",
          "expression": "B",
          "conditions": [
            {
              "evaluator": {
                "type": "gt",
                "params": [80]
              }
            }
          ]
        }
      }
    }
  }
}
```

##### Example response

The response returns `200 OK` with the updated `AlertRule` resource and an incremented `metadata.resourceVersion`.

#### Delete an alert rule

`DELETE /apis/rules.alerting.grafana.app/v1beta1/namespaces/{namespace}/alertrules/{name}`

Deletes the `AlertRule` resource with the given `metadata.name`.

**Path parameters**:

- `{namespace}`: To learn more about which namespace to use, refer to the [API overview](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/developer-resources/api-reference/http-api/apis/).
- `{name}`: The `metadata.name` of the alert rule.

##### Example request

The following example deletes an alert rule:

```http
DELETE /apis/rules.alerting.grafana.app/v1beta1/namespaces/default/alertrules/high-cpu-usage HTTP/1.1
Accept: application/json
Authorization: Bearer <SERVICE_ACCOUNT_TOKEN>
```

##### Example response

The response returns `200 OK` with the deleted `AlertRule` object (or a `Status` object when served from unified storage).

### Details

- **Selectable fields:** On `GET /alertrules`, `fieldSelector` supports `spec.title`, `spec.paused`, `spec.panelRef.dashboardUID`, `spec.panelRef.panelID`, `spec.notificationSettings.type`, `spec.notificationSettings.receiver`, and `spec.notificationSettings.routingTree`.
- **History and trash modes:** Pass `labelSelector=grafana.app/get-history=true` together with `fieldSelector=metadata.name=<RULE_UID>` to list an alert rule's version history, or pass `labelSelector=grafana.app/get-trash=true` to list deleted alert rules in the trash.
- **Sequence membership:** If an alert rule belongs to a `RuleSequence`, remove it from the sequence before deleting it or moving it to another folder.

## Recording rules

A `RecordingRule` resource (`recordingrules`) evaluates a metric expression on a fixed interval and writes the resulting time series to a Prometheus-compatible target data source.

### Schema

A `RecordingRule` resource uses the same folder and provenance annotations as `AlertRule` and contains the following fields in `spec` and `status`:

- **`spec.title`:** Required. Display title of the recording rule.
- **`spec.metric`:** Required. Valid Prometheus metric name to write, matching `^[a-zA-Z_:][a-zA-Z0-9_:]*$`.
- **`spec.targetDatasourceUID`:** Required. UID of the Prometheus-compatible data source where Grafana writes the recorded samples.
- **`spec.trigger.interval`:** Required. Evaluation interval as a Prometheus duration string, such as `1m`.
- **`spec.expressions`:** Required. Map of query and expression nodes keyed by `refId`, with `"source": true` marking the expression to record.
- **`spec.paused`:** Optional. Set to `true` to pause evaluation.
- **`spec.labels`:** Optional map of labels added to the recorded metric series.
- **`status`:** Read-only runtime status reporting `health` (`Unknown`, `Recording`, `Paused`, `Error`, `NoData`), `lastEvaluationTime`, `evaluationDuration`, and `lastError`.

### Endpoints

The following table lists the main endpoints for `RecordingRule` resources. For `PATCH`, collection `DELETE`, `POST /recordingrules/search`, and `/status` sub-resource endpoints, refer to [Swagger](https://play.grafana.org/swagger?api=rules.alerting.grafana.app-v1beta1).

**Base path:** `/apis/rules.alerting.grafana.app/v1beta1/namespaces/{namespace}/`

| Method | Summary                                             | Path                    |
| ------ | --------------------------------------------------- | ----------------------- |
| GET    | [List recording rules](#list-recording-rules)       | `recordingrules`        |
| GET    | [Get a recording rule](#get-a-recording-rule)       | `recordingrules/{name}` |
| POST   | [Create a recording rule](#create-a-recording-rule) | `recordingrules`        |
| PUT    | [Update a recording rule](#update-a-recording-rule) | `recordingrules/{name}` |
| DELETE | [Delete a recording rule](#delete-a-recording-rule) | `recordingrules/{name}` |

#### List recording rules

`GET /apis/rules.alerting.grafana.app/v1beta1/namespaces/{namespace}/recordingrules`

Lists the `RecordingRule` resources in the namespace. Supports `limit`, `continue`, `labelSelector`, and `fieldSelector`.

**Path parameters**:

- `{namespace}`: To learn more about which namespace to use, refer to the [API overview](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/developer-resources/api-reference/http-api/apis/).

##### Example request

The following example lists recording rules in a folder:

```http
GET /apis/rules.alerting.grafana.app/v1beta1/namespaces/default/recordingrules?labelSelector=grafana.app/folder=<FOLDER_UID> HTTP/1.1
Accept: application/json
Authorization: Bearer <SERVICE_ACCOUNT_TOKEN>
```

##### Example response

The response returns `200 OK` with a `RecordingRuleList` object containing matching `RecordingRule` items in `items`.

#### Get a recording rule

`GET /apis/rules.alerting.grafana.app/v1beta1/namespaces/{namespace}/recordingrules/{name}`

Retrieves a `RecordingRule` resource by `metadata.name`, including its runtime `status`.

**Path parameters**:

- `{namespace}`: To learn more about which namespace to use, refer to the [API overview](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/developer-resources/api-reference/http-api/apis/).
- `{name}`: The `metadata.name` (rule UID) of the recording rule.

##### Example request

The following example gets a recording rule:

```http
GET /apis/rules.alerting.grafana.app/v1beta1/namespaces/default/recordingrules/service-request-rate HTTP/1.1
Accept: application/json
Authorization: Bearer <SERVICE_ACCOUNT_TOKEN>
```

##### Example response

The response returns `200 OK` with the `RecordingRule` resource.

#### Create a recording rule

`POST /apis/rules.alerting.grafana.app/v1beta1/namespaces/{namespace}/recordingrules`

Creates a `RecordingRule` resource in the folder specified by `metadata.annotations["grafana.app/folder"]`.

**Path parameters**:

- `{namespace}`: To learn more about which namespace to use, refer to the [API overview](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/developer-resources/api-reference/http-api/apis/).

##### Example request

The following example creates a recording rule that records per-service request rates every minute:

```http
POST /apis/rules.alerting.grafana.app/v1beta1/namespaces/default/recordingrules HTTP/1.1
Accept: application/json
Content-Type: application/json
Authorization: Bearer <SERVICE_ACCOUNT_TOKEN>

{
  "apiVersion": "rules.alerting.grafana.app/v1beta1",
  "kind": "RecordingRule",
  "metadata": {
    "name": "service-request-rate",
    "annotations": {
      "grafana.app/folder": "<FOLDER_UID>"
    }
  },
  "spec": {
    "title": "Service request rate",
    "metric": "job:http_requests_total:rate5m",
    "targetDatasourceUID": "<TARGET_DATASOURCE_UID>",
    "trigger": {
      "interval": "1m"
    },
    "labels": {
      "env": "production"
    },
    "expressions": {
      "A": {
        "source": true,
        "datasourceUID": "<SOURCE_DATASOURCE_UID>",
        "relativeTimeRange": {
          "from": "5m",
          "to": "0s"
        },
        "model": {
          "expr": "sum by (job) (rate(http_requests_total[5m]))"
        }
      }
    }
  }
}
```

Replace `<SERVICE_ACCOUNT_TOKEN>`, `<FOLDER_UID>`, `<SOURCE_DATASOURCE_UID>`, and `<TARGET_DATASOURCE_UID>` with values from your Grafana instance.

##### Example response

On success, Grafana returns `201 Created` with the created `RecordingRule` object.

#### Update a recording rule

`PUT /apis/rules.alerting.grafana.app/v1beta1/namespaces/{namespace}/recordingrules/{name}`

Replaces an existing `RecordingRule` resource. Include `metadata.resourceVersion` from the latest version you read.

**Path parameters**:

- `{namespace}`: To learn more about which namespace to use, refer to the [API overview](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/developer-resources/api-reference/http-api/apis/).
- `{name}`: The `metadata.name` of the recording rule.

##### Example request

The following example updates the recording rule's evaluation interval:

```http
PUT /apis/rules.alerting.grafana.app/v1beta1/namespaces/default/recordingrules/service-request-rate HTTP/1.1
Accept: application/json
Content-Type: application/json
Authorization: Bearer <SERVICE_ACCOUNT_TOKEN>

{
  "apiVersion": "rules.alerting.grafana.app/v1beta1",
  "kind": "RecordingRule",
  "metadata": {
    "name": "service-request-rate",
    "resourceVersion": "1",
    "annotations": {
      "grafana.app/folder": "<FOLDER_UID>"
    }
  },
  "spec": {
    "title": "Service request rate",
    "metric": "job:http_requests_total:rate5m",
    "targetDatasourceUID": "<TARGET_DATASOURCE_UID>",
    "trigger": {
      "interval": "2m"
    },
    "expressions": {
      "A": {
        "source": true,
        "datasourceUID": "<SOURCE_DATASOURCE_UID>",
        "relativeTimeRange": {
          "from": "5m",
          "to": "0s"
        },
        "model": {
          "expr": "sum by (job) (rate(http_requests_total[5m]))"
        }
      }
    }
  }
}
```

##### Example response

The response returns `200 OK` with the updated `RecordingRule` object and an incremented `metadata.resourceVersion`.

#### Delete a recording rule

`DELETE /apis/rules.alerting.grafana.app/v1beta1/namespaces/{namespace}/recordingrules/{name}`

Deletes a `RecordingRule` resource by `metadata.name`.

**Path parameters**:

- `{namespace}`: To learn more about which namespace to use, refer to the [API overview](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/developer-resources/api-reference/http-api/apis/).
- `{name}`: The `metadata.name` of the recording rule.

##### Example request

The following example deletes a recording rule:

```http
DELETE /apis/rules.alerting.grafana.app/v1beta1/namespaces/default/recordingrules/service-request-rate HTTP/1.1
Accept: application/json
Authorization: Bearer <SERVICE_ACCOUNT_TOKEN>
```

##### Example response

The response returns `200 OK` with the deleted `RecordingRule` object (or a `Status` object when served from unified storage).

### Details

- **Selectable fields:** On `GET /recordingrules`, `fieldSelector` supports `spec.title`, `spec.paused`, `spec.metric`, and `spec.targetDatasourceUID`. `labelSelector` supports `grafana.app/folder` and `grafana.com/group`, as well as `grafana.app/get-history=true` (with `fieldSelector=metadata.name=<RULE_UID>`) and `grafana.app/get-trash=true`.
- **Sequence membership:** Remove a recording rule from any `RuleSequence` before deleting it or moving it to another folder.

## Rule sequences

{{< admonition type="note" >}}
Rule sequences are in [public preview](https://grafana.com/docs/release-life-cycle/#public-preview). For evaluation behavior and constraints, refer to [Configure rule sequences](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/alerting/alerting-rules/rule-sequences/).
{{< /admonition >}}

A `RuleSequence` resource (`rulesequences`) evaluates existing Grafana-managed recording rules and optional alert rules in a defined order at a shared evaluation interval.

### Schema

A `RuleSequence` resource requires `metadata.annotations["grafana.app/folder"]` and contains the following fields in `spec`:

- **`spec.trigger.interval`:** Required. Shared evaluation interval for every rule in the sequence, overriding each rule's individual interval while it belongs to the sequence.
- **`spec.recordingRules`:** Required non-empty ordered array of `{ "name": "<RULE_UID>" }` references to `RecordingRule` resources in the same folder.
- **`spec.alertRules`:** Optional ordered array of `{ "name": "<RULE_UID>" }` references to `AlertRule` resources in the same folder, evaluated after `recordingRules` (named `spec.alertingRules` in `v0alpha1`).

### Endpoints

The following table lists the main endpoints for `RuleSequence` resources. For `PATCH`, collection `DELETE`, `POST /rulesequences/search`, and `/status` sub-resource endpoints, refer to [Swagger](https://play.grafana.org/swagger?api=rules.alerting.grafana.app-v1beta1).

**Base path:** `/apis/rules.alerting.grafana.app/v1beta1/namespaces/{namespace}/`

| Method | Summary                                           | Path                   |
| ------ | ------------------------------------------------- | ---------------------- |
| GET    | [List rule sequences](#list-rule-sequences)       | `rulesequences`        |
| GET    | [Get a rule sequence](#get-a-rule-sequence)       | `rulesequences/{name}` |
| POST   | [Create a rule sequence](#create-a-rule-sequence) | `rulesequences`        |
| PUT    | [Update a rule sequence](#update-a-rule-sequence) | `rulesequences/{name}` |
| DELETE | [Delete a rule sequence](#delete-a-rule-sequence) | `rulesequences/{name}` |

#### List rule sequences

`GET /apis/rules.alerting.grafana.app/v1beta1/namespaces/{namespace}/rulesequences`

Lists the `RuleSequence` resources in the namespace.

**Path parameters**:

- `{namespace}`: To learn more about which namespace to use, refer to the [API overview](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/developer-resources/api-reference/http-api/apis/).

##### Example request

The following example lists rule sequences in the namespace:

```http
GET /apis/rules.alerting.grafana.app/v1beta1/namespaces/default/rulesequences HTTP/1.1
Accept: application/json
Authorization: Bearer <SERVICE_ACCOUNT_TOKEN>
```

##### Example response

The response returns `200 OK` with a `RuleSequenceList` object containing `RuleSequence` items in `items`.

#### Get a rule sequence

`GET /apis/rules.alerting.grafana.app/v1beta1/namespaces/{namespace}/rulesequences/{name}`

Retrieves a `RuleSequence` resource by `metadata.name`.

**Path parameters**:

- `{namespace}`: To learn more about which namespace to use, refer to the [API overview](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/developer-resources/api-reference/http-api/apis/).
- `{name}`: The `metadata.name` of the rule sequence.

##### Example request

The following example gets a rule sequence:

```http
GET /apis/rules.alerting.grafana.app/v1beta1/namespaces/default/rulesequences/request-error-sequence HTTP/1.1
Accept: application/json
Authorization: Bearer <SERVICE_ACCOUNT_TOKEN>
```

##### Example response

The response returns `200 OK` with the `RuleSequence` object.

#### Create a rule sequence

`POST /apis/rules.alerting.grafana.app/v1beta1/namespaces/{namespace}/rulesequences`

Creates a `RuleSequence` resource in the folder specified by `metadata.annotations["grafana.app/folder"]`.

**Path parameters**:

- `{namespace}`: To learn more about which namespace to use, refer to the [API overview](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/developer-resources/api-reference/http-api/apis/).

##### Example request

The following example creates a rule sequence in `v1beta1` that evaluates two recording rules followed by an alert rule every minute:

```http
POST /apis/rules.alerting.grafana.app/v1beta1/namespaces/default/rulesequences HTTP/1.1
Accept: application/json
Content-Type: application/json
Authorization: Bearer <SERVICE_ACCOUNT_TOKEN>

{
  "apiVersion": "rules.alerting.grafana.app/v1beta1",
  "kind": "RuleSequence",
  "metadata": {
    "name": "request-error-sequence",
    "annotations": {
      "grafana.app/folder": "<FOLDER_UID>"
    }
  },
  "spec": {
    "trigger": {
      "interval": "1m"
    },
    "recordingRules": [
      { "name": "<REQUEST_RATE_RULE_UID>" },
      { "name": "<ERROR_RATIO_RULE_UID>" }
    ],
    "alertRules": [
      { "name": "<ALERT_RULE_UID>" }
    ]
  }
}
```

Replace `<FOLDER_UID>` with the shared folder UID, and replace `<REQUEST_RATE_RULE_UID>`, `<ERROR_RATIO_RULE_UID>`, and `<ALERT_RULE_UID>` with the `metadata.name` of each rule.

##### Example response

On success, Grafana returns `201 Created` with the created `RuleSequence` object.

#### Update a rule sequence

`PUT /apis/rules.alerting.grafana.app/v1beta1/namespaces/{namespace}/rulesequences/{name}`

Updates the evaluation order, rule membership, or interval of a `RuleSequence` resource. Include `metadata.resourceVersion` from the latest version you read.

**Path parameters**:

- `{namespace}`: To learn more about which namespace to use, refer to the [API overview](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/developer-resources/api-reference/http-api/apis/).
- `{name}`: The `metadata.name` of the rule sequence.

##### Example request

The following example updates the shared evaluation interval of a rule sequence:

```http
PUT /apis/rules.alerting.grafana.app/v1beta1/namespaces/default/rulesequences/request-error-sequence HTTP/1.1
Accept: application/json
Content-Type: application/json
Authorization: Bearer <SERVICE_ACCOUNT_TOKEN>

{
  "apiVersion": "rules.alerting.grafana.app/v1beta1",
  "kind": "RuleSequence",
  "metadata": {
    "name": "request-error-sequence",
    "resourceVersion": "1",
    "annotations": {
      "grafana.app/folder": "<FOLDER_UID>"
    }
  },
  "spec": {
    "trigger": {
      "interval": "2m"
    },
    "recordingRules": [
      { "name": "<REQUEST_RATE_RULE_UID>" },
      { "name": "<ERROR_RATIO_RULE_UID>" }
    ],
    "alertRules": [
      { "name": "<ALERT_RULE_UID>" }
    ]
  }
}
```

##### Example response

The response returns `200 OK` with the updated `RuleSequence` object and an incremented `metadata.resourceVersion`.

#### Delete a rule sequence

`DELETE /apis/rules.alerting.grafana.app/v1beta1/namespaces/{namespace}/rulesequences/{name}`

Deletes a `RuleSequence` resource without deleting the rules it references. Removed rules return to their own stored evaluation intervals.

**Path parameters**:

- `{namespace}`: To learn more about which namespace to use, refer to the [API overview](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/developer-resources/api-reference/http-api/apis/).
- `{name}`: The `metadata.name` of the rule sequence.

##### Example request

The following example deletes a rule sequence:

```http
DELETE /apis/rules.alerting.grafana.app/v1beta1/namespaces/default/rulesequences/request-error-sequence HTTP/1.1
Accept: application/json
Authorization: Bearer <SERVICE_ACCOUNT_TOKEN>
```

##### Example response

The response returns `200 OK` with a `Status` object confirming deletion.

### Details

- **Same-folder requirement:** All referenced recording rules and alert rules must already exist in the same folder as the `RuleSequence`.
- **Single-sequence membership:** Each rule can belong to at most one `RuleSequence`, and `spec.trigger.interval` must be an integer multiple of your instance's base evaluation interval.

## Status codes

The following sections list the status codes that the endpoints on this page return, by resource.

### Alert rules

The endpoints for alert rules return the following status codes:

| Code  | Meaning                                                                                              | Returned by                                                                                                            |
| ----- | ---------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| `200` | OK.                                                                                                  | [List](#list-alert-rules), [Get](#get-an-alert-rule), [Update](#update-an-alert-rule), [Delete](#delete-an-alert-rule) |
| `201` | Created.                                                                                             | [Create](#create-an-alert-rule)                                                                                        |
| `400` | Bad request (invalid selector).                                                                      | [List](#list-alert-rules)                                                                                              |
| `400` | Bad request (invalid JSON, invalid duration or expression, or missing folder).                       | [Create](#create-an-alert-rule), [Update](#update-an-alert-rule)                                                       |
| `401` | Unauthorized.                                                                                        | All endpoints                                                                                                          |
| `403` | Access denied.                                                                                       | [List](#list-alert-rules), [Get](#get-an-alert-rule), [Update](#update-an-alert-rule), [Delete](#delete-an-alert-rule) |
| `403` | Access denied (missing RBAC permission, missing provenance permission, or alert rule quota reached). | [Create](#create-an-alert-rule)                                                                                        |
| `404` | Alert rule not found.                                                                                | [Get](#get-an-alert-rule), [Delete](#delete-an-alert-rule)                                                             |
| `404` | Target folder not found.                                                                             | [Create](#create-an-alert-rule)                                                                                        |
| `404` | Alert rule or target folder not found.                                                               | [Update](#update-an-alert-rule)                                                                                        |
| `409` | Conflict (an alert rule with the same `metadata.name` already exists).                               | [Create](#create-an-alert-rule)                                                                                        |
| `409` | Conflict (`metadata.resourceVersion` doesn't match the stored version).                              | [Update](#update-an-alert-rule)                                                                                        |
| `409` | Conflict (the alert rule is still referenced by a `RuleSequence`).                                   | [Delete](#delete-an-alert-rule)                                                                                        |
| `422` | Schema validation error (for example, `notificationSettings.type` is missing).                       | [Create](#create-an-alert-rule)                                                                                        |
| `422` | Schema validation error.                                                                             | [Update](#update-an-alert-rule)                                                                                        |

### Recording rules

The endpoints for recording rules return the following status codes:

| Code  | Meaning                                                                                        | Returned by                                                                                                                         |
| ----- | ---------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| `200` | OK.                                                                                            | [List](#list-recording-rules), [Get](#get-a-recording-rule), [Update](#update-a-recording-rule), [Delete](#delete-a-recording-rule) |
| `201` | Created.                                                                                       | [Create](#create-a-recording-rule)                                                                                                  |
| `400` | Bad request (invalid selector).                                                                | [List](#list-recording-rules)                                                                                                       |
| `400` | Bad request (invalid JSON, invalid metric name or duration, or missing folder).                | [Create](#create-a-recording-rule), [Update](#update-a-recording-rule)                                                              |
| `401` | Unauthorized.                                                                                  | All endpoints                                                                                                                       |
| `403` | Access denied.                                                                                 | [List](#list-recording-rules), [Get](#get-a-recording-rule), [Update](#update-a-recording-rule), [Delete](#delete-a-recording-rule) |
| `403` | Access denied (missing RBAC permission, missing provenance permission, or rule quota reached). | [Create](#create-a-recording-rule)                                                                                                  |
| `404` | Recording rule not found.                                                                      | [Get](#get-a-recording-rule), [Delete](#delete-a-recording-rule)                                                                    |
| `404` | Target folder not found.                                                                       | [Create](#create-a-recording-rule)                                                                                                  |
| `404` | Recording rule or target folder not found.                                                     | [Update](#update-a-recording-rule)                                                                                                  |
| `409` | Conflict (a recording rule with the same `metadata.name` already exists).                      | [Create](#create-a-recording-rule)                                                                                                  |
| `409` | Conflict (`metadata.resourceVersion` doesn't match the stored version).                        | [Update](#update-a-recording-rule)                                                                                                  |
| `409` | Conflict (the recording rule is still referenced by a `RuleSequence`).                         | [Delete](#delete-a-recording-rule)                                                                                                  |
| `422` | Schema validation error.                                                                       | [Create](#create-a-recording-rule), [Update](#update-a-recording-rule)                                                              |

### Rule sequences

The endpoints for rule sequences return the following status codes:

| Code  | Meaning                                                                                                                 | Returned by                                                                                                                     |
| ----- | ----------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| `200` | OK.                                                                                                                     | [List](#list-rule-sequences), [Get](#get-a-rule-sequence), [Update](#update-a-rule-sequence), [Delete](#delete-a-rule-sequence) |
| `201` | Created.                                                                                                                | [Create](#create-a-rule-sequence)                                                                                               |
| `400` | Bad request (invalid JSON or missing folder).                                                                           | [Create](#create-a-rule-sequence)                                                                                               |
| `400` | Bad request (invalid JSON).                                                                                             | [Update](#update-a-rule-sequence)                                                                                               |
| `401` | Unauthorized.                                                                                                           | All endpoints                                                                                                                   |
| `403` | Access denied.                                                                                                          | All endpoints                                                                                                                   |
| `404` | Rule sequence not found.                                                                                                | [Get](#get-a-rule-sequence), [Update](#update-a-rule-sequence), [Delete](#delete-a-rule-sequence)                               |
| `404` | Target folder not found.                                                                                                | [Create](#create-a-rule-sequence)                                                                                               |
| `409` | Conflict (a rule sequence with the same `metadata.name` already exists).                                                | [Create](#create-a-rule-sequence)                                                                                               |
| `409` | Conflict (`metadata.resourceVersion` doesn't match the stored version).                                                 | [Update](#update-a-rule-sequence)                                                                                               |
| `422` | Schema validation error (for example, a referenced rule is missing, in another folder, or already in another sequence). | [Create](#create-a-rule-sequence)                                                                                               |
| `422` | Schema validation error.                                                                                                | [Update](#update-a-rule-sequence)                                                                                               |

## Migrate from the legacy Alerting Provisioning API

Together with the [Alert notifications HTTP API](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/developer-resources/api-reference/http-api/alert-notifications/), this API partially replaces the legacy [Alerting Provisioning HTTP API](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/developer-resources/api-reference/http-api/api-legacy/alerting_provisioning/). Specifically, this API replaces the alert rule and rule group CRUD endpoints, while notification endpoints move to `notifications.alerting.grafana.app/v1beta1`.

The following table shows how the legacy alert rule endpoints map to `rules.alerting.grafana.app/v1beta1`:

| Legacy endpoint                                                                    | New endpoint                                                                                                                                                              |
| ---------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GET /api/v1/provisioning/alert-rules`                                             | `GET /apis/rules.alerting.grafana.app/v1beta1/namespaces/{namespace}/alertrules` and `GET /apis/rules.alerting.grafana.app/v1beta1/namespaces/{namespace}/recordingrules` |
| `GET /api/v1/provisioning/alert-rules/:uid`                                        | `GET /apis/rules.alerting.grafana.app/v1beta1/namespaces/{namespace}/alertrules/{name}` or `.../recordingrules/{name}`                                                    |
| `POST /api/v1/provisioning/alert-rules`                                            | `POST /apis/rules.alerting.grafana.app/v1beta1/namespaces/{namespace}/alertrules` or `.../recordingrules`                                                                 |
| `PUT /api/v1/provisioning/alert-rules/:uid`                                        | `PUT /apis/rules.alerting.grafana.app/v1beta1/namespaces/{namespace}/alertrules/{name}` or `.../recordingrules/{name}`                                                    |
| `DELETE /api/v1/provisioning/alert-rules/:uid`                                     | `DELETE /apis/rules.alerting.grafana.app/v1beta1/namespaces/{namespace}/alertrules/{name}` or `.../recordingrules/{name}`                                                 |
| `GET /api/v1/provisioning/folder/:folderUid/rule-groups/:group`                    | `GET .../alertrules` or `.../recordingrules` with `labelSelector=grafana.app/folder=<FOLDER_UID>,grafana.com/group=<GROUP>`                                               |
| `PUT /api/v1/provisioning/folder/:folderUid/rule-groups/:group`                    | Manage individual `AlertRule` and `RecordingRule` resources; use `RuleSequence` for ordered evaluation                                                                    |
| `DELETE /api/v1/provisioning/folder/:folderUid/rule-groups/:group`                 | Delete individual `AlertRule` and `RecordingRule` resources                                                                                                               |
| `GET /api/v1/provisioning/alert-rules*/export` and `.../rule-groups/:group/export` | No equivalent in this API; file-provisioning export remains on the legacy API                                                                                             |

When you migrate, consider the following differences:

- **Separate resource kinds:** The legacy API uses one `ProvisionedAlertRule` payload for both alert rules and recording rules (distinguished by whether `record` is set). The new API separates them into `AlertRule` (`alertrules`) and `RecordingRule` (`recordingrules`), each with its own validated schema.
- **One resource per rule:** You no longer need to `PUT` an entire rule group to change evaluation intervals or rule membership. Each rule sets its own `spec.trigger.interval`, and ordered evaluation across rules uses `RuleSequence`.
- **Metadata placement:** `uid` moves to `metadata.name`, `folderUID` moves to `metadata.annotations["grafana.app/folder"]`, and optimistic concurrency uses `metadata.resourceVersion`.
- **Expressions map:** The legacy `data` array and top-level `condition` string become `spec.expressions`, a map keyed by `refId` where the alert condition or recorded query sets `"source": true` and `relativeTimeRange` uses duration strings (such as `"from": "5m", "to": "0s"`) instead of integer seconds.
- **Provenance:** Instead of sending the `X-Disable-Provenance` request header, set `metadata.annotations["grafana.com/provenance"]` to `"api"` to lock a rule from UI edits, or omit the annotation to allow UI edits.
- **Notification endpoints:** Contact points, notification policies, templates, and mute timings are managed through the [Alert notifications HTTP API](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/developer-resources/api-reference/http-api/alert-notifications/).

## Related resources

Use the following resources to keep working with Grafana Alerting APIs:

- **Alert notifications HTTP API:** Refer to [Alert notifications HTTP API](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/developer-resources/api-reference/http-api/alert-notifications/).
- **Alert enrichment HTTP API:** Refer to [Alert enrichment HTTP API](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/developer-resources/api-reference/http-api/alert-enrichment/).
- **Rule sequences:** Refer to [Configure rule sequences](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/alerting/alerting-rules/rule-sequences/).
- **API structure:** Refer to [API structure in Grafana](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/developer-resources/api-reference/http-api/apis/).
