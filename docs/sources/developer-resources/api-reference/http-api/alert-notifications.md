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

The following table lists the main endpoints. Each standard resource (`receivers`, `routingtrees`, `templategroups`, `timeintervals`, `inhibitionrules`) supports `GET` (list and get by `{name}`), `POST` (create), `PUT` (replace), `PATCH` (partial update), `DELETE` (delete by `{name}`), and `POST /.../search`. For full request and response schemas, refer to [Swagger](https://play.grafana.org/swagger?api=notifications.alerting.grafana.app-v1beta1).

| Method | Summary                                                                             | URI                                                                                              |
| ------ | ----------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| GET    | [List receivers](#receivers-contact-points)                                         | `/apis/notifications.alerting.grafana.app/v1beta1/namespaces/{namespace}/receivers`              |
| POST   | [Create a receiver](#create-a-receiver)                                             | `/apis/notifications.alerting.grafana.app/v1beta1/namespaces/{namespace}/receivers`              |
| GET    | [Get a receiver](#receivers-contact-points)                                         | `/apis/notifications.alerting.grafana.app/v1beta1/namespaces/{namespace}/receivers/{name}`       |
| PUT    | [Update a receiver](#receivers-contact-points)                                      | `/apis/notifications.alerting.grafana.app/v1beta1/namespaces/{namespace}/receivers/{name}`       |
| DELETE | [Delete a receiver](#receivers-contact-points)                                      | `/apis/notifications.alerting.grafana.app/v1beta1/namespaces/{namespace}/receivers/{name}`       |
| POST   | [Test a receiver integration](#test-a-receiver-integration)                         | `/apis/notifications.alerting.grafana.app/v1beta1/namespaces/{namespace}/receivers/{name}/test`  |
| GET    | [List integration type schemas](#receivers-contact-points)                          | `/apis/notifications.alerting.grafana.app/v1beta1/namespaces/{namespace}/integrationtypeschemas` |
| GET    | [List routing trees](#routing-trees-notification-policies)                          | `/apis/notifications.alerting.grafana.app/v1beta1/namespaces/{namespace}/routingtrees`           |
| POST   | [Create a named routing tree](#routing-trees-notification-policies)                 | `/apis/notifications.alerting.grafana.app/v1beta1/namespaces/{namespace}/routingtrees`           |
| GET    | [Get a routing tree](#routing-trees-notification-policies)                          | `/apis/notifications.alerting.grafana.app/v1beta1/namespaces/{namespace}/routingtrees/{name}`    |
| PUT    | [Update a routing tree](#update-the-default-routing-tree)                           | `/apis/notifications.alerting.grafana.app/v1beta1/namespaces/{namespace}/routingtrees/{name}`    |
| DELETE | [Delete a routing tree](#routing-trees-notification-policies)                       | `/apis/notifications.alerting.grafana.app/v1beta1/namespaces/{namespace}/routingtrees/{name}`    |
| GET    | [List template groups](#template-groups)                                            | `/apis/notifications.alerting.grafana.app/v1beta1/namespaces/{namespace}/templategroups`         |
| POST   | [Create a template group](#template-groups)                                         | `/apis/notifications.alerting.grafana.app/v1beta1/namespaces/{namespace}/templategroups`         |
| GET    | [Get, update, or delete a template group](#template-groups)                         | `/apis/notifications.alerting.grafana.app/v1beta1/namespaces/{namespace}/templategroups/{name}`  |
| GET    | [List time intervals](#time-intervals-mute-timings)                                 | `/apis/notifications.alerting.grafana.app/v1beta1/namespaces/{namespace}/timeintervals`          |
| POST   | [Create a time interval](#time-intervals-mute-timings)                              | `/apis/notifications.alerting.grafana.app/v1beta1/namespaces/{namespace}/timeintervals`          |
| GET    | [Get, update, or delete a time interval](#time-intervals-mute-timings)              | `/apis/notifications.alerting.grafana.app/v1beta1/namespaces/{namespace}/timeintervals/{name}`   |
| GET    | [List inhibition rules](#inhibition-rules)                                          | `/apis/notifications.alerting.grafana.app/v1beta1/namespaces/{namespace}/inhibitionrules`        |
| POST   | [Create an inhibition rule](#inhibition-rules)                                      | `/apis/notifications.alerting.grafana.app/v1beta1/namespaces/{namespace}/inhibitionrules`        |
| GET    | [Get, update, or delete an inhibition rule](#inhibition-rules)                      | `/apis/notifications.alerting.grafana.app/v1beta1/namespaces/{namespace}/inhibitionrules/{name}` |
| GET    | [Get external Alertmanager sync configuration](#alertmanager-sync-configuration)    | `/apis/notifications.alerting.grafana.app/v1beta1/namespaces/{namespace}/configs/default`        |
| PUT    | [Update external Alertmanager sync configuration](#alertmanager-sync-configuration) | `/apis/notifications.alerting.grafana.app/v1beta1/namespaces/{namespace}/configs/default`        |

## Receivers (contact points)

A `Receiver` resource represents a contact point and groups all of its notifier integrations (such as email, Slack, PagerDuty, or webhook) into `spec.integrations`.

- **`metadata.name`:** Optional on create (must be a lowercase DNS-compatible UID if supplied; otherwise Grafana generates one). Identifies the receiver in URL paths, while `spec.title` is the contact point name referenced by routing trees and alert rules.
- **`spec.title`:** Required. Display name of the contact point.
- **`spec.integrations`:** Required array of integrations. Each item specifies `type` (for example, `email`, `slack`, `webhook`), `version` (for example, `1`), `settings`, optional `disableResolveMessage`, and read-only `secureFields` indicating which keys in `settings` are stored encrypted.

To discover supported integration `type` values, versions, and required `settings` fields on your instance, send `GET /apis/notifications.alerting.grafana.app/v1beta1/namespaces/{namespace}/integrationtypeschemas`.

### Create a receiver

`POST /apis/notifications.alerting.grafana.app/v1beta1/namespaces/{namespace}/receivers`

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

### Test a receiver integration

`POST /apis/notifications.alerting.grafana.app/v1beta1/namespaces/{namespace}/receivers/{name}/test`

Sends a test alert notification through one integration. Use an existing receiver's `metadata.name` as `{name}` to test a saved integration (referencing `integration.uid` if reusing stored secrets), or pass `-` as `{name}` to test a new receiver integration before saving it.

The request body contains `integration` (`type`, `version`, `settings`) and `alert` (`labels` and `annotations`). The `200 OK` response reports `status` (`success` or `failure`), `duration`, and an optional `error` message.

## Routing trees (notification policies)

A `RoutingTree` resource defines a notification policy tree: default grouping and timing settings in `spec.defaults`, and nested matcher-based child policies in `spec.routes`.

- **Default policy tree:** Addressed by `metadata.name` set to `user-defined` (Grafana also accepts `default` as an alias in requests). Every organization has a default routing tree; update it with `PUT` or `PATCH`, or reset it with `DELETE`.
- **Named routing trees:** Create additional routing trees with `POST /routingtrees` so alert rules can route to them directly with `notificationSettings.type: "NamedRoutingTree"`. `user-defined` and `default` are reserved and can't be used as custom tree names.

### Update the default routing tree

`PUT /apis/notifications.alerting.grafana.app/v1beta1/namespaces/{namespace}/routingtrees/user-defined`

Retrieve the current `RoutingTree` first to obtain its `metadata.resourceVersion`, then send the updated tree:

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

## Template groups

A `TemplateGroup` resource (`templategroups`) stores reusable Go notification templates:

- **`spec.title`:** Required. Display name of the template group.
- **`spec.content`:** Required. Notification template definitions in Go template syntax (`{{ define "..." }}...{{ end }}`).
- **`spec.kind`:** Template kind: `grafana` (default) or `mimir`.

The following example creates a template group:

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

## Time intervals (mute timings)

A `TimeInterval` resource (`timeintervals`) defines recurring schedules that you can reference as `mute_time_intervals` or `active_time_intervals` in routing trees and simplified routing:

- **`spec.name`:** Required. Name referenced by routing policies and alert rules.
- **`spec.time_intervals`:** Required array of schedule intervals. Each entry can specify `times` (`start_time` and `end_time` in `HH:MM`), `weekdays` (for example, `saturday`, `sunday`, or `monday:friday`), `days_of_month`, `months`, `years`, and IANA `location` (for example, `UTC` or `America/New_York`).

The following example creates a weekend time interval:

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

## Inhibition rules

An `InhibitionRule` resource (`inhibitionrules`) suppresses notifications for target alerts while a matching source alert is firing:

- **`spec.source_matchers`:** Matchers (`label`, `type`, `value`, where `type` is `=`, `!=`, `=~`, or `!~`) identifying firing alerts that inhibit other alerts.
- **`spec.target_matchers`:** Matchers identifying alerts to suppress.
- **`spec.equal`:** Label names that must have identical values on both the source and target alerts for inhibition to apply.

The following example creates an inhibition rule that suppresses `warning` alerts when a `critical` alert is firing for the same `cluster`:

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

## Alertmanager sync configuration

The `Config` resource (`configs/default`) is a per-organization singleton for administrative notification settings. Users can't create other `Config` names or delete `default`.

When the `alertingSyncExternalAlertmanager` feature toggle is enabled (and the `unified_alerting.external_alertmanager_uid` setting isn't locked in `grafana.ini`), administrators can set `spec.externalAlertmanagerSync.datasourceUid` via `PUT` or `PATCH` on `/apis/notifications.alerting.grafana.app/v1beta1/namespaces/{namespace}/configs/default` to periodically sync Alertmanager configuration from a Mimir or Cortex Alertmanager data source. Sync status is reported in `status.conditions` and `status.externalAlertmanagerSync`.

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
