---
aliases:
  - ../../http_api/alerting_provisioning/
canonical: /docs/grafana/latest/developers/http_api/alerting_provisioning/
description: Grafana Alerts HTTP API
keywords:
  - grafana
  - http
  - documentation
  - api
  - alerting
  - alerts
title: 'Alerting Provisioning HTTP API '
---

# Alerting provisioning API

## Information

### Version

1.1.0

## Content negotiation

### Consumes

- application/json

### Produces

- application/json
- text/yaml
- application/yaml

## All endpoints

### Alert rules

| Method | URI                                                                | Name                                                                    | Summary                                                 |
| ------ | ------------------------------------------------------------------ | ----------------------------------------------------------------------- | ------------------------------------------------------- |
| DELETE | /api/v1/provisioning/alert-rules/{UID}                             | [route delete alert rule](#route-delete-alert-rule)                     | Delete a specific alert rule by UID.                    |
| GET    | /api/v1/provisioning/alert-rules/{UID}                             | [route get alert rule](#route-get-alert-rule)                           | Get a specific alert rule by UID.                       |
| GET    | /api/v1/provisioning/alert-rules/{UID}/export                      | [route get alert rule export](#route-get-alert-rule-export)             | Export an alert rule in provisioning file format.       |
| GET    | /api/v1/provisioning/folder/{FolderUID}/rule-groups/{Group}        | [route get alert rule group](#route-get-alert-rule-group)               | Get a rule group.                                       |
| GET    | /api/v1/provisioning/folder/{FolderUID}/rule-groups/{Group}/export | [route get alert rule group export](#route-get-alert-rule-group-export) | Export an alert rule group in provisioning file format. |
| GET    | /api/v1/provisioning/alert-rules                                   | [route get alert rules](#route-get-alert-rules)                         | Get all the alert rules.                                |
| GET    | /api/v1/provisioning/alert-rules/export                            | [route get alert rules export](#route-get-alert-rules-export)           | Export all alert rules in provisioning file format.     |
| POST   | /api/v1/provisioning/alert-rules                                   | [route post alert rule](#route-post-alert-rule)                         | Create a new alert rule.                                |
| PUT    | /api/v1/provisioning/alert-rules/{UID}                             | [route put alert rule](#route-put-alert-rule)                           | Update an existing alert rule.                          |
| PUT    | /api/v1/provisioning/folder/{FolderUID}/rule-groups/{Group}        | [route put alert rule group](#route-put-alert-rule-group)               | Update the interval of a rule group.                    |

### Contact points

| Method | URI                                       | Name                                                      | Summary                           |
| ------ | ----------------------------------------- | --------------------------------------------------------- | --------------------------------- |
| DELETE | /api/v1/provisioning/contact-points/{UID} | [route delete contactpoints](#route-delete-contactpoints) | Delete a contact point.           |
| GET    | /api/v1/provisioning/contact-points       | [route get contactpoints](#route-get-contactpoints)       | Get all the contact points.       |
| POST   | /api/v1/provisioning/contact-points       | [route post contactpoints](#route-post-contactpoints)     | Create a contact point.           |
| PUT    | /api/v1/provisioning/contact-points/{UID} | [route put contactpoint](#route-put-contactpoint)         | Update an existing contact point. |

### Notification policies

| Method | URI                           | Name                                                | Summary                              |
| ------ | ----------------------------- | --------------------------------------------------- | ------------------------------------ |
| DELETE | /api/v1/provisioning/policies | [route reset policy tree](#route-reset-policy-tree) | Clears the notification policy tree. |
| GET    | /api/v1/provisioning/policies | [route get policy tree](#route-get-policy-tree)     | Get the notification policy tree.    |
| PUT    | /api/v1/provisioning/policies | [route put policy tree](#route-put-policy-tree)     | Sets the notification policy tree.   |

### Mute timings

| Method | URI                                      | Name                                                  | Summary                          |
| ------ | ---------------------------------------- | ----------------------------------------------------- | -------------------------------- |
| DELETE | /api/v1/provisioning/mute-timings/{name} | [route delete mute timing](#route-delete-mute-timing) | Delete a mute timing.            |
| GET    | /api/v1/provisioning/mute-timings/{name} | [route get mute timing](#route-get-mute-timing)       | Get a mute timing.               |
| GET    | /api/v1/provisioning/mute-timings        | [route get mute timings](#route-get-mute-timings)     | Get all the mute timings.        |
| POST   | /api/v1/provisioning/mute-timings        | [route post mute timing](#route-post-mute-timing)     | Create a new mute timing.        |
| PUT    | /api/v1/provisioning/mute-timings/{name} | [route put mute timing](#route-put-mute-timing)       | Replace an existing mute timing. |

### Templates

| Method | URI                                   | Name                                            | Summary                                    |
| ------ | ------------------------------------- | ----------------------------------------------- | ------------------------------------------ |
| DELETE | /api/v1/provisioning/templates/{name} | [route delete template](#route-delete-template) | Delete a template.                         |
| GET    | /api/v1/provisioning/templates/{name} | [route get template](#route-get-template)       | Get a notification template.               |
| GET    | /api/v1/provisioning/templates        | [route get templates](#route-get-templates)     | Get all notification templates.            |
| PUT    | /api/v1/provisioning/templates/{name} | [route put template](#route-put-template)       | Updates an existing notification template. |

## Paths

### <span id="route-delete-alert-rule"></span> Delete a specific alert rule by UID. (_RouteDeleteAlertRule_)

```
DELETE /api/v1/provisioning/alert-rules/{UID}
```

#### Parameters

| Name | Source | Type   | Go type  | Separator | Required | Default | Description    |
| ---- | ------ | ------ | -------- | --------- | :------: | ------- | -------------- |
| UID  | `path` | string | `string` |           |    ✓     |         | Alert rule UID |

#### All responses

| Code                                | Status     | Description                              | Has headers | Schema                                        |
| ----------------------------------- | ---------- | ---------------------------------------- | :---------: | --------------------------------------------- |
| [204](#route-delete-alert-rule-204) | No Content | The alert rule was deleted successfully. |             | [schema](#route-delete-alert-rule-204-schema) |

#### Responses

##### <span id="route-delete-alert-rule-204"></span> 204 - The alert rule was deleted successfully.

Status: No Content

###### <span id="route-delete-alert-rule-204-schema"></span> Schema

### <span id="route-delete-contactpoints"></span> Delete a contact point. (_RouteDeleteContactpoints_)

```
DELETE /api/v1/provisioning/contact-points/{UID}
```

#### Consumes

- application/json

#### Parameters

| Name | Source | Type   | Go type  | Separator | Required | Default | Description                                |
| ---- | ------ | ------ | -------- | --------- | :------: | ------- | ------------------------------------------ |
| UID  | `path` | string | `string` |           |    ✓     |         | UID is the contact point unique identifier |

#### All responses

| Code                                   | Status     | Description                                 | Has headers | Schema                                           |
| -------------------------------------- | ---------- | ------------------------------------------- | :---------: | ------------------------------------------------ |
| [204](#route-delete-contactpoints-204) | No Content | The contact point was deleted successfully. |             | [schema](#route-delete-contactpoints-204-schema) |

#### Responses

##### <span id="route-delete-contactpoints-204"></span> 204 - The contact point was deleted successfully.

Status: No Content

###### <span id="route-delete-contactpoints-204-schema"></span> Schema

### <span id="route-delete-mute-timing"></span> Delete a mute timing. (_RouteDeleteMuteTiming_)

```
DELETE /api/v1/provisioning/mute-timings/{name}
```

#### Parameters

| Name | Source | Type   | Go type  | Separator | Required | Default | Description      |
| ---- | ------ | ------ | -------- | --------- | :------: | ------- | ---------------- |
| name | `path` | string | `string` |           |    ✓     |         | Mute timing name |

#### All responses

| Code                                 | Status     | Description                               | Has headers | Schema                                         |
| ------------------------------------ | ---------- | ----------------------------------------- | :---------: | ---------------------------------------------- |
| [204](#route-delete-mute-timing-204) | No Content | The mute timing was deleted successfully. |             | [schema](#route-delete-mute-timing-204-schema) |

#### Responses

##### <span id="route-delete-mute-timing-204"></span> 204 - The mute timing was deleted successfully.

Status: No Content

###### <span id="route-delete-mute-timing-204-schema"></span> Schema

### <span id="route-delete-template"></span> Delete a template. (_RouteDeleteTemplate_)

```
DELETE /api/v1/provisioning/templates/{name}
```

#### Parameters

| Name | Source | Type   | Go type  | Separator | Required | Default | Description   |
| ---- | ------ | ------ | -------- | --------- | :------: | ------- | ------------- |
| name | `path` | string | `string` |           |    ✓     |         | Template Name |

#### All responses

| Code                              | Status     | Description                            | Has headers | Schema                                      |
| --------------------------------- | ---------- | -------------------------------------- | :---------: | ------------------------------------------- |
| [204](#route-delete-template-204) | No Content | The template was deleted successfully. |             | [schema](#route-delete-template-204-schema) |

#### Responses

##### <span id="route-delete-template-204"></span> 204 - The template was deleted successfully.

Status: No Content

###### <span id="route-delete-template-204-schema"></span> Schema

### <span id="route-get-alert-rule"></span> Get a specific alert rule by UID. (_RouteGetAlertRule_)

```
GET /api/v1/provisioning/alert-rules/{UID}
```

#### Parameters

| Name | Source | Type   | Go type  | Separator | Required | Default | Description    |
| ---- | ------ | ------ | -------- | --------- | :------: | ------- | -------------- |
| UID  | `path` | string | `string` |           |    ✓     |         | Alert rule UID |

#### All responses

| Code                             | Status    | Description          | Has headers | Schema                                     |
| -------------------------------- | --------- | -------------------- | :---------: | ------------------------------------------ |
| [200](#route-get-alert-rule-200) | OK        | ProvisionedAlertRule |             | [schema](#route-get-alert-rule-200-schema) |
| [404](#route-get-alert-rule-404) | Not Found | Not found.           |             | [schema](#route-get-alert-rule-404-schema) |

#### Responses

##### <span id="route-get-alert-rule-200"></span> 200 - ProvisionedAlertRule

Status: OK

###### <span id="route-get-alert-rule-200-schema"></span> Schema

[ProvisionedAlertRule](#provisioned-alert-rule)

##### <span id="route-get-alert-rule-404"></span> 404 - Not found.

Status: Not Found

###### <span id="route-get-alert-rule-404-schema"></span> Schema

### <span id="route-get-alert-rule-export"></span> Export an alert rule in provisioning file format. (_RouteGetAlertRuleExport_)

```
GET /api/v1/provisioning/alert-rules/{UID}/export
```

#### Produces

- application/json
- application/yaml
- text/yaml

#### Parameters

| Name     | Source  | Type     | Go type  | Separator | Required | Default  | Description                                                                                                                       |
| -------- | ------- | -------- | -------- | --------- | :------: | -------- | --------------------------------------------------------------------------------------------------------------------------------- |
| UID      | `path`  | string   | `string` |           |    ✓     |          | Alert rule UID                                                                                                                    |
| download | `query` | boolean  | `bool`   |           |          |          | Whether to initiate a download of the file or not.                                                                                |
| format   | `query` | `string` | string   |           |          | `"yaml"` | Format of the downloaded file, either yaml or json. Accept header can also be used, but the query parameter will take precedence. |

#### All responses

| Code                                    | Status    | Description        | Has headers | Schema                                            |
| --------------------------------------- | --------- | ------------------ | :---------: | ------------------------------------------------- |
| [200](#route-get-alert-rule-export-200) | OK        | AlertingFileExport |             | [schema](#route-get-alert-rule-export-200-schema) |
| [404](#route-get-alert-rule-export-404) | Not Found | Not found.         |             | [schema](#route-get-alert-rule-export-404-schema) |

#### Responses

##### <span id="route-get-alert-rule-export-200"></span> 200 - AlertingFileExport

Status: OK

###### <span id="route-get-alert-rule-export-200-schema"></span> Schema

[AlertingFileExport](#alerting-file-export)

##### <span id="route-get-alert-rule-export-404"></span> 404 - Not found.

Status: Not Found

###### <span id="route-get-alert-rule-export-404-schema"></span> Schema

### <span id="route-get-alert-rule-group"></span> Get a rule group. (_RouteGetAlertRuleGroup_)

```
GET /api/v1/provisioning/folder/{FolderUID}/rule-groups/{Group}
```

#### Parameters

| Name      | Source | Type   | Go type  | Separator | Required | Default | Description |
| --------- | ------ | ------ | -------- | --------- | :------: | ------- | ----------- |
| FolderUID | `path` | string | `string` |           |    ✓     |         |             |
| Group     | `path` | string | `string` |           |    ✓     |         |             |

#### All responses

| Code                                   | Status    | Description    | Has headers | Schema                                           |
| -------------------------------------- | --------- | -------------- | :---------: | ------------------------------------------------ |
| [200](#route-get-alert-rule-group-200) | OK        | AlertRuleGroup |             | [schema](#route-get-alert-rule-group-200-schema) |
| [404](#route-get-alert-rule-group-404) | Not Found | Not found.     |             | [schema](#route-get-alert-rule-group-404-schema) |

#### Responses

##### <span id="route-get-alert-rule-group-200"></span> 200 - AlertRuleGroup

Status: OK

###### <span id="route-get-alert-rule-group-200-schema"></span> Schema

[AlertRuleGroup](#alert-rule-group)

##### <span id="route-get-alert-rule-group-404"></span> 404 - Not found.

Status: Not Found

###### <span id="route-get-alert-rule-group-404-schema"></span> Schema

### <span id="route-get-alert-rule-group-export"></span> Export an alert rule group in provisioning file format. (_RouteGetAlertRuleGroupExport_)

```
GET /api/v1/provisioning/folder/{FolderUID}/rule-groups/{Group}/export
```

#### Produces

- application/json
- application/yaml
- text/yaml

#### Parameters

| Name      | Source  | Type     | Go type  | Separator | Required | Default  | Description                                                                                                                       |
| --------- | ------- | -------- | -------- | --------- | :------: | -------- | --------------------------------------------------------------------------------------------------------------------------------- |
| FolderUID | `path`  | string   | `string` |           |    ✓     |          |                                                                                                                                   |
| Group     | `path`  | string   | `string` |           |    ✓     |          |                                                                                                                                   |
| download  | `query` | boolean  | `bool`   |           |          |          | Whether to initiate a download of the file or not.                                                                                |
| format    | `query` | `string` | string   |           |          | `"yaml"` | Format of the downloaded file, either yaml or json. Accept header can also be used, but the query parameter will take precedence. |

#### All responses

| Code                                          | Status    | Description        | Has headers | Schema                                                  |
| --------------------------------------------- | --------- | ------------------ | :---------: | ------------------------------------------------------- |
| [200](#route-get-alert-rule-group-export-200) | OK        | AlertingFileExport |             | [schema](#route-get-alert-rule-group-export-200-schema) |
| [404](#route-get-alert-rule-group-export-404) | Not Found | Not found.         |             | [schema](#route-get-alert-rule-group-export-404-schema) |

#### Responses

##### <span id="route-get-alert-rule-group-export-200"></span> 200 - AlertingFileExport

Status: OK

###### <span id="route-get-alert-rule-group-export-200-schema"></span> Schema

[AlertingFileExport](#alerting-file-export)

##### <span id="route-get-alert-rule-group-export-404"></span> 404 - Not found.

Status: Not Found

###### <span id="route-get-alert-rule-group-export-404-schema"></span> Schema

### <span id="route-get-alert-rules"></span> Get all the alert rules. (_RouteGetAlertRules_)

```
GET /api/v1/provisioning/alert-rules
```

#### All responses

| Code                              | Status | Description           | Has headers | Schema                                      |
| --------------------------------- | ------ | --------------------- | :---------: | ------------------------------------------- |
| [200](#route-get-alert-rules-200) | OK     | ProvisionedAlertRules |             | [schema](#route-get-alert-rules-200-schema) |

#### Responses

##### <span id="route-get-alert-rules-200"></span> 200 - ProvisionedAlertRules

Status: OK

###### <span id="route-get-alert-rules-200-schema"></span> Schema

[ProvisionedAlertRules](#provisioned-alert-rules)

### <span id="route-get-alert-rules-export"></span> Export all alert rules in provisioning file format. (_RouteGetAlertRulesExport_)

```
GET /api/v1/provisioning/alert-rules/export
```

#### Parameters

| Name     | Source  | Type     | Go type | Separator | Required | Default  | Description                                                                                                                       |
| -------- | ------- | -------- | ------- | --------- | :------: | -------- | --------------------------------------------------------------------------------------------------------------------------------- |
| download | `query` | boolean  | `bool`  |           |          |          | Whether to initiate a download of the file or not.                                                                                |
| format   | `query` | `string` | string  |           |          | `"yaml"` | Format of the downloaded file, either yaml or json. Accept header can also be used, but the query parameter will take precedence. |

#### All responses

| Code                                     | Status    | Description        | Has headers | Schema                                             |
| ---------------------------------------- | --------- | ------------------ | :---------: | -------------------------------------------------- |
| [200](#route-get-alert-rules-export-200) | OK        | AlertingFileExport |             | [schema](#route-get-alert-rules-export-200-schema) |
| [404](#route-get-alert-rules-export-404) | Not Found | Not found.         |             | [schema](#route-get-alert-rules-export-404-schema) |

#### Responses

##### <span id="route-get-alert-rules-export-200"></span> 200 - AlertingFileExport

Status: OK

###### <span id="route-get-alert-rules-export-200-schema"></span> Schema

[AlertingFileExport](#alerting-file-export)

##### <span id="route-get-alert-rules-export-404"></span> 404 - Not found.

Status: Not Found

###### <span id="route-get-alert-rules-export-404-schema"></span> Schema

### <span id="route-get-contactpoints"></span> Get all the contact points. (_RouteGetContactpoints_)

```
GET /api/v1/provisioning/contact-points
```

#### Parameters

| Name | Source  | Type   | Go type  | Separator | Required | Default | Description    |
| ---- | ------- | ------ | -------- | --------- | :------: | ------- | -------------- |
| name | `query` | string | `string` |           |          |         | Filter by name |

#### All responses

| Code                                | Status | Description   | Has headers | Schema                                        |
| ----------------------------------- | ------ | ------------- | :---------: | --------------------------------------------- |
| [200](#route-get-contactpoints-200) | OK     | ContactPoints |             | [schema](#route-get-contactpoints-200-schema) |

#### Responses

##### <span id="route-get-contactpoints-200"></span> 200 - ContactPoints

Status: OK

###### <span id="route-get-contactpoints-200-schema"></span> Schema

[ContactPoints](#contact-points)

### <span id="route-get-mute-timing"></span> Get a mute timing. (_RouteGetMuteTiming_)

```
GET /api/v1/provisioning/mute-timings/{name}
```

#### Parameters

| Name | Source | Type   | Go type  | Separator | Required | Default | Description      |
| ---- | ------ | ------ | -------- | --------- | :------: | ------- | ---------------- |
| name | `path` | string | `string` |           |    ✓     |         | Mute timing name |

#### All responses

| Code                              | Status    | Description      | Has headers | Schema                                      |
| --------------------------------- | --------- | ---------------- | :---------: | ------------------------------------------- |
| [200](#route-get-mute-timing-200) | OK        | MuteTimeInterval |             | [schema](#route-get-mute-timing-200-schema) |
| [404](#route-get-mute-timing-404) | Not Found | Not found.       |             | [schema](#route-get-mute-timing-404-schema) |

#### Responses

##### <span id="route-get-mute-timing-200"></span> 200 - MuteTimeInterval

Status: OK

###### <span id="route-get-mute-timing-200-schema"></span> Schema

[MuteTimeInterval](#mute-time-interval)

##### <span id="route-get-mute-timing-404"></span> 404 - Not found.

Status: Not Found

###### <span id="route-get-mute-timing-404-schema"></span> Schema

### <span id="route-get-mute-timings"></span> Get all the mute timings. (_RouteGetMuteTimings_)

```
GET /api/v1/provisioning/mute-timings
```

#### All responses

| Code                               | Status | Description | Has headers | Schema                                       |
| ---------------------------------- | ------ | ----------- | :---------: | -------------------------------------------- |
| [200](#route-get-mute-timings-200) | OK     | MuteTimings |             | [schema](#route-get-mute-timings-200-schema) |

#### Responses

##### <span id="route-get-mute-timings-200"></span> 200 - MuteTimings

Status: OK

###### <span id="route-get-mute-timings-200-schema"></span> Schema

[MuteTimings](#mute-timings)

### <span id="route-get-policy-tree"></span> Get the notification policy tree. (_RouteGetPolicyTree_)

```
GET /api/v1/provisioning/policies
```

#### All responses

| Code                              | Status | Description | Has headers | Schema                                      |
| --------------------------------- | ------ | ----------- | :---------: | ------------------------------------------- |
| [200](#route-get-policy-tree-200) | OK     | Route       |             | [schema](#route-get-policy-tree-200-schema) |

#### Responses

##### <span id="route-get-policy-tree-200"></span> 200 - Route

Status: OK

###### <span id="route-get-policy-tree-200-schema"></span> Schema

[Route](#route)

### <span id="route-get-template"></span> Get a notification template. (_RouteGetTemplate_)

```
GET /api/v1/provisioning/templates/{name}
```

#### Parameters

| Name | Source | Type   | Go type  | Separator | Required | Default | Description   |
| ---- | ------ | ------ | -------- | --------- | :------: | ------- | ------------- |
| name | `path` | string | `string` |           |    ✓     |         | Template Name |

#### All responses

| Code                           | Status    | Description          | Has headers | Schema                                   |
| ------------------------------ | --------- | -------------------- | :---------: | ---------------------------------------- |
| [200](#route-get-template-200) | OK        | NotificationTemplate |             | [schema](#route-get-template-200-schema) |
| [404](#route-get-template-404) | Not Found | Not found.           |             | [schema](#route-get-template-404-schema) |

#### Responses

##### <span id="route-get-template-200"></span> 200 - NotificationTemplate

Status: OK

###### <span id="route-get-template-200-schema"></span> Schema

[NotificationTemplate](#notification-template)

##### <span id="route-get-template-404"></span> 404 - Not found.

Status: Not Found

###### <span id="route-get-template-404-schema"></span> Schema

### <span id="route-get-templates"></span> Get all notification templates. (_RouteGetTemplates_)

```
GET /api/v1/provisioning/templates
```

#### All responses

| Code                            | Status    | Description           | Has headers | Schema                                    |
| ------------------------------- | --------- | --------------------- | :---------: | ----------------------------------------- |
| [200](#route-get-templates-200) | OK        | NotificationTemplates |             | [schema](#route-get-templates-200-schema) |
| [404](#route-get-templates-404) | Not Found | Not found.            |             | [schema](#route-get-templates-404-schema) |

#### Responses

##### <span id="route-get-templates-200"></span> 200 - NotificationTemplates

Status: OK

###### <span id="route-get-templates-200-schema"></span> Schema

[NotificationTemplates](#notification-templates)

##### <span id="route-get-templates-404"></span> 404 - Not found.

Status: Not Found

###### <span id="route-get-templates-404-schema"></span> Schema

### <span id="route-post-alert-rule"></span> Create a new alert rule. (_RoutePostAlertRule_)

```
POST /api/v1/provisioning/alert-rules
```

#### Consumes

- application/json

#### Parameters

| Name                 | Source   | Type                                            | Go type                       | Separator | Required | Default | Description |
| -------------------- | -------- | ----------------------------------------------- | ----------------------------- | --------- | :------: | ------- | ----------- |
| X-Disable-Provenance | `header` | string                                          | `string`                      |           |          |         |             |
| Body                 | `body`   | [ProvisionedAlertRule](#provisioned-alert-rule) | `models.ProvisionedAlertRule` |           |          |         |             |

#### All responses

| Code                              | Status      | Description          | Has headers | Schema                                      |
| --------------------------------- | ----------- | -------------------- | :---------: | ------------------------------------------- |
| [201](#route-post-alert-rule-201) | Created     | ProvisionedAlertRule |             | [schema](#route-post-alert-rule-201-schema) |
| [400](#route-post-alert-rule-400) | Bad Request | ValidationError      |             | [schema](#route-post-alert-rule-400-schema) |

#### Responses

##### <span id="route-post-alert-rule-201"></span> 201 - ProvisionedAlertRule

Status: Created

###### <span id="route-post-alert-rule-201-schema"></span> Schema

[ProvisionedAlertRule](#provisioned-alert-rule)

##### <span id="route-post-alert-rule-400"></span> 400 - ValidationError

Status: Bad Request

###### <span id="route-post-alert-rule-400-schema"></span> Schema

[ValidationError](#validation-error)

### <span id="route-post-contactpoints"></span> Create a contact point. (_RoutePostContactpoints_)

```
POST /api/v1/provisioning/contact-points
```

#### Consumes

- application/json

#### Parameters

| Name | Source | Type                                            | Go type                       | Separator | Required | Default | Description |
| ---- | ------ | ----------------------------------------------- | ----------------------------- | --------- | :------: | ------- | ----------- |
| Body | `body` | [EmbeddedContactPoint](#embedded-contact-point) | `models.EmbeddedContactPoint` |           |          |         |             |

#### All responses

| Code                                 | Status      | Description          | Has headers | Schema                                         |
| ------------------------------------ | ----------- | -------------------- | :---------: | ---------------------------------------------- |
| [202](#route-post-contactpoints-202) | Accepted    | EmbeddedContactPoint |             | [schema](#route-post-contactpoints-202-schema) |
| [400](#route-post-contactpoints-400) | Bad Request | ValidationError      |             | [schema](#route-post-contactpoints-400-schema) |

#### Responses

##### <span id="route-post-contactpoints-202"></span> 202 - EmbeddedContactPoint

Status: Accepted

###### <span id="route-post-contactpoints-202-schema"></span> Schema

[EmbeddedContactPoint](#embedded-contact-point)

##### <span id="route-post-contactpoints-400"></span> 400 - ValidationError

Status: Bad Request

###### <span id="route-post-contactpoints-400-schema"></span> Schema

[ValidationError](#validation-error)

### <span id="route-post-mute-timing"></span> Create a new mute timing. (_RoutePostMuteTiming_)

```
POST /api/v1/provisioning/mute-timings
```

#### Consumes

- application/json

#### Parameters

| Name | Source | Type                                    | Go type                   | Separator | Required | Default | Description |
| ---- | ------ | --------------------------------------- | ------------------------- | --------- | :------: | ------- | ----------- |
| Body | `body` | [MuteTimeInterval](#mute-time-interval) | `models.MuteTimeInterval` |           |          |         |             |

#### All responses

| Code                               | Status      | Description      | Has headers | Schema                                       |
| ---------------------------------- | ----------- | ---------------- | :---------: | -------------------------------------------- |
| [201](#route-post-mute-timing-201) | Created     | MuteTimeInterval |             | [schema](#route-post-mute-timing-201-schema) |
| [400](#route-post-mute-timing-400) | Bad Request | ValidationError  |             | [schema](#route-post-mute-timing-400-schema) |

#### Responses

##### <span id="route-post-mute-timing-201"></span> 201 - MuteTimeInterval

Status: Created

###### <span id="route-post-mute-timing-201-schema"></span> Schema

[MuteTimeInterval](#mute-time-interval)

##### <span id="route-post-mute-timing-400"></span> 400 - ValidationError

Status: Bad Request

###### <span id="route-post-mute-timing-400-schema"></span> Schema

[ValidationError](#validation-error)

### <span id="route-put-alert-rule"></span> Update an existing alert rule. (_RoutePutAlertRule_)

```
PUT /api/v1/provisioning/alert-rules/{UID}
```

#### Consumes

- application/json

#### Parameters

| Name                 | Source   | Type                                            | Go type                       | Separator | Required | Default | Description    |
| -------------------- | -------- | ----------------------------------------------- | ----------------------------- | --------- | :------: | ------- | -------------- |
| UID                  | `path`   | string                                          | `string`                      |           |    ✓     |         | Alert rule UID |
| X-Disable-Provenance | `header` | string                                          | `string`                      |           |          |         |                |
| Body                 | `body`   | [ProvisionedAlertRule](#provisioned-alert-rule) | `models.ProvisionedAlertRule` |           |          |         |                |

#### All responses

| Code                             | Status      | Description          | Has headers | Schema                                     |
| -------------------------------- | ----------- | -------------------- | :---------: | ------------------------------------------ |
| [200](#route-put-alert-rule-200) | OK          | ProvisionedAlertRule |             | [schema](#route-put-alert-rule-200-schema) |
| [400](#route-put-alert-rule-400) | Bad Request | ValidationError      |             | [schema](#route-put-alert-rule-400-schema) |

#### Responses

##### <span id="route-put-alert-rule-200"></span> 200 - ProvisionedAlertRule

Status: OK

###### <span id="route-put-alert-rule-200-schema"></span> Schema

[ProvisionedAlertRule](#provisioned-alert-rule)

##### <span id="route-put-alert-rule-400"></span> 400 - ValidationError

Status: Bad Request

###### <span id="route-put-alert-rule-400-schema"></span> Schema

[ValidationError](#validation-error)

### <span id="route-put-alert-rule-group"></span> Update the interval of a rule group. (_RoutePutAlertRuleGroup_)

```
PUT /api/v1/provisioning/folder/{FolderUID}/rule-groups/{Group}
```

#### Consumes

- application/json

#### Parameters

| Name      | Source | Type                                | Go type                 | Separator | Required | Default | Description |
| --------- | ------ | ----------------------------------- | ----------------------- | --------- | :------: | ------- | ----------- |
| FolderUID | `path` | string                              | `string`                |           |    ✓     |         |             |
| Group     | `path` | string                              | `string`                |           |    ✓     |         |             |
| Body      | `body` | [AlertRuleGroup](#alert-rule-group) | `models.AlertRuleGroup` |           |          |         |             |

#### All responses

| Code                                   | Status      | Description     | Has headers | Schema                                           |
| -------------------------------------- | ----------- | --------------- | :---------: | ------------------------------------------------ |
| [200](#route-put-alert-rule-group-200) | OK          | AlertRuleGroup  |             | [schema](#route-put-alert-rule-group-200-schema) |
| [400](#route-put-alert-rule-group-400) | Bad Request | ValidationError |             | [schema](#route-put-alert-rule-group-400-schema) |

#### Responses

##### <span id="route-put-alert-rule-group-200"></span> 200 - AlertRuleGroup

Status: OK

###### <span id="route-put-alert-rule-group-200-schema"></span> Schema

[AlertRuleGroup](#alert-rule-group)

##### <span id="route-put-alert-rule-group-400"></span> 400 - ValidationError

Status: Bad Request

###### <span id="route-put-alert-rule-group-400-schema"></span> Schema

[ValidationError](#validation-error)

### <span id="route-put-contactpoint"></span> Update an existing contact point. (_RoutePutContactpoint_)

```
PUT /api/v1/provisioning/contact-points/{UID}
```

#### Consumes

- application/json

#### Parameters

| Name | Source | Type                                            | Go type                       | Separator | Required | Default | Description                                |
| ---- | ------ | ----------------------------------------------- | ----------------------------- | --------- | :------: | ------- | ------------------------------------------ |
| UID  | `path` | string                                          | `string`                      |           |    ✓     |         | UID is the contact point unique identifier |
| Body | `body` | [EmbeddedContactPoint](#embedded-contact-point) | `models.EmbeddedContactPoint` |           |          |         |                                            |

#### All responses

| Code                               | Status      | Description     | Has headers | Schema                                       |
| ---------------------------------- | ----------- | --------------- | :---------: | -------------------------------------------- |
| [202](#route-put-contactpoint-202) | Accepted    | Ack             |             | [schema](#route-put-contactpoint-202-schema) |
| [400](#route-put-contactpoint-400) | Bad Request | ValidationError |             | [schema](#route-put-contactpoint-400-schema) |

#### Responses

##### <span id="route-put-contactpoint-202"></span> 202 - Ack

Status: Accepted

###### <span id="route-put-contactpoint-202-schema"></span> Schema

[Ack](#ack)

##### <span id="route-put-contactpoint-400"></span> 400 - ValidationError

Status: Bad Request

###### <span id="route-put-contactpoint-400-schema"></span> Schema

[ValidationError](#validation-error)

### <span id="route-put-mute-timing"></span> Replace an existing mute timing. (_RoutePutMuteTiming_)

```
PUT /api/v1/provisioning/mute-timings/{name}
```

#### Consumes

- application/json

#### Parameters

| Name | Source | Type                                    | Go type                   | Separator | Required | Default | Description      |
| ---- | ------ | --------------------------------------- | ------------------------- | --------- | :------: | ------- | ---------------- |
| name | `path` | string                                  | `string`                  |           |    ✓     |         | Mute timing name |
| Body | `body` | [MuteTimeInterval](#mute-time-interval) | `models.MuteTimeInterval` |           |          |         |                  |

#### All responses

| Code                              | Status      | Description      | Has headers | Schema                                      |
| --------------------------------- | ----------- | ---------------- | :---------: | ------------------------------------------- |
| [200](#route-put-mute-timing-200) | OK          | MuteTimeInterval |             | [schema](#route-put-mute-timing-200-schema) |
| [400](#route-put-mute-timing-400) | Bad Request | ValidationError  |             | [schema](#route-put-mute-timing-400-schema) |

#### Responses

##### <span id="route-put-mute-timing-200"></span> 200 - MuteTimeInterval

Status: OK

###### <span id="route-put-mute-timing-200-schema"></span> Schema

[MuteTimeInterval](#mute-time-interval)

##### <span id="route-put-mute-timing-400"></span> 400 - ValidationError

Status: Bad Request

###### <span id="route-put-mute-timing-400-schema"></span> Schema

[ValidationError](#validation-error)

### <span id="route-put-policy-tree"></span> Sets the notification policy tree. (_RoutePutPolicyTree_)

```
PUT /api/v1/provisioning/policies
```

#### Consumes

- application/json

#### Parameters

| Name | Source | Type            | Go type        | Separator | Required | Default | Description                              |
| ---- | ------ | --------------- | -------------- | --------- | :------: | ------- | ---------------------------------------- |
| Body | `body` | [Route](#route) | `models.Route` |           |          |         | The new notification routing tree to use |

#### All responses

| Code                              | Status      | Description     | Has headers | Schema                                      |
| --------------------------------- | ----------- | --------------- | :---------: | ------------------------------------------- |
| [202](#route-put-policy-tree-202) | Accepted    | Ack             |             | [schema](#route-put-policy-tree-202-schema) |
| [400](#route-put-policy-tree-400) | Bad Request | ValidationError |             | [schema](#route-put-policy-tree-400-schema) |

#### Responses

##### <span id="route-put-policy-tree-202"></span> 202 - Ack

Status: Accepted

###### <span id="route-put-policy-tree-202-schema"></span> Schema

[Ack](#ack)

##### <span id="route-put-policy-tree-400"></span> 400 - ValidationError

Status: Bad Request

###### <span id="route-put-policy-tree-400-schema"></span> Schema

[ValidationError](#validation-error)

### <span id="route-put-template"></span> Updates an existing notification template. (_RoutePutTemplate_)

```
PUT /api/v1/provisioning/templates/{name}
```

#### Consumes

- application/json

#### Parameters

| Name | Source | Type                                                          | Go type                              | Separator | Required | Default | Description   |
| ---- | ------ | ------------------------------------------------------------- | ------------------------------------ | --------- | :------: | ------- | ------------- |
| name | `path` | string                                                        | `string`                             |           |    ✓     |         | Template Name |
| Body | `body` | [NotificationTemplateContent](#notification-template-content) | `models.NotificationTemplateContent` |           |          |         |               |

#### All responses

| Code                           | Status      | Description          | Has headers | Schema                                   |
| ------------------------------ | ----------- | -------------------- | :---------: | ---------------------------------------- |
| [202](#route-put-template-202) | Accepted    | NotificationTemplate |             | [schema](#route-put-template-202-schema) |
| [400](#route-put-template-400) | Bad Request | ValidationError      |             | [schema](#route-put-template-400-schema) |

#### Responses

##### <span id="route-put-template-202"></span> 202 - NotificationTemplate

Status: Accepted

###### <span id="route-put-template-202-schema"></span> Schema

[NotificationTemplate](#notification-template)

##### <span id="route-put-template-400"></span> 400 - ValidationError

Status: Bad Request

###### <span id="route-put-template-400-schema"></span> Schema

[ValidationError](#validation-error)

### <span id="route-reset-policy-tree"></span> Clears the notification policy tree. (_RouteResetPolicyTree_)

```
DELETE /api/v1/provisioning/policies
```

#### Consumes

- application/json

#### All responses

| Code                                | Status   | Description | Has headers | Schema                                        |
| ----------------------------------- | -------- | ----------- | :---------: | --------------------------------------------- |
| [202](#route-reset-policy-tree-202) | Accepted | Ack         |             | [schema](#route-reset-policy-tree-202-schema) |

#### Responses

##### <span id="route-reset-policy-tree-202"></span> 202 - Ack

Status: Accepted

###### <span id="route-reset-policy-tree-202-schema"></span> Schema

[Ack](#ack)

## Models

### <span id="ack"></span> Ack

[interface{}](#interface)

### <span id="alert-query"></span> AlertQuery

**Properties**

| Name                                                      | Type                                      | Go type             | Required | Default | Description                                                                                            | Example |
| --------------------------------------------------------- | ----------------------------------------- | ------------------- | :------: | ------- | ------------------------------------------------------------------------------------------------------ | ------- |
| datasourceUid                                             | string                                    | `string`            |          |         | Grafana data source unique identifier; it should be '**expr**' for a Server Side Expression operation. |         |
| model                                                     | [interface{}](#interface)                 | `interface{}`       |          |         | JSON is the raw JSON query and includes the above properties as well as custom properties.             |         |
| queryType                                                 | string                                    | `string`            |          |         | QueryType is an optional identifier for the type of query.                                             |
| It can be used to distinguish different types of queries. |                                           |
| refId                                                     | string                                    | `string`            |          |         | RefID is the unique identifier of the query, set by the frontend call.                                 |         |
| relativeTimeRange                                         | [RelativeTimeRange](#relative-time-range) | `RelativeTimeRange` |          |         |                                                                                                        |         |

### <span id="alert-query-export"></span> AlertQueryExport

**Properties**

| Name              | Type                                      | Go type             | Required | Default | Description | Example |
| ----------------- | ----------------------------------------- | ------------------- | :------: | ------- | ----------- | ------- |
| datasourceUid     | string                                    | `string`            |          |         |             |         |
| model             | [interface{}](#interface)                 | `interface{}`       |          |         |             |         |
| queryType         | string                                    | `string`            |          |         |             |         |
| refId             | string                                    | `string`            |          |         |             |         |
| relativeTimeRange | [RelativeTimeRange](#relative-time-range) | `RelativeTimeRange` |          |         |             |         |

### <span id="alert-rule-export"></span> AlertRuleExport

**Properties**

| Name         | Type                                      | Go type               | Required | Default | Description | Example |
| ------------ | ----------------------------------------- | --------------------- | :------: | ------- | ----------- | ------- |
| annotations  | map of string                             | `map[string]string`   |          |         |             |         |
| condition    | string                                    | `string`              |          |         |             |         |
| dasboardUid  | string                                    | `string`              |          |         |             |         |
| data         | [][alertqueryexport](#alert-query-export) | `[]*AlertQueryExport` |          |         |             |         |
| execErrState | string                                    | `string`              |          |         |             |         |
| for          | [Duration](#duration)                     | `Duration`            |          |         |             |         |
| labels       | map of string                             | `map[string]string`   |          |         |             |         |
| noDataState  | string                                    | `string`              |          |         |             |         |
| panelId      | int64 (formatted integer)                 | `int64`               |          |         |             |         |
| title        | string                                    | `string`              |          |         |             |         |
| uid          | string                                    | `string`              |          |         |             |         |

### <span id="alert-rule-group"></span> AlertRuleGroup

**Properties**

| Name      | Type                                              | Go type                   | Required | Default | Description | Example |
| --------- | ------------------------------------------------- | ------------------------- | :------: | ------- | ----------- | ------- |
| folderUid | string                                            | `string`                  |          |         |             |         |
| interval  | int64 (formatted integer)                         | `int64`                   |          |         |             |         |
| rules     | [][provisionedalertrule](#provisioned-alert-rule) | `[]*ProvisionedAlertRule` |          |         |             |         |
| title     | string                                            | `string`                  |          |         |             |         |

### <span id="alert-rule-group-export"></span> AlertRuleGroupExport

**Properties**

| Name     | Type                                    | Go type              | Required | Default | Description | Example |
| -------- | --------------------------------------- | -------------------- | :------: | ------- | ----------- | ------- |
| folder   | string                                  | `string`             |          |         |             |         |
| interval | [Duration](#duration)                   | `Duration`           |          |         |             |         |
| name     | string                                  | `string`             |          |         |             |         |
| orgId    | int64 (formatted integer)               | `int64`              |          |         |             |         |
| rules    | [][alertruleexport](#alert-rule-export) | `[]*AlertRuleExport` |          |         |             |         |

### <span id="alerting-file-export"></span> AlertingFileExport

**Properties**

| Name       | Type                                               | Go type                   | Required | Default | Description | Example |
| ---------- | -------------------------------------------------- | ------------------------- | :------: | ------- | ----------- | ------- |
| apiVersion | int64 (formatted integer)                          | `int64`                   |          |         |             |         |
| groups     | [][alertrulegroupexport](#alert-rule-group-export) | `[]*AlertRuleGroupExport` |          |         |             |         |

### <span id="contact-points"></span> ContactPoints

[][embeddedcontactpoint](#embedded-contact-point)

### <span id="duration"></span> Duration

| Name     | Type                      | Go type | Default | Description | Example |
| -------- | ------------------------- | ------- | ------- | ----------- | ------- |
| Duration | int64 (formatted integer) | int64   |         |             |         |

### <span id="embedded-contact-point"></span> EmbeddedContactPoint

> EmbeddedContactPoint is the contact point type that is used
> by grafanas embedded alertmanager implementation.

**Properties**

| Name                                 | Type                    | Go type  | Required | Default | Description                                                       | Example   |
| ------------------------------------ | ----------------------- | -------- | :------: | ------- | ----------------------------------------------------------------- | --------- |
| disableResolveMessage                | boolean                 | `bool`   |          |         |                                                                   | `false`   |
| name                                 | string                  | `string` |          |         | Name is used as grouping key in the UI. Contact points with the   |
| same name will be grouped in the UI. | `webhook_1`             |
| provenance                           | string                  | `string` |          |         |                                                                   |           |
| settings                             | [JSON](#json)           | `JSON`   |    ✓     |         |                                                                   |           |
| type                                 | string                  | `string` |    ✓     |         |                                                                   | `webhook` |
| uid                                  | string                  | `string` |          |         | UID is the unique identifier of the contact point. The UID can be |
| set by the user.                     | `my_external_reference` |

### <span id="json"></span> Json

[interface{}](#interface)

### <span id="match-regexps"></span> MatchRegexps

[MatchRegexps](#match-regexps)

### <span id="match-type"></span> MatchType

| Name      | Type                      | Go type | Default | Description | Example |
| --------- | ------------------------- | ------- | ------- | ----------- | ------- |
| MatchType | int64 (formatted integer) | int64   |         |             |         |

### <span id="matcher"></span> Matcher

**Properties**

| Name  | Type                     | Go type     | Required | Default | Description | Example |
| ----- | ------------------------ | ----------- | :------: | ------- | ----------- | ------- |
| Name  | string                   | `string`    |          |         |             |         |
| Type  | [MatchType](#match-type) | `MatchType` |          |         |             |         |
| Value | string                   | `string`    |          |         |             |         |

### <span id="matchers"></span> Matchers

> Matchers is a slice of Matchers that is sortable, implements Stringer, and
> provides a Matches method to match a LabelSet against all Matchers in the
> slice. Note that some users of Matchers might require it to be sorted.

[][matcher](#matcher)

### <span id="mute-time-interval"></span> MuteTimeInterval

**Properties**

| Name           | Type                             | Go type           | Required | Default | Description | Example |
| -------------- | -------------------------------- | ----------------- | :------: | ------- | ----------- | ------- |
| name           | string                           | `string`          |          |         |             |         |
| time_intervals | [][timeinterval](#time-interval) | `[]*TimeInterval` |          |         |             |         |

### <span id="mute-timings"></span> MuteTimings

[][mutetimeinterval](#mute-time-interval)

### <span id="notification-template"></span> NotificationTemplate

**Properties**

| Name       | Type                      | Go type      | Required | Default | Description | Example |
| ---------- | ------------------------- | ------------ | :------: | ------- | ----------- | ------- |
| name       | string                    | `string`     |          |         |             |         |
| provenance | [Provenance](#provenance) | `Provenance` |          |         |             |         |
| template   | string                    | `string`     |          |         |             |         |

### <span id="notification-template-content"></span> NotificationTemplateContent

**Properties**

| Name     | Type   | Go type  | Required | Default | Description | Example |
| -------- | ------ | -------- | :------: | ------- | ----------- | ------- |
| template | string | `string` |          |         |             |         |

### <span id="notification-templates"></span> NotificationTemplates

[][notificationtemplate](#notification-template)

### <span id="object-matchers"></span> ObjectMatchers

[Matchers](#matchers)

#### Inlined models

### <span id="provenance"></span> Provenance

| Name       | Type   | Go type | Default | Description | Example |
| ---------- | ------ | ------- | ------- | ----------- | ------- |
| Provenance | string | string  |         |             |         |

### <span id="provisioned-alert-rule"></span> ProvisionedAlertRule

**Properties**

| Name         | Type                         | Go type             | Required | Default | Description | Example                                                                                                                                                                                                                                                                                                                                                                                                                          |
| ------------ | ---------------------------- | ------------------- | :------: | ------- | ----------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| annotations  | map of string                | `map[string]string` |          |         |             | `{"runbook_url":"https://supercoolrunbook.com/page/13"}`                                                                                                                                                                                                                                                                                                                                                                         |
| condition    | string                       | `string`            |    ✓     |         |             | `A`                                                                                                                                                                                                                                                                                                                                                                                                                              |
| data         | [][alertquery](#alert-query) | `[]*AlertQuery`     |    ✓     |         |             | `[{"datasourceUid":"__expr__","model":{"conditions":[{"evaluator":{"params":[0,0],"type":"gt"},"operator":{"type":"and"},"query":{"params":[]},"reducer":{"params":[],"type":"avg"},"type":"query"}],"datasource":{"type":"__expr__","uid":"__expr__"},"expression":"1 == 1","hide":false,"intervalMs":1000,"maxDataPoints":43200,"refId":"A","type":"math"},"queryType":"","refId":"A","relativeTimeRange":{"from":0,"to":0}}]` |
| execErrState | string                       | `string`            |    ✓     |         |             |                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| folderUID    | string                       | `string`            |    ✓     |         |             | `project_x`                                                                                                                                                                                                                                                                                                                                                                                                                      |
| for          | [Duration](#duration)        | `Duration`          |    ✓     |         |             |                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| id           | int64 (formatted integer)    | `int64`             |          |         |             |                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| labels       | map of string                | `map[string]string` |          |         |             | `{"team":"sre-team-1"}`                                                                                                                                                                                                                                                                                                                                                                                                          |
| noDataState  | string                       | `string`            |    ✓     |         |             |                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| orgID        | int64 (formatted integer)    | `int64`             |    ✓     |         |             |                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| provenance   | [Provenance](#provenance)    | `Provenance`        |          |         |             |                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| ruleGroup    | string                       | `string`            |    ✓     |         |             | `eval_group_1`                                                                                                                                                                                                                                                                                                                                                                                                                   |
| title        | string                       | `string`            |    ✓     |         |             | `Always firing`                                                                                                                                                                                                                                                                                                                                                                                                                  |
| uid          | string                       | `string`            |          |         |             |                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| updated      | date-time (formatted string) | `strfmt.DateTime`   |          |         |             |                                                                                                                                                                                                                                                                                                                                                                                                                                  |

### <span id="provisioned-alert-rules"></span> ProvisionedAlertRules

[][provisionedalertrule](#provisioned-alert-rule)

### <span id="regexp"></span> Regexp

> A Regexp is safe for concurrent use by multiple goroutines,
> except for configuration methods, such as Longest.

[interface{}](#interface)

### <span id="relative-time-range"></span> RelativeTimeRange

> RelativeTimeRange is the per query start and end time
> for requests.

**Properties**

| Name | Type                  | Go type    | Required | Default | Description | Example |
| ---- | --------------------- | ---------- | :------: | ------- | ----------- | ------- |
| from | [Duration](#duration) | `Duration` |          |         |             |         |
| to   | [Duration](#duration) | `Duration` |          |         |             |         |

### <span id="route"></span> Route

> A Route is a node that contains definitions of how to handle alerts. This is modified
> from the upstream alertmanager in that it adds the ObjectMatchers property.

**Properties**

| Name                | Type                               | Go type             | Required | Default | Description                             | Example |
| ------------------- | ---------------------------------- | ------------------- | :------: | ------- | --------------------------------------- | ------- |
| continue            | boolean                            | `bool`              |          |         |                                         |         |
| group_by            | []string                           | `[]string`          |          |         |                                         |         |
| group_interval      | string                             | `string`            |          |         |                                         |         |
| group_wait          | string                             | `string`            |          |         |                                         |         |
| match               | map of string                      | `map[string]string` |          |         | Deprecated. Remove before v1.0 release. |         |
| match_re            | [MatchRegexps](#match-regexps)     | `MatchRegexps`      |          |         |                                         |         |
| matchers            | [Matchers](#matchers)              | `Matchers`          |          |         |                                         |         |
| mute_time_intervals | []string                           | `[]string`          |          |         |                                         |         |
| object_matchers     | [ObjectMatchers](#object-matchers) | `ObjectMatchers`    |          |         |                                         |         |
| provenance          | [Provenance](#provenance)          | `Provenance`        |          |         |                                         |         |
| receiver            | string                             | `string`            |          |         |                                         |         |
| repeat_interval     | string                             | `string`            |          |         |                                         |         |
| routes              | [][route](#route)                  | `[]*Route`          |          |         |                                         |         |

### <span id="time-interval"></span> TimeInterval

> TimeInterval describes intervals of time. ContainsTime will tell you if a golang time is contained
> within the interval.

**Properties**

| Name          | Type                       | Go type        | Required | Default | Description | Example |
| ------------- | -------------------------- | -------------- | :------: | ------- | ----------- | ------- |
| days_of_month | []string                   | `[]string`     |          |         |             |         |
| location      | string                     | `string`       |          |         |             |         |
| months        | []string                   | `[]string`     |          |         |             |         |
| times         | [][timerange](#time-range) | `[]*TimeRange` |          |         |             |         |
| weekdays      | []string                   | `[]string`     |          |         |             |         |
| years         | []string                   | `[]string`     |          |         |             |         |

### <span id="time-range"></span> TimeRange

> For example, 4:00PM to End of the day would Begin at 1020 and End at 1440.

**Properties**

| Name        | Type                      | Go type | Required | Default | Description | Example |
| ----------- | ------------------------- | ------- | :------: | ------- | ----------- | ------- |
| EndMinute   | int64 (formatted integer) | `int64` |          |         |             |         |
| StartMinute | int64 (formatted integer) | `int64` |          |         |             |         |

### <span id="validation-error"></span> ValidationError

**Properties**

| Name | Type   | Go type  | Required | Default | Description | Example         |
| ---- | ------ | -------- | :------: | ------- | ----------- | --------------- |
| msg  | string | `string` |          |         |             | `error message` |
