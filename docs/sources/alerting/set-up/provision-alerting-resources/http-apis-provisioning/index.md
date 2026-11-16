---
canonical: https://grafana.com/docs/grafana/latest/alerting/set-up/provision-alerting-resources/http-apis-provisioning/
description: Create and manage alerting resources using the new Grafana HTTP APIs (/apis)
keywords:
  - grafana
  - alerting
  - alerting resources
  - provisioning
  - http api
  - apis
labels:
  products:
    - cloud
    - enterprise
    - oss
menuTitle: Use the new HTTP APIs to provision
title: Use the new HTTP APIs to manage alerting resources
weight: 400
---

# Use the new HTTP APIs to manage alerting resources

Use the new Grafana HTTP APIs (`/apis`) to create, update, and delete Grafana-managed alerting resources as standalone, versioned objects. Unlike the legacy [Alerting Provisioning HTTP API](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/alerting/set-up/provision-alerting-resources/http-api-provisioning/), these APIs validate requests against a typed schema, track optimistic concurrency with `metadata.resourceVersion`, and let you manage individual rules without rewriting an entire rule group.

Alerting resources are served across two API groups (plus a Grafana Cloud API group for alert enrichment):

- **`rules.alerting.grafana.app/v1beta1`:** Alert rules, recording rules, and rule sequences. For full schemas and status codes, refer to the [Alert rules HTTP API reference](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/developer-resources/api-reference/http-api/alert-rules/).
- **`notifications.alerting.grafana.app/v1beta1`:** Contact points (`receivers`), notification policy trees (`routingtrees`), notification template groups (`templategroups`), mute timings and active time intervals (`timeintervals`), inhibition rules (`inhibitionrules`), and external Alertmanager sync (`configs`). For full schemas and status codes, refer to the [Alert notifications HTTP API reference](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/developer-resources/api-reference/http-api/alert-notifications/).
- **`alertenrichment.grafana.app/v1beta1` (Grafana Cloud only):** Alert enrichment pipelines (`alert-enrichments`). Refer to the [Alert enrichment HTTP API reference](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/developer-resources/api-reference/http-api/alert-enrichment/).

## Before you begin

Before you begin, ensure you have the following:

