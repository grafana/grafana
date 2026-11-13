---
canonical: https://grafana.com/docs/grafana/latest/developer-resources/api-reference/http-api/alert-notifications/
description: Grafana Alert notifications HTTP API
keywords:
  - grafana
  - http
  - documentation
  - api
  - alerting
  - notifications
  - contact points
  - notification policies
  - mute timings
  - templates
  - inhibition rules
labels:
  products:
    - enterprise
    - oss
    - cloud
title: Alert notifications HTTP API
weight: 100
---

# Alert notifications HTTP API

{{< admonition type="note" >}}
Available in Grafana 13.0 and later.

This API complies with the new Grafana API structure. To learn more refer to documentation about the [API structure in Grafana](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/developer-resources/api-reference/http-api/apis/).

The legacy [Alerting Provisioning HTTP API](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/developer-resources/api-reference/http-api/api-legacy/alerting_provisioning/) is still available. Together with the [Alert rules HTTP API](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/developer-resources/api-reference/http-api/alert-rules/), this API partially replaces it. Refer to [Migrate from the legacy Alerting Provisioning API](#migrate-from-the-legacy-alerting-provisioning-api) to learn how both APIs match.

**This document may not contain the latest version of the API. For the most up-to-date list of available endpoints, refer to [notifications.alerting.grafana.app/v1beta1](https://play.grafana.org/swagger?api=notifications.alerting.grafana.app-v1beta1) in Swagger.**

This API is in `beta`, so it might change in future releases.

{{< /admonition >}}

Use this API to manage Grafana-managed alerting notification resources: contact points (`Receiver`), notification policy trees (`RoutingTree`), notification template groups (`TemplateGroup`), mute timings and active time intervals (`TimeInterval`), inhibition rules (`InhibitionRule`), and external Alertmanager sync settings (`Config`).

All paths use the `notifications.alerting.grafana.app` group and the `v1beta1` version. Replace `{namespace}` with your namespace. To learn more about which namespace to use, refer to the [API overview](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/developer-resources/api-reference/http-api/apis/). Grafana also serves `v0alpha1` for backward compatibility; use `v1beta1` for new integrations.

## Before you begin

Before you begin, ensure you have the following:

- **Grafana Alerting enabled:** Grafana Alerting must be enabled on your instance.
- **API authentication:** Authenticate with a service account token or basic authentication (OSS and Enterprise). Refer to [HTTP API authentication](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/developer-resources/api-reference/http-api/authentication/).

## Requirements

If you're running Grafana Enterprise or Grafana Cloud, you need role-based access control (RBAC) permissions for the resource type you're managing. For the full list of alerting permissions and scopes, refer to [Manage access using roles](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/alerting/set-up/configure-rbac/access-roles/).

| Resource                             | Reader fixed role                        | Writer fixed role                        |
| ------------------------------------ | ---------------------------------------- | ---------------------------------------- |
| All notification resources           | `fixed:alerting.notifications:reader`    | `fixed:alerting.notifications:writer`    |
| Receivers (`receivers`)              | `fixed:alerting.receivers:reader`        | `fixed:alerting.receivers:writer`        |
| Routing trees (`routingtrees`)       | `fixed:alerting.routes:reader`           | `fixed:alerting.routes:writer`           |
| Template groups (`templategroups`)   | `fixed:alerting.templates:reader`        | `fixed:alerting.templates:writer`        |
| Time intervals (`timeintervals`)     | `fixed:alerting.time-intervals:reader`   | `fixed:alerting.time-intervals:writer`   |
| Inhibition rules (`inhibitionrules`) | `fixed:alerting.inhibition-rules:reader` | `fixed:alerting.inhibition-rules:writer` |

By default, the Viewer basic role includes read access to notification resources, and the Editor and Admin basic roles include write access. Reading or updating the singleton `Config` resource requires `alert.notifications.configs:read` (Viewer) or `alert.notifications.configs:update` (Admin).

### Provenance annotation

To mark a notification resource as provisioned (read-only in the Grafana UI), set `metadata.annotations["grafana.com/provenance"]` to `api`. Setting or changing provenance requires one of the following permissions:

- `alert.provisioning:write`
- `alert.notifications.provisioning:write`
- `alert.provisioning.provenance:write`

Callers without these permissions can still create, update, and delete notification resources without setting `grafana.com/provenance`.

## Endpoints

The following table lists the main endpoints across the notification resources. Each standard resource (`receivers`, `routingtrees`, `templategroups`, `timeintervals`, `inhibitionrules`) also supports `PATCH` (partial update), `DELETE` on the collection path, and `POST /.../search`. For full request and response schemas, refer to [Swagger](https://play.grafana.org/swagger?api=notifications.alerting.grafana.app-v1beta1).

| Method | Summary                                                                                             | URI                                                                                              |
| ------ | --------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| GET    | [List receivers](#list-receivers)                                                                   | `/apis/notifications.alerting.grafana.app/v1beta1/namespaces/{namespace}/receivers`              |
| GET    | [Get a receiver](#get-a-receiver)                                                                   | `/apis/notifications.alerting.grafana.app/v1beta1/namespaces/{namespace}/receivers/{name}`       |
| POST   | [Create a receiver](#create-a-receiver)                                                             | `/apis/notifications.alerting.grafana.app/v1beta1/namespaces/{namespace}/receivers`              |
| PUT    | [Update a receiver](#update-a-receiver)                                                             | `/apis/notifications.alerting.grafana.app/v1beta1/namespaces/{namespace}/receivers/{name}`       |
| DELETE | [Delete a receiver](#delete-a-receiver)                                                             | `/apis/notifications.alerting.grafana.app/v1beta1/namespaces/{namespace}/receivers/{name}`       |
| POST   | [Test a receiver integration](#test-a-receiver-integration)                                         | `/apis/notifications.alerting.grafana.app/v1beta1/namespaces/{namespace}/receivers/{name}/test`  |
| GET    | [List integration type schemas](#list-integration-type-schemas)                                     | `/apis/notifications.alerting.grafana.app/v1beta1/namespaces/{namespace}/integrationtypeschemas` |
| GET    | [List routing trees](#list-routing-trees)                                                           | `/apis/notifications.alerting.grafana.app/v1beta1/namespaces/{namespace}/routingtrees`           |
| GET    | [Get a routing tree](#get-a-routing-tree)                                                           | `/apis/notifications.alerting.grafana.app/v1beta1/namespaces/{namespace}/routingtrees/{name}`    |
| POST   | [Create a named routing tree](#create-a-named-routing-tree)                                         | `/apis/notifications.alerting.grafana.app/v1beta1/namespaces/{namespace}/routingtrees`           |
| PUT    | [Update a routing tree](#update-a-routing-tree)                                                     | `/apis/notifications.alerting.grafana.app/v1beta1/namespaces/{namespace}/routingtrees/{name}`    |
| DELETE | [Delete a routing tree](#delete-a-routing-tree)                                                     | `/apis/notifications.alerting.grafana.app/v1beta1/namespaces/{namespace}/routingtrees/{name}`    |
| GET    | [List template groups](#list-template-groups)                                                       | `/apis/notifications.alerting.grafana.app/v1beta1/namespaces/{namespace}/templategroups`         |
| GET    | [Get a template group](#get-a-template-group)                                                       | `/apis/notifications.alerting.grafana.app/v1beta1/namespaces/{namespace}/templategroups/{name}`  |
| POST   | [Create a template group](#create-a-template-group)                                                 | `/apis/notifications.alerting.grafana.app/v1beta1/namespaces/{namespace}/templategroups`         |
| PUT    | [Update a template group](#update-a-template-group)                                                 | `/apis/notifications.alerting.grafana.app/v1beta1/namespaces/{namespace}/templategroups/{name}`  |
| DELETE | [Delete a template group](#delete-a-template-group)                                                 | `/apis/notifications.alerting.grafana.app/v1beta1/namespaces/{namespace}/templategroups/{name}`  |
| GET    | [List time intervals](#list-time-intervals)                                                         | `/apis/notifications.alerting.grafana.app/v1beta1/namespaces/{namespace}/timeintervals`          |
| GET    | [Get a time interval](#get-a-time-interval)                                                         | `/apis/notifications.alerting.grafana.app/v1beta1/namespaces/{namespace}/timeintervals/{name}`   |
| POST   | [Create a time interval](#create-a-time-interval)                                                   | `/apis/notifications.alerting.grafana.app/v1beta1/namespaces/{namespace}/timeintervals`          |
| PUT    | [Update a time interval](#update-a-time-interval)                                                   | `/apis/notifications.alerting.grafana.app/v1beta1/namespaces/{namespace}/timeintervals/{name}`   |
| DELETE | [Delete a time interval](#delete-a-time-interval)                                                   | `/apis/notifications.alerting.grafana.app/v1beta1/namespaces/{namespace}/timeintervals/{name}`   |
| GET    | [List inhibition rules](#list-inhibition-rules)                                                     | `/apis/notifications.alerting.grafana.app/v1beta1/namespaces/{namespace}/inhibitionrules`        |
| GET    | [Get an inhibition rule](#get-an-inhibition-rule)                                                   | `/apis/notifications.alerting.grafana.app/v1beta1/namespaces/{namespace}/inhibitionrules/{name}` |
| POST   | [Create an inhibition rule](#create-an-inhibition-rule)                                             | `/apis/notifications.alerting.grafana.app/v1beta1/namespaces/{namespace}/inhibitionrules`        |
| PUT    | [Update an inhibition rule](#update-an-inhibition-rule)                                             | `/apis/notifications.alerting.grafana.app/v1beta1/namespaces/{namespace}/inhibitionrules/{name}` |
| DELETE | [Delete an inhibition rule](#delete-an-inhibition-rule)                                             | `/apis/notifications.alerting.grafana.app/v1beta1/namespaces/{namespace}/inhibitionrules/{name}` |
| GET    | [Get external Alertmanager sync configuration](#get-external-alertmanager-sync-configuration)       | `/apis/notifications.alerting.grafana.app/v1beta1/namespaces/{namespace}/configs/default`        |
| PUT    | [Update external Alertmanager sync configuration](#update-external-alertmanager-sync-configuration) | `/apis/notifications.alerting.grafana.app/v1beta1/namespaces/{namespace}/configs/default`        |

## Receivers (contact points)

A `Receiver` resource (`receivers`) represents a contact point and groups all of its notifier integrations (such as email, Slack, PagerDuty, or webhook) into a single object.

### Schema

A `Receiver` resource contains the following fields in `metadata` and `spec`:

- **`metadata.name`:** Optional on create (must be a lowercase DNS-compatible UID if supplied; otherwise Grafana generates one). Identifies the receiver in URL paths, while `spec.title` is the contact point name referenced by routing trees and alert rules.
- **`spec.title`:** Required. Display name of the contact point.
- **`spec.integrations`:** Required array of notifier integrations. Each item specifies `type` (for example, `email`, `slack`, `webhook`), `version` (for example, `1`), `settings`, optional `disableResolveMessage`, optional `uid` (assigned by Grafana), and read-only `secureFields` indicating which keys in `settings` are stored encrypted.

### Operations

The following table lists the main operations for `Receiver` resources:

| Method | Summary                                                         | URI                                                                                              |
| ------ | --------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| GET    | [List receivers](#list-receivers)                               | `/apis/notifications.alerting.grafana.app/v1beta1/namespaces/{namespace}/receivers`              |
| GET    | [Get a receiver](#get-a-receiver)                               | `/apis/notifications.alerting.grafana.app/v1beta1/namespaces/{namespace}/receivers/{name}`       |
| POST   | [Create a receiver](#create-a-receiver)                         | `/apis/notifications.alerting.grafana.app/v1beta1/namespaces/{namespace}/receivers`              |
| PUT    | [Update a receiver](#update-a-receiver)                         | `/apis/notifications.alerting.grafana.app/v1beta1/namespaces/{namespace}/receivers/{name}`       |
| DELETE | [Delete a receiver](#delete-a-receiver)                         | `/apis/notifications.alerting.grafana.app/v1beta1/namespaces/{namespace}/receivers/{name}`       |
| POST   | [Test a receiver integration](#test-a-receiver-integration)     | `/apis/notifications.alerting.grafana.app/v1beta1/namespaces/{namespace}/receivers/{name}/test`  |
| GET    | [List integration type schemas](#list-integration-type-schemas) | `/apis/notifications.alerting.grafana.app/v1beta1/namespaces/{namespace}/integrationtypeschemas` |

#### List receivers

`GET /apis/notifications.alerting.grafana.app/v1beta1/namespaces/{namespace}/receivers`

Lists all `Receiver` resources in the namespace that you have permission to read.

**Path parameters**:

- `{namespace}`: To learn more about which namespace to use, refer to the [API overview](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/developer-resources/api-reference/http-api/apis/).

#### Get a receiver

`GET /apis/notifications.alerting.grafana.app/v1beta1/namespaces/{namespace}/receivers/{name}`

Retrieves a `Receiver` resource by `metadata.name`.

**Path parameters**:

- `{namespace}`: To learn more about which namespace to use, refer to the [API overview](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/developer-resources/api-reference/http-api/apis/).
- `{name}`: The `metadata.name` of the receiver.

#### Create a receiver

`POST /apis/notifications.alerting.grafana.app/v1beta1/namespaces/{namespace}/receivers`

Creates a contact point with all of its notifier integrations.

**Path parameters**:

- `{namespace}`: To learn more about which namespace to use, refer to the [API overview](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/developer-resources/api-reference/http-api/apis/).

##### Example request

The following example creates a contact point with a webhook integration:

```http
POST /apis/notifications.alerting.grafana.app/v1beta1/namespaces/default/receivers HTTP/1.1
Accept: application/json
Content-Type: application/json
Authorization: Bearer <SERVICE_ACCOUNT_TOKEN>

{
  "apiVersion": "notifications.alerting.grafana.app/v1beta1",
  "kind": "Receiver",
  "metadata": {
    "name": "oncall-webhook"
  },
  "spec": {
    "title": "On-call webhook",
    "integrations": [
      {
        "type": "webhook",
        "version": "1",
        "disableResolveMessage": false,
        "settings": {
          "url": "https://example.com/alerts/webhook",
          "httpMethod": "POST"
        }
      }
    ]
  }
}
```

Replace `<SERVICE_ACCOUNT_TOKEN>` with a token that has contact point create permissions.

##### Example response

The following example shows the response:

```http
HTTP/1.1 201 Created
Content-Type: application/json

{
  "kind": "Receiver",
  "apiVersion": "notifications.alerting.grafana.app/v1beta1",
  "metadata": {
    "name": "oncall-webhook",
    "namespace": "default",
    "uid": "7f3a9d2e-1b4c-4e8a-9c0d-2f4b6e8a0c12",
    "resourceVersion": "a1b2c3d4e5f60718"
  },
  "spec": {
    "title": "On-call webhook",
    "integrations": [
      {
        "uid": "d9e8f7a6b5c4",
        "type": "webhook",
        "version": "1",
        "disableResolveMessage": false,
        "settings": {
          "url": "https://example.com/alerts/webhook",
          "httpMethod": "POST"
        }
      }
    ]
  }
}
```

#### Update a receiver

`PUT /apis/notifications.alerting.grafana.app/v1beta1/namespaces/{namespace}/receivers/{name}`

Replaces an existing `Receiver` resource. Include `metadata.resourceVersion` from the latest version you read, or use `PATCH` for partial updates.

**Path parameters**:

- `{namespace}`: To learn more about which namespace to use, refer to the [API overview](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/developer-resources/api-reference/http-api/apis/).
- `{name}`: The `metadata.name` of the receiver.

#### Delete a receiver

`DELETE /apis/notifications.alerting.grafana.app/v1beta1/namespaces/{namespace}/receivers/{name}`

Deletes a `Receiver` resource by `metadata.name`. Deleting a receiver that is still referenced by a notification policy or alert rule returns `409 Conflict`.

**Path parameters**:

- `{namespace}`: To learn more about which namespace to use, refer to the [API overview](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/developer-resources/api-reference/http-api/apis/).
- `{name}`: The `metadata.name` of the receiver.

#### Test a receiver integration

`POST /apis/notifications.alerting.grafana.app/v1beta1/namespaces/{namespace}/receivers/{name}/test`

Sends a test alert notification through one integration. Pass an existing receiver's `metadata.name` as `{name}` to test a saved integration (referencing `integration.uid` if reusing stored secrets), or pass `-` as `{name}` to test a new integration before saving it.

**Path parameters**:

- `{namespace}`: To learn more about which namespace to use, refer to the [API overview](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/developer-resources/api-reference/http-api/apis/).
- `{name}`: Receiver `metadata.name`, or `-` for an unsaved receiver.

#### List integration type schemas

`GET /apis/notifications.alerting.grafana.app/v1beta1/namespaces/{namespace}/integrationtypeschemas`

Returns the notifier integration `type` values, versions, and `settings` field definitions supported on your Grafana instance.

**Path parameters**:

- `{namespace}`: To learn more about which namespace to use, refer to the [API overview](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/developer-resources/api-reference/http-api/apis/).

### Details

- **Name vs. title:** URL paths address a contact point by `metadata.name` (its UID), whereas routing trees and alert rule `notificationSettings.receiver` reference the contact point by `spec.title`.
- **Encrypted fields:** Secret settings (such as webhook tokens or API keys) aren't returned in plain text on `GET` unless the caller has secret-reading permissions; instead, `secureFields` marks which keys are stored encrypted.

## Routing trees (notification policies)

A `RoutingTree` resource (`routingtrees`) defines a notification policy tree that routes firing alerts to contact points.

### Schema

A `RoutingTree` resource contains the following fields in `spec`:

- **`spec.defaults`:** Required root route defaults, with `receiver` (contact point `spec.title`) and optional `group_by`, `group_wait`, `group_interval`, and `repeat_interval`.
- **`spec.routes`:** Array of child policies. Each child policy specifies `continue` (`true` or `false`), optional `receiver`, `matchers` (`label`, `type`, `value`, where `type` is `=`, `!=`, `=~`, or `!~`), `group_by`, `mute_time_intervals`, `active_time_intervals`, `group_wait`, `group_interval`, `repeat_interval`, and nested `routes`.

### Operations

The following table lists the main operations for `RoutingTree` resources:

| Method | Summary                                                     | URI                                                                                           |
| ------ | ----------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| GET    | [List routing trees](#list-routing-trees)                   | `/apis/notifications.alerting.grafana.app/v1beta1/namespaces/{namespace}/routingtrees`        |
| GET    | [Get a routing tree](#get-a-routing-tree)                   | `/apis/notifications.alerting.grafana.app/v1beta1/namespaces/{namespace}/routingtrees/{name}` |
| POST   | [Create a named routing tree](#create-a-named-routing-tree) | `/apis/notifications.alerting.grafana.app/v1beta1/namespaces/{namespace}/routingtrees`        |
| PUT    | [Update a routing tree](#update-a-routing-tree)             | `/apis/notifications.alerting.grafana.app/v1beta1/namespaces/{namespace}/routingtrees/{name}` |
| DELETE | [Delete a routing tree](#delete-a-routing-tree)             | `/apis/notifications.alerting.grafana.app/v1beta1/namespaces/{namespace}/routingtrees/{name}` |

#### List routing trees

`GET /apis/notifications.alerting.grafana.app/v1beta1/namespaces/{namespace}/routingtrees`

Lists the default routing tree (`user-defined`) and any named routing trees in the namespace.

**Path parameters**:

- `{namespace}`: To learn more about which namespace to use, refer to the [API overview](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/developer-resources/api-reference/http-api/apis/).

#### Get a routing tree

`GET /apis/notifications.alerting.grafana.app/v1beta1/namespaces/{namespace}/routingtrees/{name}`

Retrieves a `RoutingTree` resource by `metadata.name` (use `user-defined` or `default` for the default policy tree).

**Path parameters**:

- `{namespace}`: To learn more about which namespace to use, refer to the [API overview](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/developer-resources/api-reference/http-api/apis/).
- `{name}`: `user-defined` (or `default`) for the default tree, or the `metadata.name` of a named routing tree.

#### Create a named routing tree

`POST /apis/notifications.alerting.grafana.app/v1beta1/namespaces/{namespace}/routingtrees`

Creates an additional named `RoutingTree` resource that alert rules can target with `notificationSettings.type: "NamedRoutingTree"`.

**Path parameters**:

- `{namespace}`: To learn more about which namespace to use, refer to the [API overview](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/developer-resources/api-reference/http-api/apis/).

#### Update a routing tree

`PUT /apis/notifications.alerting.grafana.app/v1beta1/namespaces/{namespace}/routingtrees/{name}`

Replaces the default routing tree (`user-defined`) or a named routing tree. Retrieve the current `RoutingTree` first and include its `metadata.resourceVersion`.

**Path parameters**:

- `{namespace}`: To learn more about which namespace to use, refer to the [API overview](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/developer-resources/api-reference/http-api/apis/).
- `{name}`: `user-defined` (or `default`) for the default tree, or the `metadata.name` of a named routing tree.

##### Example request

```http
PUT /apis/notifications.alerting.grafana.app/v1beta1/namespaces/default/routingtrees/user-defined HTTP/1.1
Accept: application/json
Content-Type: application/json
Authorization: Bearer <SERVICE_ACCOUNT_TOKEN>

{
  "apiVersion": "notifications.alerting.grafana.app/v1beta1",
  "kind": "RoutingTree",
  "metadata": {
    "name": "user-defined",
    "resourceVersion": "<RESOURCE_VERSION>"
  },
  "spec": {
    "defaults": {
      "receiver": "grafana-default-email",
      "group_by": ["grafana_folder", "alertname"],
      "group_wait": "30s",
      "group_interval": "5m",
      "repeat_interval": "4h"
    },
    "routes": [
      {
        "receiver": "On-call webhook",
        "continue": false,
        "matchers": [
          {
            "label": "severity",
            "type": "=",
            "value": "critical"
          }
        ]
      }
    ]
  }
}
```

Replace `<RESOURCE_VERSION>` with the `metadata.resourceVersion` from `GET .../routingtrees/user-defined`, and replace `<SERVICE_ACCOUNT_TOKEN>` with your token.

##### Example response

On success, Grafana returns `200 OK` with the updated `RoutingTree` object.

#### Delete a routing tree

`DELETE /apis/notifications.alerting.grafana.app/v1beta1/namespaces/{namespace}/routingtrees/{name}`

Resets the default routing tree (`user-defined`) to the instance defaults, or deletes a named routing tree.

**Path parameters**:

- `{namespace}`: To learn more about which namespace to use, refer to the [API overview](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/developer-resources/api-reference/http-api/apis/).
- `{name}`: `user-defined` (or `default`) for the default tree, or the `metadata.name` of a named routing tree.

### Details

Every organization has a default notification policy tree addressed by `metadata.name` set to `user-defined` (Grafana also accepts `default` as an alias in requests). Both `user-defined` and `default` are reserved and can't be used as custom names when creating named routing trees with `POST /routingtrees`.

## Template groups

A `TemplateGroup` resource (`templategroups`) stores reusable Go notification templates referenced by contact point integrations.

### Schema

A `TemplateGroup` resource contains the following fields in `spec`:

- **`spec.title`:** Required. Display name of the template group.
- **`spec.content`:** Required. Notification template definitions in Go template syntax (`{{ define "..." }}...{{ end }}`).
- **`spec.kind`:** Required. Template kind: `grafana` (default) or `mimir`.

### Operations

The following table lists the main operations for `TemplateGroup` resources:

| Method | Summary                                             | URI                                                                                             |
| ------ | --------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| GET    | [List template groups](#list-template-groups)       | `/apis/notifications.alerting.grafana.app/v1beta1/namespaces/{namespace}/templategroups`        |
| GET    | [Get a template group](#get-a-template-group)       | `/apis/notifications.alerting.grafana.app/v1beta1/namespaces/{namespace}/templategroups/{name}` |
| POST   | [Create a template group](#create-a-template-group) | `/apis/notifications.alerting.grafana.app/v1beta1/namespaces/{namespace}/templategroups`        |
| PUT    | [Update a template group](#update-a-template-group) | `/apis/notifications.alerting.grafana.app/v1beta1/namespaces/{namespace}/templategroups/{name}` |
| DELETE | [Delete a template group](#delete-a-template-group) | `/apis/notifications.alerting.grafana.app/v1beta1/namespaces/{namespace}/templategroups/{name}` |

#### List template groups

`GET /apis/notifications.alerting.grafana.app/v1beta1/namespaces/{namespace}/templategroups`

Lists all `TemplateGroup` resources in the namespace.

#### Get a template group

`GET /apis/notifications.alerting.grafana.app/v1beta1/namespaces/{namespace}/templategroups/{name}`

Retrieves a `TemplateGroup` resource by `metadata.name`.

#### Create a template group

`POST /apis/notifications.alerting.grafana.app/v1beta1/namespaces/{namespace}/templategroups`

Creates a `TemplateGroup` resource.

##### Example request

```http
POST /apis/notifications.alerting.grafana.app/v1beta1/namespaces/default/templategroups HTTP/1.1
Accept: application/json
Content-Type: application/json
Authorization: Bearer <SERVICE_ACCOUNT_TOKEN>

{
  "apiVersion": "notifications.alerting.grafana.app/v1beta1",
  "kind": "TemplateGroup",
  "metadata": {
    "name": "slack-summary"
  },
  "spec": {
    "title": "slack-summary",
    "kind": "grafana",
    "content": "{{ define \"slack.summary\" }}[{{ .Status | toUpper }}] {{ .CommonLabels.alertname }}{{ end }}"
  }
}
```

#### Update a template group

`PUT /apis/notifications.alerting.grafana.app/v1beta1/namespaces/{namespace}/templategroups/{name}`

Replaces an existing `TemplateGroup` resource. Include `metadata.resourceVersion` from the latest version you read.

#### Delete a template group

`DELETE /apis/notifications.alerting.grafana.app/v1beta1/namespaces/{namespace}/templategroups/{name}`

Deletes a `TemplateGroup` resource by `metadata.name`.

### Details

Named templates defined with `{{ define "..." }}` inside `spec.content` can be referenced across contact point integrations in the same namespace.

## Time intervals (mute timings)

A `TimeInterval` resource (`timeintervals`) defines recurring schedules that you can reference as mute timings or active time intervals.

### Schema

A `TimeInterval` resource contains the following fields in `spec`:

- **`spec.name`:** Required. Schedule name referenced by `mute_time_intervals` and `active_time_intervals` in routing trees and alert rules.
- **`spec.time_intervals`:** Required array of schedule entries. Each entry can specify `times` (`start_time` and `end_time` in `HH:MM`), `weekdays` (for example, `saturday`, `sunday`, or `monday:friday`), `days_of_month`, `months`, `years`, and IANA `location` (for example, `UTC` or `America/New_York`).

### Operations

The following table lists the main operations for `TimeInterval` resources:

| Method | Summary                                           | URI                                                                                            |
| ------ | ------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| GET    | [List time intervals](#list-time-intervals)       | `/apis/notifications.alerting.grafana.app/v1beta1/namespaces/{namespace}/timeintervals`        |
| GET    | [Get a time interval](#get-a-time-interval)       | `/apis/notifications.alerting.grafana.app/v1beta1/namespaces/{namespace}/timeintervals/{name}` |
| POST   | [Create a time interval](#create-a-time-interval) | `/apis/notifications.alerting.grafana.app/v1beta1/namespaces/{namespace}/timeintervals`        |
| PUT    | [Update a time interval](#update-a-time-interval) | `/apis/notifications.alerting.grafana.app/v1beta1/namespaces/{namespace}/timeintervals/{name}` |
| DELETE | [Delete a time interval](#delete-a-time-interval) | `/apis/notifications.alerting.grafana.app/v1beta1/namespaces/{namespace}/timeintervals/{name}` |

#### List time intervals

`GET /apis/notifications.alerting.grafana.app/v1beta1/namespaces/{namespace}/timeintervals`

Lists all `TimeInterval` resources in the namespace.

#### Get a time interval

`GET /apis/notifications.alerting.grafana.app/v1beta1/namespaces/{namespace}/timeintervals/{name}`

Retrieves a `TimeInterval` resource by `metadata.name`.

#### Create a time interval

`POST /apis/notifications.alerting.grafana.app/v1beta1/namespaces/{namespace}/timeintervals`

Creates a `TimeInterval` resource.

##### Example request

```http
POST /apis/notifications.alerting.grafana.app/v1beta1/namespaces/default/timeintervals HTTP/1.1
Accept: application/json
Content-Type: application/json
Authorization: Bearer <SERVICE_ACCOUNT_TOKEN>

{
  "apiVersion": "notifications.alerting.grafana.app/v1beta1",
  "kind": "TimeInterval",
  "metadata": {
    "name": "weekends"
  },
  "spec": {
    "name": "Weekends",
    "time_intervals": [
      {
        "weekdays": ["saturday", "sunday"],
        "location": "UTC"
      }
    ]
  }
}
```

#### Update a time interval

`PUT /apis/notifications.alerting.grafana.app/v1beta1/namespaces/{namespace}/timeintervals/{name}`

Replaces an existing `TimeInterval` resource. Include `metadata.resourceVersion` from the latest version you read.

#### Delete a time interval

`DELETE /apis/notifications.alerting.grafana.app/v1beta1/namespaces/{namespace}/timeintervals/{name}`

Deletes a `TimeInterval` resource by `metadata.name`.

### Details

Deleting a `TimeInterval` that is still referenced in `mute_time_intervals` or `active_time_intervals` on a routing tree or alert rule returns `409 Conflict`.

## Inhibition rules

An `InhibitionRule` resource (`inhibitionrules`) suppresses notifications for target alerts while a matching source alert is firing.

### Schema

An `InhibitionRule` resource contains the following fields in `spec`:

- **`spec.source_matchers`:** Optional array of matchers (`label`, `type`, `value`, where `type` is `=`, `!=`, `=~`, or `!~`) identifying firing alerts that inhibit other alerts.
- **`spec.target_matchers`:** Optional array of matchers identifying alerts to suppress.
- **`spec.equal`:** Optional array of label names that must have identical values on both the source and target alerts for inhibition to apply.

### Operations

The following table lists the main operations for `InhibitionRule` resources:

| Method | Summary                                                 | URI                                                                                              |
| ------ | ------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| GET    | [List inhibition rules](#list-inhibition-rules)         | `/apis/notifications.alerting.grafana.app/v1beta1/namespaces/{namespace}/inhibitionrules`        |
| GET    | [Get an inhibition rule](#get-an-inhibition-rule)       | `/apis/notifications.alerting.grafana.app/v1beta1/namespaces/{namespace}/inhibitionrules/{name}` |
| POST   | [Create an inhibition rule](#create-an-inhibition-rule) | `/apis/notifications.alerting.grafana.app/v1beta1/namespaces/{namespace}/inhibitionrules`        |
| PUT    | [Update an inhibition rule](#update-an-inhibition-rule) | `/apis/notifications.alerting.grafana.app/v1beta1/namespaces/{namespace}/inhibitionrules/{name}` |
| DELETE | [Delete an inhibition rule](#delete-an-inhibition-rule) | `/apis/notifications.alerting.grafana.app/v1beta1/namespaces/{namespace}/inhibitionrules/{name}` |

#### List inhibition rules

`GET /apis/notifications.alerting.grafana.app/v1beta1/namespaces/{namespace}/inhibitionrules`

Lists all `InhibitionRule` resources in the namespace.

#### Get an inhibition rule

`GET /apis/notifications.alerting.grafana.app/v1beta1/namespaces/{namespace}/inhibitionrules/{name}`

Retrieves an `InhibitionRule` resource by `metadata.name`.

#### Create an inhibition rule

`POST /apis/notifications.alerting.grafana.app/v1beta1/namespaces/{namespace}/inhibitionrules`

Creates an `InhibitionRule` resource.

##### Example request

```http
POST /apis/notifications.alerting.grafana.app/v1beta1/namespaces/default/inhibitionrules HTTP/1.1
Accept: application/json
Content-Type: application/json
Authorization: Bearer <SERVICE_ACCOUNT_TOKEN>

{
  "apiVersion": "notifications.alerting.grafana.app/v1beta1",
  "kind": "InhibitionRule",
  "spec": {
    "source_matchers": [
      {
        "label": "severity",
        "type": "=",
        "value": "critical"
      }
    ],
    "target_matchers": [
      {
        "label": "severity",
        "type": "=",
        "value": "warning"
      }
    ],
    "equal": ["cluster"]
  }
}
```

#### Update an inhibition rule

`PUT /apis/notifications.alerting.grafana.app/v1beta1/namespaces/{namespace}/inhibitionrules/{name}`

Replaces an existing `InhibitionRule` resource. Include `metadata.resourceVersion` from the latest version you read.

#### Delete an inhibition rule

`DELETE /apis/notifications.alerting.grafana.app/v1beta1/namespaces/{namespace}/inhibitionrules/{name}`

Deletes an `InhibitionRule` resource by `metadata.name`.

### Details

Both source and target alerts must share equal values for every label listed in `spec.equal` before Grafana suppresses notifications for the target alert.

## Alertmanager sync configuration

The `Config` resource (`configs`) is a per-organization singleton (`metadata.name: "default"`) for administrative notification settings.

### Schema

A `Config` resource contains the following fields in `spec` and `status`:

- **`spec.externalAlertmanagerSync.datasourceUid`:** Optional UID of a Mimir or Cortex Alertmanager data source to periodically sync Alertmanager configuration from. Empty disables sync.
- **`status.conditions`:** Read-only Kubernetes-style conditions (such as `ExternalAlertmanagerSynced`) reporting sync health.
- **`status.externalAlertmanagerSync`:** Read-only observation of the last sync run (`datasourceUid`, `origin` set to `api` or `ini`, and imported routing tree `identifier`).

### Operations

The following table lists the operations for the singleton `Config` resource:

| Method | Summary                                                                                             | URI                                                                                       |
| ------ | --------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| GET    | [Get external Alertmanager sync configuration](#get-external-alertmanager-sync-configuration)       | `/apis/notifications.alerting.grafana.app/v1beta1/namespaces/{namespace}/configs/default` |
| PUT    | [Update external Alertmanager sync configuration](#update-external-alertmanager-sync-configuration) | `/apis/notifications.alerting.grafana.app/v1beta1/namespaces/{namespace}/configs/default` |

#### Get external Alertmanager sync configuration

`GET /apis/notifications.alerting.grafana.app/v1beta1/namespaces/{namespace}/configs/default`

Retrieves the organization's `Config` singleton, including current sync status in `status`.

#### Update external Alertmanager sync configuration

`PUT /apis/notifications.alerting.grafana.app/v1beta1/namespaces/{namespace}/configs/default`

Updates `spec.externalAlertmanagerSync.datasourceUid` on the `default` `Config` singleton (you can also use `PATCH`). Users can't create other `Config` names with `POST` or delete `configs/default` with `DELETE`.

### Details

Updating `spec.externalAlertmanagerSync.datasourceUid` requires the `alertingSyncExternalAlertmanager` feature toggle to be enabled and the `unified_alerting.external_alertmanager_uid` setting in `grafana.ini` to be unset (when set in `grafana.ini`, the operator override takes precedence and API writes are rejected).

## Status codes

Notification endpoints return the following status codes:

- **200:** `OK` (get, list, update, patch, delete, or test)
- **201:** Created
- **400:** Bad request (invalid JSON, invalid resource name or matcher syntax, or invalid configuration)
- **401:** Unauthorized
- **403:** Access denied (missing RBAC permission or provenance permission)
- **404:** Resource not found
- **409:** Conflict (`metadata.name` already exists, `metadata.resourceVersion` mismatch, or resource is referenced by active policies or rules)
- **422:** Schema validation error

## Migrate from the legacy Alerting Provisioning API

Together with the [Alert rules HTTP API](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/developer-resources/api-reference/http-api/alert-rules/), this API partially replaces the legacy [Alerting Provisioning HTTP API](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/developer-resources/api-reference/http-api/api-legacy/alerting_provisioning/). Specifically, this API replaces the contact points, notification policies, template groups, and mute timings CRUD endpoints, and adds support for staged Alertmanager configurations, named routing trees, inhibition rules, and receiver testing.

The following table shows how the legacy notification endpoints map to `notifications.alerting.grafana.app/v1beta1`:

| Legacy endpoint                                   | New endpoint                                                                                                  |
| ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| `GET /api/v1/provisioning/contact-points`         | `GET /apis/notifications.alerting.grafana.app/v1beta1/namespaces/{namespace}/receivers`                       |
| `POST /api/v1/provisioning/contact-points`        | `POST /apis/notifications.alerting.grafana.app/v1beta1/namespaces/{namespace}/receivers`                      |
| `PUT /api/v1/provisioning/contact-points/:uid`    | `PUT /apis/notifications.alerting.grafana.app/v1beta1/namespaces/{namespace}/receivers/{name}`                |
| `DELETE /api/v1/provisioning/contact-points/:uid` | `DELETE /apis/notifications.alerting.grafana.app/v1beta1/namespaces/{namespace}/receivers/{name}`             |
| `GET /api/v1/provisioning/policies`               | `GET /apis/notifications.alerting.grafana.app/v1beta1/namespaces/{namespace}/routingtrees/user-defined`       |
| `PUT /api/v1/provisioning/policies`               | `PUT /apis/notifications.alerting.grafana.app/v1beta1/namespaces/{namespace}/routingtrees/user-defined`       |
| `DELETE /api/v1/provisioning/policies`            | `DELETE /apis/notifications.alerting.grafana.app/v1beta1/namespaces/{namespace}/routingtrees/user-defined`    |
| `GET /api/v1/provisioning/templates`              | `GET /apis/notifications.alerting.grafana.app/v1beta1/namespaces/{namespace}/templategroups`                  |
| `GET /api/v1/provisioning/templates/:name`        | `GET /apis/notifications.alerting.grafana.app/v1beta1/namespaces/{namespace}/templategroups/{name}`           |
| `PUT /api/v1/provisioning/templates/:name`        | `POST` or `PUT /apis/notifications.alerting.grafana.app/v1beta1/namespaces/{namespace}/templategroups/{name}` |
| `DELETE /api/v1/provisioning/templates/:name`     | `DELETE /apis/notifications.alerting.grafana.app/v1beta1/namespaces/{namespace}/templategroups/{name}`        |
| `GET /api/v1/provisioning/mute-timings`           | `GET /apis/notifications.alerting.grafana.app/v1beta1/namespaces/{namespace}/timeintervals`                   |
| `GET /api/v1/provisioning/mute-timings/:name`     | `GET /apis/notifications.alerting.grafana.app/v1beta1/namespaces/{namespace}/timeintervals/{name}`            |
| `POST /api/v1/provisioning/mute-timings`          | `POST /apis/notifications.alerting.grafana.app/v1beta1/namespaces/{namespace}/timeintervals`                  |
| `PUT /api/v1/provisioning/mute-timings/:name`     | `PUT /apis/notifications.alerting.grafana.app/v1beta1/namespaces/{namespace}/timeintervals/{name}`            |
| `DELETE /api/v1/provisioning/mute-timings/:name`  | `DELETE /apis/notifications.alerting.grafana.app/v1beta1/namespaces/{namespace}/timeintervals/{name}`         |
| `GET /api/v1/provisioning/*/export`               | No equivalent in this API; file-provisioning export remains on the legacy API                                 |
| `POST /api/access-control/receivers/:uid/*`       | No equivalent in this API; receiver access-control permissions remain on `/api/access-control/receivers/*`    |

When you migrate, consider the following differences:

- **Contact point structure:** The legacy API creates or updates one `EmbeddedContactPoint` integration per request and groups integrations that share the same `name`. In `notifications.alerting.grafana.app/v1beta1`, a `Receiver` resource contains all of the contact point's integrations in `spec.integrations`, addressed by the contact point's `metadata.name`.
- **Staged Alertmanager configurations:** Unlike the legacy provisioning endpoints, this API returns and manages resources from staged Alertmanager configurations (such as imported Alertmanager configurations).
- **Routing trees:** The root notification policy is the `user-defined` `RoutingTree` resource (with `default` accepted as an alias), and you can also manage separate named routing trees.
- **Provenance:** Instead of sending the `X-Disable-Provenance` request header, set `metadata.annotations["grafana.com/provenance"]` to `"api"` when you want a resource locked from UI edits.
- **Alert rules:** Alert rules and recording rules are managed through the [Alert rules HTTP API](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/developer-resources/api-reference/http-api/alert-rules/).

## Related resources

Use the following resources to keep working with Grafana Alerting APIs:

- **Alert rules HTTP API:** Refer to [Alert rules HTTP API](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/developer-resources/api-reference/http-api/alert-rules/).
- **Alert enrichment HTTP API:** Refer to [Alert enrichment HTTP API](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/developer-resources/api-reference/http-api/alert-enrichment/).
- **Configure notifications:** Refer to [Configure notifications](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/alerting/configure-notifications/).
- **API structure:** Refer to [API structure in Grafana](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/developer-resources/api-reference/http-api/apis/).