- **Grafana Alerting enabled:** Grafana Alerting must be enabled on your instance.
- **Namespace:** Determine your instance's `{namespace}`:
  - **Grafana OSS and Enterprise:** `default` for organization 1, or `org-<ORG_ID>` for other organizations.
  - **Grafana Cloud:** `stacks-<STACK_ID>`.

  For more details, refer to [API structure in Grafana](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/developer-resources/api-reference/http-api/apis/#namespace-namespace).
- **Authentication and permissions:** Authenticate with a [service account token](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/developer-resources/api-reference/http-api/authentication/) (or basic authentication in OSS and Enterprise). By default, **Viewer** grants read access and **Editor** or **Admin** grants write access. For granular role-based access control (RBAC) permissions, refer to [Configure RBAC for Grafana Alerting](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/alerting/set-up/configure-rbac/).
- **A folder for rules:** Alert rules, recording rules, and rule sequences must belong to a folder. Pass the folder UID in `metadata.annotations["grafana.app/folder"]`.

{{< admonition type="note" >}}
The JSON returned by `/apis` endpoints uses the Kubernetes-style resource envelope (`apiVersion`, `kind`, `metadata`, `spec`) and isn't compatible with [provisioning via configuration files](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/alerting/set-up/provision-alerting-resources/file-provisioning/). To export resources in file-provisioning format, continue using the [Export API endpoints](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/alerting/set-up/provision-alerting-resources/export-alerting-resources/#export-api-endpoints) on the legacy API.
{{< /admonition >}}

## Manage rules (`rules.alerting.grafana.app/v1beta1`)

Each rule resource is stored in a folder (`metadata.annotations["grafana.app/folder"]`) and identified in URL paths by `metadata.name` (its rule UID). For complete field definitions and status codes, refer to the [Alert rules HTTP API reference](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/developer-resources/api-reference/http-api/alert-rules/).

| Resource        | Collection URI                                                                   | Item URI                                                                                |
| --------------- | -------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| Alert rules     | `/apis/rules.alerting.grafana.app/v1beta1/namespaces/{namespace}/alertrules`     | `/apis/rules.alerting.grafana.app/v1beta1/namespaces/{namespace}/alertrules/{name}`     |
| Recording rules | `/apis/rules.alerting.grafana.app/v1beta1/namespaces/{namespace}/recordingrules` | `/apis/rules.alerting.grafana.app/v1beta1/namespaces/{namespace}/recordingrules/{name}` |
| Rule sequences  | `/apis/rules.alerting.grafana.app/v1beta1/namespaces/{namespace}/rulesequences`  | `/apis/rules.alerting.grafana.app/v1beta1/namespaces/{namespace}/rulesequences/{name}`  |

All three resources support `GET` (list and get), `POST` (create), `PUT` (replace), `PATCH` (partial update), and `DELETE`.

### Provision an alert rule

Send a `POST` request to `/apis/rules.alerting.grafana.app/v1beta1/namespaces/{namespace}/alertrules` to create an `AlertRule`. Set `"source": true` on the expression node that acts as the alert condition, and specify `notificationSettings.type` (`SimplifiedRouting` or `NamedRoutingTree`) when routing directly from the rule:

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
      "grafana.app/folder": "<FOLDER_UID>",
      "grafana.com/provenance": "api"
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
      "receiver": "On-call webhook"
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

### Provision a recording rule

Recording rules use a dedicated `RecordingRule` resource instead of sharing the alert rule payload. Specify the output metric name in `spec.metric` and the destination Prometheus-compatible data source in `spec.targetDatasourceUID`:

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
      "grafana.app/folder": "<FOLDER_UID>",
      "grafana.com/provenance": "api"
    }
  },
  "spec": {
    "title": "Service request rate",
    "metric": "job:http_requests_total:rate5m",
    "targetDatasourceUID": "<TARGET_DATASOURCE_UID>",
    "trigger": {
      "interval": "1m"
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

### Order rule evaluation with rule sequences

Because each rule is managed independently rather than inside a rule group payload, use a `RuleSequence` resource when a recording rule or alert rule depends on the output of another recording rule in the same folder. For details, refer to [Configure rule sequences](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/alerting/alerting-rules/rule-sequences/) and [Rule sequences in the Alert rules HTTP API](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/developer-resources/api-reference/http-api/alert-rules/#rule-sequences).

## Manage notification resources (`notifications.alerting.grafana.app/v1beta1`)

Notification resources are scoped to `{namespace}` (not to folders) and return resources from both active and staged Alertmanager configurations. For complete field definitions and status codes, refer to the [Alert notifications HTTP API reference](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/developer-resources/api-reference/http-api/alert-notifications/).

| Resource                                       | Collection URI                                                                            | Item URI                                                                                         |
| ---------------------------------------------- | ----------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| Contact points (`Receiver`)                    | `/apis/notifications.alerting.grafana.app/v1beta1/namespaces/{namespace}/receivers`       | `/apis/notifications.alerting.grafana.app/v1beta1/namespaces/{namespace}/receivers/{name}`       |
| Notification policy trees (`RoutingTree`)      | `/apis/notifications.alerting.grafana.app/v1beta1/namespaces/{namespace}/routingtrees`    | `/apis/notifications.alerting.grafana.app/v1beta1/namespaces/{namespace}/routingtrees/{name}`    |
| Notification template groups (`TemplateGroup`) | `/apis/notifications.alerting.grafana.app/v1beta1/namespaces/{namespace}/templategroups`  | `/apis/notifications.alerting.grafana.app/v1beta1/namespaces/{namespace}/templategroups/{name}`  |
| Mute timings and intervals (`TimeInterval`)    | `/apis/notifications.alerting.grafana.app/v1beta1/namespaces/{namespace}/timeintervals`   | `/apis/notifications.alerting.grafana.app/v1beta1/namespaces/{namespace}/timeintervals/{name}`   |
| Inhibition rules (`InhibitionRule`)            | `/apis/notifications.alerting.grafana.app/v1beta1/namespaces/{namespace}/inhibitionrules` | `/apis/notifications.alerting.grafana.app/v1beta1/namespaces/{namespace}/inhibitionrules/{name}` |

{{< admonition type="note" >}}
To manage access-control permissions on individual contact points for users, teams, or built-in roles, continue using the `/api/access-control/receivers/*` endpoints documented in [Receiver permissions](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/alerting/set-up/provision-alerting-resources/http-api-provisioning/#receiver-permissions).
{{< /admonition >}}

### Contact points

A `Receiver` resource groups all integrations for a contact point into `spec.integrations`. To inspect supported integration `type` values and required `settings` fields, send `GET /apis/notifications.alerting.grafana.app/v1beta1/namespaces/{namespace}/integrationtypeschemas`.

```http
POST /apis/notifications.alerting.grafana.app/v1beta1/namespaces/default/receivers HTTP/1.1
Accept: application/json
Content-Type: application/json
Authorization: Bearer <SERVICE_ACCOUNT_TOKEN>

{
  "apiVersion": "notifications.alerting.grafana.app/v1beta1",
  "kind": "Receiver",
  "metadata": {
    "name": "oncall-webhook",
    "annotations": {
      "grafana.com/provenance": "api"
    }
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

### Notification policies

The organization's default notification policy tree is a `RoutingTree` resource named `user-defined` (Grafana also accepts `default` as an alias). Retrieve it first with `GET` to obtain its `metadata.resourceVersion`, then update it with `PUT`:

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
    "resourceVersion": "<RESOURCE_VERSION>",
    "annotations": {
      "grafana.com/provenance": "api"
    }
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
        "mute_time_intervals": ["Weekends"],
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

Replace `<RESOURCE_VERSION>` with the `metadata.resourceVersion` from `GET .../routingtrees/user-defined`. You can also create additional named routing trees with `POST /routingtrees` so alert rules can target them directly.

### Notification template groups and mute timings

Create notification template groups with `POST .../templategroups` and mute timings or active time intervals with `POST .../timeintervals`:

```http
POST /apis/notifications.alerting.grafana.app/v1beta1/namespaces/default/timeintervals HTTP/1.1
Accept: application/json
Content-Type: application/json
Authorization: Bearer <SERVICE_ACCOUNT_TOKEN>

{
  "apiVersion": "notifications.alerting.grafana.app/v1beta1",
  "kind": "TimeInterval",
  "metadata": {
    "name": "weekends",
    "annotations": {
      "grafana.com/provenance": "api"
    }
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

## Control editing in the Grafana UI (provenance)

In the `/apis` alerting endpoints, provenance is controlled per resource with the `metadata.annotations["grafana.com/provenance"]` annotation rather than the legacy `X-Disable-Provenance` HTTP header:

- **Lock a resource from UI edits (provisioned):** Set `"grafana.com/provenance": "api"` in `metadata.annotations`. Setting provenance requires provisioning RBAC permissions; refer to [Configure RBAC for Grafana Alerting](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/alerting/set-up/configure-rbac/#provisioning).
- **Allow editing in the Grafana UI:** Omit `grafana.com/provenance` from `metadata.annotations` when creating the resource. Resources created without this annotation remain editable in the Grafana UI.

To reset the default notification policy tree and unlock it for editing in the Grafana UI, send `DELETE /apis/notifications.alerting.grafana.app/v1beta1/namespaces/{namespace}/routingtrees/user-defined`.

## Migrate from the legacy Alerting Provisioning API

If you currently use `/api/v1/provisioning/*` endpoints, refer to the following guides for endpoint mappings and schema differences:

- [Migrate to the new Grafana APIs](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/developer-resources/api-reference/http-api/apis-migration/#alerting-provisioning-api)
- [Alert rules HTTP API migration guide](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/developer-resources/api-reference/http-api/alert-rules/#migrate-from-the-legacy-alerting-provisioning-api)
- [Alert notifications HTTP API migration guide](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/developer-resources/api-reference/http-api/alert-notifications/#migrate-from-the-legacy-alerting-provisioning-api)
