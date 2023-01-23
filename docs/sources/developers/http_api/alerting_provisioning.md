---
aliases:
  - ../../http_api/alerting_provisioning/
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

1.0.0

## Content negotiation

### Consumes

- application/json

### Produces

- application/json

## All endpoints

### Alert rules

| Method | URI                                                         | Name                                                      | Summary                              |
| ------ | ----------------------------------------------------------- | --------------------------------------------------------- | ------------------------------------ |
| GET    | /api/v1/provisioning/alert-rules/{UID}                      | [route get alert rule](#route-get-alert-rule)             | Get a specific alert rule by UID.    |
| POST   | /api/v1/provisioning/alert-rules                            | [route post alert rule](#route-post-alert-rule)           | Create a new alert rule.             |
| PUT    | /api/v1/provisioning/alert-rules/{UID}                      | [route put alert rule](#route-put-alert-rule)             | Update an existing alert rule.       |
| PUT    | /api/v1/provisioning/folder/{FolderUID}/rule-groups/{Group} | [route put alert rule group](#route-put-alert-rule-group) | Update the interval of a rule group. |
| DELETE | /api/v1/provisioning/alert-rules/{UID}                      | [route delete alert rule](#route-delete-alert-rule)       | Delete a specific alert rule by UID. |

### Contact points

| Method | URI                                       | Name                                                      | Summary                           |
| ------ | ----------------------------------------- | --------------------------------------------------------- | --------------------------------- |
| GET    | /api/v1/provisioning/contact-points       | [route get contactpoints](#route-get-contactpoints)       | Get all the contact points.       |
| POST   | /api/v1/provisioning/contact-points       | [route post contactpoints](#route-post-contactpoints)     | Create a contact point.           |
| PUT    | /api/v1/provisioning/contact-points/{UID} | [route put contactpoint](#route-put-contactpoint)         | Update an existing contact point. |
| DELETE | /api/v1/provisioning/contact-points/{UID} | [route delete contactpoints](#route-delete-contactpoints) | Delete a contact point.           |

### Notification policies

| Method | URI                           | Name                                            | Summary                            |
| ------ | ----------------------------- | ----------------------------------------------- | ---------------------------------- |
| GET    | /api/v1/provisioning/policies | [route get policy tree](#route-get-policy-tree) | Get the notification policy tree.  |
| PUT    | /api/v1/provisioning/policies | [route put policy tree](#route-put-policy-tree) | Sets the notification policy tree. |

### Mute timings

| Method | URI                                      | Name                                                  | Summary                          |
| ------ | ---------------------------------------- | ----------------------------------------------------- | -------------------------------- |
| GET    | /api/v1/provisioning/mute-timings        | [route get mute timings](#route-get-mute-timings)     | Get all the mute timings.        |
| GET    | /api/v1/provisioning/mute-timings/{name} | [route get mute timing](#route-get-mute-timing)       | Get a mute timing.               |
| POST   | /api/v1/provisioning/mute-timings        | [route post mute timing](#route-post-mute-timing)     | Create a new mute timing.        |
| PUT    | /api/v1/provisioning/mute-timings/{name} | [route put mute timing](#route-put-mute-timing)       | Replace an existing mute timing. |
| DELETE | /api/v1/provisioning/mute-timings/{name} | [route delete mute timing](#route-delete-mute-timing) | Delete a mute timing.            |

### Templates

| Method | URI                                   | Name                                            | Summary                         |
| ------ | ------------------------------------- | ----------------------------------------------- | ------------------------------- |
| GET    | /api/v1/provisioning/templates        | [route get templates](#route-get-templates)     | Get all notification templates. |
| GET    | /api/v1/provisioning/templates/{name} | [route get template](#route-get-template)       | Get a notification template.    |
| PUT    | /api/v1/provisioning/templates/{name} | [route put template](#route-put-template)       | Creates or updates a template.  |
| DELETE | /api/v1/provisioning/templates/{name} | [route delete template](#route-delete-template) | Delete a template.              |

## Paths

### <span id="route-delete-alert-rule"></span> Delete a specific alert rule by UID. (_RouteDeleteAlertRule_)

```
DELETE /api/v1/provisioning/alert-rules/{UID}
```

#### Parameters

| Name | Source | Type   | Go type  | Separator | Required | Default | Description |
| ---- | ------ | ------ | -------- | --------- | :------: | ------- | ----------- |
| UID  | `path` | string | `string` |           |    ✓     |         |             |

#### All responses

| Code                                | Status      | Description                              | Has headers | Schema                                        |
| ----------------------------------- | ----------- | ---------------------------------------- | :---------: | --------------------------------------------- |
| [204](#route-delete-alert-rule-204) | No Content  | The alert rule was deleted successfully. |             | [schema](#route-delete-alert-rule-204-schema) |
| [400](#route-delete-alert-rule-400) | Bad Request | ValidationError                          |             | [schema](#route-delete-alert-rule-400-schema) |

#### Responses

##### <span id="route-delete-alert-rule-204"></span> 204 - The alert rule was deleted successfully.

Status: No Content

###### <span id="route-delete-alert-rule-204-schema"></span> Schema

##### <span id="route-delete-alert-rule-400"></span> 400 - ValidationError

Status: Bad Request

###### <span id="route-delete-alert-rule-400-schema"></span> Schema

[ValidationError](#validation-error)

### <span id="route-delete-contactpoints"></span> Delete a contact point. (_RouteDeleteContactpoints_)

```
DELETE /api/v1/provisioning/contact-points/{UID}
```

#### Consumes

- application/json

#### Parameters

| Name | Source | Type   | Go type  | Separator | Required | Default | Description                                       |
| ---- | ------ | ------ | -------- | --------- | :------: | ------- | ------------------------------------------------- |
| UID  | `path` | string | `string` |           |    ✓     |         | UID should be the contact point unique identifier |

#### All responses

| Code                                   | Status      | Description     | Has headers | Schema                                           |
| -------------------------------------- | ----------- | --------------- | :---------: | ------------------------------------------------ |
| [202](#route-delete-contactpoints-202) | Accepted    | Ack             |             | [schema](#route-delete-contactpoints-202-schema) |
| [400](#route-delete-contactpoints-400) | Bad Request | ValidationError |             | [schema](#route-delete-contactpoints-400-schema) |

#### Responses

##### <span id="route-delete-contactpoints-202"></span> 202 - Ack

Status: Accepted

###### <span id="route-delete-contactpoints-202-schema"></span> Schema

[Ack](#ack)

##### <span id="route-delete-contactpoints-400"></span> 400 - ValidationError

Status: Bad Request

###### <span id="route-delete-contactpoints-400-schema"></span> Schema

[ValidationError](#validation-error)

### <span id="route-delete-mute-timing"></span> Delete a mute timing. (_RouteDeleteMuteTiming_)

```
DELETE /api/v1/provisioning/mute-timings/{name}
```

#### Parameters

| Name | Source | Type   | Go type  | Separator | Required | Default | Description   |
| ---- | ------ | ------ | -------- | --------- | :------: | ------- | ------------- |
| name | `path` | string | `string` |           |    ✓     |         | Template Name |

#### All responses

| Code                                 | Status     | Description | Has headers | Schema                                         |
| ------------------------------------ | ---------- | ----------- | :---------: | ---------------------------------------------- |
| [204](#route-delete-mute-timing-204) | No Content | Ack         |             | [schema](#route-delete-mute-timing-204-schema) |

#### Responses

##### <span id="route-delete-mute-timing-204"></span> 204 - Ack

Status: No Content

###### <span id="route-delete-mute-timing-204-schema"></span> Schema

[Ack](#ack)

### <span id="route-delete-template"></span> Delete a template. (_RouteDeleteTemplate_)

```
DELETE /api/v1/provisioning/templates/{name}
```

#### Parameters

| Name | Source | Type   | Go type  | Separator | Required | Default | Description   |
| ---- | ------ | ------ | -------- | --------- | :------: | ------- | ------------- |
| name | `path` | string | `string` |           |    ✓     |         | Template Name |

#### All responses

| Code                              | Status     | Description | Has headers | Schema                                      |
| --------------------------------- | ---------- | ----------- | :---------: | ------------------------------------------- |
| [204](#route-delete-template-204) | No Content | Ack         |             | [schema](#route-delete-template-204-schema) |

#### Responses

##### <span id="route-delete-template-204"></span> 204 - Ack

Status: No Content

###### <span id="route-delete-template-204-schema"></span> Schema

[Ack](#ack)

### <span id="route-get-alert-rule"></span> Get a specific alert rule by UID. (_RouteGetAlertRule_)

```
GET /api/v1/provisioning/alert-rules/{UID}
```

#### Parameters

| Name | Source | Type   | Go type  | Separator | Required | Default | Description |
| ---- | ------ | ------ | -------- | --------- | :------: | ------- | ----------- |
| UID  | `path` | string | `string` |           |    ✓     |         |             |

#### All responses

| Code                             | Status      | Description     | Has headers | Schema                                     |
| -------------------------------- | ----------- | --------------- | :---------: | ------------------------------------------ |
| [200](#route-get-alert-rule-200) | OK          | AlertRule       |             | [schema](#route-get-alert-rule-200-schema) |
| [400](#route-get-alert-rule-400) | Bad Request | ValidationError |             | [schema](#route-get-alert-rule-400-schema) |

#### Responses

##### <span id="route-get-alert-rule-200"></span> 200 - AlertRule

Status: OK

###### <span id="route-get-alert-rule-200-schema"></span> Schema

[AlertRule](#alert-rule)

##### <span id="route-get-alert-rule-400"></span> 400 - ValidationError

Status: Bad Request

###### <span id="route-get-alert-rule-400-schema"></span> Schema

[ValidationError](#validation-error)

### <span id="route-get-contactpoints"></span> Get all the contact points. (_RouteGetContactpoints_)

```
GET /api/v1/provisioning/contact-points
```

#### All responses

| Code                                | Status      | Description     | Has headers | Schema                                        |
| ----------------------------------- | ----------- | --------------- | :---------: | --------------------------------------------- |
| [200](#route-get-contactpoints-200) | OK          | Route           |             | [schema](#route-get-contactpoints-200-schema) |
| [400](#route-get-contactpoints-400) | Bad Request | ValidationError |             | [schema](#route-get-contactpoints-400-schema) |

#### Responses

##### <span id="route-get-contactpoints-200"></span> 200 - Route

Status: OK

###### <span id="route-get-contactpoints-200-schema"></span> Schema

[Route](#route)

##### <span id="route-get-contactpoints-400"></span> 400 - ValidationError

Status: Bad Request

###### <span id="route-get-contactpoints-400-schema"></span> Schema

[ValidationError](#validation-error)

### <span id="route-get-mute-timing"></span> Get a mute timing. (_RouteGetMuteTiming_)

```
GET /api/v1/provisioning/mute-timings/{name}
```

#### Parameters

| Name | Source | Type   | Go type  | Separator | Required | Default | Description   |
| ---- | ------ | ------ | -------- | --------- | :------: | ------- | ------------- |
| name | `path` | string | `string` |           |    ✓     |         | Template Name |

#### All responses

| Code                              | Status      | Description      | Has headers | Schema                                      |
| --------------------------------- | ----------- | ---------------- | :---------: | ------------------------------------------- |
| [200](#route-get-mute-timing-200) | OK          | MuteTimeInterval |             | [schema](#route-get-mute-timing-200-schema) |
| [400](#route-get-mute-timing-400) | Bad Request | ValidationError  |             | [schema](#route-get-mute-timing-400-schema) |

#### Responses

##### <span id="route-get-mute-timing-200"></span> 200 - MuteTimeInterval

Status: OK

###### <span id="route-get-mute-timing-200-schema"></span> Schema

[MuteTimeInterval](#mute-time-interval)

##### <span id="route-get-mute-timing-400"></span> 400 - ValidationError

Status: Bad Request

###### <span id="route-get-mute-timing-400-schema"></span> Schema

[ValidationError](#validation-error)

### <span id="route-get-mute-timings"></span> Get all the mute timings. (_RouteGetMuteTimings_)

```
GET /api/v1/provisioning/mute-timings
```

#### All responses

| Code                               | Status      | Description     | Has headers | Schema                                       |
| ---------------------------------- | ----------- | --------------- | :---------: | -------------------------------------------- |
| [200](#route-get-mute-timings-200) | OK          | MuteTimings     |             | [schema](#route-get-mute-timings-200-schema) |
| [400](#route-get-mute-timings-400) | Bad Request | ValidationError |             | [schema](#route-get-mute-timings-400-schema) |

#### Responses

##### <span id="route-get-mute-timings-200"></span> 200 - MuteTimings

Status: OK

###### <span id="route-get-mute-timings-200-schema"></span> Schema

[MuteTimings](#mute-timings)

##### <span id="route-get-mute-timings-400"></span> 400 - ValidationError

Status: Bad Request

###### <span id="route-get-mute-timings-400-schema"></span> Schema

[ValidationError](#validation-error)

### <span id="route-get-policy-tree"></span> Get the notification policy tree. (_RouteGetPolicyTree_)

```
GET /api/v1/provisioning/policies
```

#### All responses

| Code                              | Status      | Description     | Has headers | Schema                                      |
| --------------------------------- | ----------- | --------------- | :---------: | ------------------------------------------- |
| [200](#route-get-policy-tree-200) | OK          | Route           |             | [schema](#route-get-policy-tree-200-schema) |
| [400](#route-get-policy-tree-400) | Bad Request | ValidationError |             | [schema](#route-get-policy-tree-400-schema) |

#### Responses

##### <span id="route-get-policy-tree-200"></span> 200 - Route

Status: OK

###### <span id="route-get-policy-tree-200-schema"></span> Schema

[Route](#route)

##### <span id="route-get-policy-tree-400"></span> 400 - ValidationError

Status: Bad Request

###### <span id="route-get-policy-tree-400-schema"></span> Schema

[ValidationError](#validation-error)

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
| [404](#route-get-template-404) | Not Found | NotFound             |             | [schema](#route-get-template-404-schema) |

#### Responses

##### <span id="route-get-template-200"></span> 200 - NotificationTemplate

Status: OK

###### <span id="route-get-template-200-schema"></span> Schema

[NotificationTemplate](#message-template)

##### <span id="route-get-template-404"></span> 404 - NotFound

Status: Not Found

###### <span id="route-get-template-404-schema"></span> Schema

[NotFound](#not-found)

### <span id="route-get-templates"></span> Get all notification templates. (_RouteGetTemplates_)

```
GET /api/v1/provisioning/templates
```

#### All responses

| Code                            | Status      | Description          | Has headers | Schema                                    |
| ------------------------------- | ----------- | -------------------- | :---------: | ----------------------------------------- |
| [200](#route-get-templates-200) | OK          | NotificationTemplate |             | [schema](#route-get-templates-200-schema) |
| [400](#route-get-templates-400) | Bad Request | ValidationError      |             | [schema](#route-get-templates-400-schema) |

#### Responses

##### <span id="route-get-templates-200"></span> 200 - NotificationTemplate

Status: OK

###### <span id="route-get-templates-200-schema"></span> Schema

[NotificationTemplate](#message-template)

##### <span id="route-get-templates-400"></span> 400 - ValidationError

Status: Bad Request

###### <span id="route-get-templates-400-schema"></span> Schema

[ValidationError](#validation-error)

### <span id="route-post-alert-rule"></span> Create a new alert rule. (_RoutePostAlertRule_)

```
POST /api/v1/provisioning/alert-rules
```

#### Parameters

| Name | Source | Type                     | Go type            | Separator | Required | Default | Description |
| ---- | ------ | ------------------------ | ------------------ | --------- | :------: | ------- | ----------- |
| Body | `body` | [AlertRule](#alert-rule) | `models.AlertRule` |           |          |         |             |

#### All responses

| Code                              | Status      | Description     | Has headers | Schema                                      |
| --------------------------------- | ----------- | --------------- | :---------: | ------------------------------------------- |
| [201](#route-post-alert-rule-201) | Created     | AlertRule       |             | [schema](#route-post-alert-rule-201-schema) |
| [400](#route-post-alert-rule-400) | Bad Request | ValidationError |             | [schema](#route-post-alert-rule-400-schema) |

#### Responses

##### <span id="route-post-alert-rule-201"></span> 201 - AlertRule

Status: Created

###### <span id="route-post-alert-rule-201-schema"></span> Schema

[AlertRule](#alert-rule)

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

| Code                                 | Status      | Description     | Has headers | Schema                                         |
| ------------------------------------ | ----------- | --------------- | :---------: | ---------------------------------------------- |
| [202](#route-post-contactpoints-202) | Accepted    | Ack             |             | [schema](#route-post-contactpoints-202-schema) |
| [400](#route-post-contactpoints-400) | Bad Request | ValidationError |             | [schema](#route-post-contactpoints-400-schema) |

#### Responses

##### <span id="route-post-contactpoints-202"></span> 202 - Ack

Status: Accepted

###### <span id="route-post-contactpoints-202-schema"></span> Schema

[Ack](#ack)

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

| Name | Source | Type                     | Go type            | Separator | Required | Default | Description |
| ---- | ------ | ------------------------ | ------------------ | --------- | :------: | ------- | ----------- |
| UID  | `path` | string                   | `string`           |           |    ✓     |         |             |
| Body | `body` | [AlertRule](#alert-rule) | `models.AlertRule` |           |          |         |             |

#### All responses

| Code                             | Status      | Description     | Has headers | Schema                                     |
| -------------------------------- | ----------- | --------------- | :---------: | ------------------------------------------ |
| [200](#route-put-alert-rule-200) | OK          | AlertRule       |             | [schema](#route-put-alert-rule-200-schema) |
| [400](#route-put-alert-rule-400) | Bad Request | ValidationError |             | [schema](#route-put-alert-rule-400-schema) |

#### Responses

##### <span id="route-put-alert-rule-200"></span> 200 - AlertRule

Status: OK

###### <span id="route-put-alert-rule-200-schema"></span> Schema

[AlertRule](#alert-rule)

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

| Name | Source | Type                                            | Go type                       | Separator | Required | Default | Description                                       |
| ---- | ------ | ----------------------------------------------- | ----------------------------- | --------- | :------: | ------- | ------------------------------------------------- |
| UID  | `path` | string                                          | `string`                      |           |    ✓     |         | UID should be the contact point unique identifier |
| Body | `body` | [EmbeddedContactPoint](#embedded-contact-point) | `models.EmbeddedContactPoint` |           |          |         |                                                   |

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

| Name | Source | Type                                    | Go type                   | Separator | Required | Default | Description   |
| ---- | ------ | --------------------------------------- | ------------------------- | --------- | :------: | ------- | ------------- |
| name | `path` | string                                  | `string`                  |           |    ✓     |         | Template Name |
| Body | `body` | [MuteTimeInterval](#mute-time-interval) | `models.MuteTimeInterval` |           |          |         |               |

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

| Name | Source | Type            | Go type        | Separator | Required | Default | Description |
| ---- | ------ | --------------- | -------------- | --------- | :------: | ------- | ----------- |
| Body | `body` | [Route](#route) | `models.Route` |           |          |         |             |

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

### <span id="route-put-template"></span> Updates an existing template. (_RoutePutTemplate_)

```
PUT /api/v1/provisioning/templates/{name}
```

#### Consumes

- application/json

#### Parameters

| Name | Source | Type                                                     | Go type                              | Separator | Required | Default | Description   |
| ---- | ------ | -------------------------------------------------------- | ------------------------------------ | --------- | :------: | ------- | ------------- |
| name | `path` | string                                                   | `string`                             |           |    ✓     |         | Template Name |
| Body | `body` | [NotificationTemplateContent](#message-template-content) | `models.NotificationTemplateContent` |           |          |         |               |

#### All responses

| Code                           | Status      | Description     | Has headers | Schema                                   |
| ------------------------------ | ----------- | --------------- | :---------: | ---------------------------------------- |
| [202](#route-put-template-202) | Accepted    | Ack             |             | [schema](#route-put-template-202-schema) |
| [400](#route-put-template-400) | Bad Request | ValidationError |             | [schema](#route-put-template-400-schema) |

#### Responses

##### <span id="route-put-template-202"></span> 202 - Ack

Status: Accepted

###### <span id="route-put-template-202-schema"></span> Schema

[Ack](#ack)

##### <span id="route-put-template-400"></span> 400 - ValidationError

Status: Bad Request

###### <span id="route-put-template-400-schema"></span> Schema

[ValidationError](#validation-error)

### <span id="alert-query"></span> AlertQuery

**Properties**

| Name                                                      | Type                                      | Go type             | Required | Default | Description                                                                                        | Example |
| --------------------------------------------------------- | ----------------------------------------- | ------------------- | :------: | ------- | -------------------------------------------------------------------------------------------------- | ------- |
| DatasourceUID                                             | string                                    | `string`            |          |         | Grafana data source unique identifier; it should be '-100' for a Server Side Expression operation. |         |
| Model                                                     | object                                    | `interface{}`       |          |         | JSON is the raw JSON query and includes the above properties as well as custom properties.         |         |
| QueryType                                                 | string                                    | `string`            |          |         | QueryType is an optional identifier for the type of query.                                         |
| It can be used to distinguish different types of queries. |                                           |
| RefID                                                     | string                                    | `string`            |          |         | RefID is the unique identifier of the query, set by the frontend call.                             |         |
| relativeTimeRange                                         | [RelativeTimeRange](#relative-time-range) | `RelativeTimeRange` |          |         |                                                                                                    |         |

### <span id="alert-rule"></span> AlertRule

**Properties**

| Name         | Type                         | Go type             | Required | Default | Description                               | Example                                                                                                                                                                                                                                                                                                                                                                                                                      |
| ------------ | ---------------------------- | ------------------- | :------: | ------- | ----------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Annotations  | map of string                | `map[string]string` |          |         |                                           | `{"runbook_url":"https://supercoolrunbook.com/page/13"}`                                                                                                                                                                                                                                                                                                                                                                     |
| Condition    | string                       | `string`            |    ✓     |         |                                           | `A`                                                                                                                                                                                                                                                                                                                                                                                                                          |
| Data         | [][alertquery](#alert-query) | `[]*AlertQuery`     |    ✓     |         |                                           | `[{"datasourceUid":"-100","model":{"conditions":[{"evaluator":{"params":[0,0],"type":"gt"},"operator":{"type":"and"},"query":{"params":[]},"reducer":{"params":[],"type":"avg"},"type":"query"}],"datasource":{"type":"__expr__","uid":"__expr__"},"expression":"1 == 1","hide":false,"intervalMs":1000,"maxDataPoints":43200,"refId":"A","type":"math"},"queryType":"","refId":"A","relativeTimeRange":{"from":0,"to":0}}]` |
| ExecErrState | string                       | `string`            |    ✓     |         | Allowed values: "OK", "Alerting", "Error" |                                                                                                                                                                                                                                                                                                                                                                                                                              |
| FolderUID    | string                       | `string`            |    ✓     |         |                                           | `project_x`                                                                                                                                                                                                                                                                                                                                                                                                                  |
| ID           | int64 (formatted integer)    | `int64`             |          |         |                                           |                                                                                                                                                                                                                                                                                                                                                                                                                              |
| Labels       | map of string                | `map[string]string` |          |         |                                           | `{"team":"sre-team-1"}`                                                                                                                                                                                                                                                                                                                                                                                                      |
| NoDataState  | string                       | `string`            |    ✓     |         | Allowed values: "OK", "NoData", "Error"   |                                                                                                                                                                                                                                                                                                                                                                                                                              |
| OrgID        | int64 (formatted integer)    | `int64`             |    ✓     |         |                                           |                                                                                                                                                                                                                                                                                                                                                                                                                              |
| RuleGroup    | string                       | `string`            |    ✓     |         |                                           | `eval_group_1`                                                                                                                                                                                                                                                                                                                                                                                                               |
| Title        | string                       | `string`            |    ✓     |         |                                           | `Always firing`                                                                                                                                                                                                                                                                                                                                                                                                              |
| UID          | string                       | `string`            |          |         |                                           |                                                                                                                                                                                                                                                                                                                                                                                                                              |
| Updated      | date-time (formatted string) | `strfmt.DateTime`   |          |         |                                           |                                                                                                                                                                                                                                                                                                                                                                                                                              |
| for          | [Duration](#duration)        | `Duration`          |    ✓     |         |                                           |                                                                                                                                                                                                                                                                                                                                                                                                                              |
| provenance   | string                       | `Provenance`        |          |         |                                           |                                                                                                                                                                                                                                                                                                                                                                                                                              |

### <span id="alert-rule-group"></span> AlertRuleGroup

**Properties**

| Name     | Type                      | Go type | Required | Default | Description | Example |
| -------- | ------------------------- | ------- | :------: | ------- | ----------- | ------- |
| Interval | int64 (formatted integer) | `int64` |          |         |             |         |

### <span id="day-of-month-range"></span> DayOfMonthRange

**Properties**

| Name  | Type                      | Go type | Required | Default | Description | Example |
| ----- | ------------------------- | ------- | :------: | ------- | ----------- | ------- |
| Begin | int64 (formatted integer) | `int64` |          |         |             |         |
| End   | int64 (formatted integer) | `int64` |          |         |             |         |

### <span id="duration"></span> Duration

| Name     | Type                      | Go type | Default | Description | Example |
| -------- | ------------------------- | ------- | ------- | ----------- | ------- |
| Duration | int64 (formatted integer) | int64   |         |             |         |

### <span id="embedded-contact-point"></span> EmbeddedContactPoint

> EmbeddedContactPoint is the contact point integration that is used
> by grafanas embedded alertmanager implementation.

**Properties**

| Name                  | Type    | Go type  | Required | Default | Description                                                                                          | Example                 |
| --------------------- | ------- | -------- | :------: | ------- | ---------------------------------------------------------------------------------------------------- | ----------------------- |
| DisableResolveMessage | boolean | `bool`   |          |         |                                                                                                      | `false`                 |
| Name                  | string  | `string` |    ✓     |         | Name is used as grouping key in the UI. Contact points with the same name will be grouped in the UI. | `webhook_1`             |
| Provenance            | string  | `string` |          |         |                                                                                                      |                         |
| Type                  | string  | `string` |    ✓     |         |                                                                                                      | `webhook`               |
| UID                   | string  | `string` |          |         | UID is the unique identifier of the contact point. The UID can be set by the user.                   | `my_external_reference` |
| settings              | object  | `JSON`   |    ✓     |         |                                                                                                      |                         |

### <span id="match-type"></span> MatchType

| Name      | Type                      | Go type | Default | Description                                                            | Example |
| --------- | ------------------------- | ------- | ------- | ---------------------------------------------------------------------- | ------- |
| MatchType | int64 (formatted integer) | int64   |         | 0 = MatchEqual, 1 = MatchNotEqual, 2 = MatchRegexp, 3 = MatchNotRegexp |         |

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

### <span id="message-template"></span> NotificationTemplate

**Properties**

| Name       | Type   | Go type      | Required | Default | Description | Example |
| ---------- | ------ | ------------ | :------: | ------- | ----------- | ------- |
| Name       | string | `string`     |          |         |             |         |
| Template   | string | `string`     |          |         |             |         |
| provenance | string | `Provenance` |          |         |             |         |

### <span id="message-template-content"></span> NotificationTemplateContent

**Properties**

| Name     | Type   | Go type  | Required | Default | Description | Example |
| -------- | ------ | -------- | :------: | ------- | ----------- | ------- |
| Template | string | `string` |          |         |             |         |

### <span id="month-range"></span> MonthRange

**Properties**

| Name  | Type                      | Go type | Required | Default | Description | Example |
| ----- | ------------------------- | ------- | :------: | ------- | ----------- | ------- |
| Begin | int64 (formatted integer) | `int64` |          |         |             |         |
| End   | int64 (formatted integer) | `int64` |          |         |             |         |

### <span id="mute-time-interval"></span> MuteTimeInterval

**Properties**

| Name          | Type                             | Go type           | Required | Default | Description | Example |
| ------------- | -------------------------------- | ----------------- | :------: | ------- | ----------- | ------- |
| Name          | string                           | `string`          |          |         |             |         |
| TimeIntervals | [][timeinterval](#time-interval) | `[]*TimeInterval` |          |         |             |         |

### <span id="mute-timings"></span> MuteTimings

[][mutetimeinterval](#mute-time-interval)

### <span id="not-found"></span> NotFound

[interface{}](#interface)

### <span id="object-matchers"></span> ObjectMatchers

[Matchers](#matchers)

#### Inlined models

### <span id="relative-time-range"></span> RelativeTimeRange

> RelativeTimeRange is the per query start and end time
> for requests.

**Properties**

| Name | Type                  | Go type    | Required | Default | Description | Example |
| ---- | --------------------- | ---------- | :------: | ------- | ----------- | ------- |
| from | [Duration](#duration) | `Duration` |          |         |             |         |
| to   | [Duration](#duration) | `Duration` |          |         |             |         |

### <span id="route"></span> Route

> A Route is a node that contains definitions of how to handle alerts.

**Properties**

| Name              | Type                               | Go type          | Required | Default | Description | Example |
| ----------------- | ---------------------------------- | ---------------- | :------: | ------- | ----------- | ------- |
| Continue          | boolean                            | `bool`           |          |         |             |         |
| GroupByStr        | []string                           | `[]string`       |          |         |             |         |
| MuteTimeIntervals | []string                           | `[]string`       |          |         |             |         |
| Receiver          | string                             | `string`         |          |         |             |         |
| Routes            | [][route](#route)                  | `[]*Route`       |          |         |             |         |
| group_interval    | [Duration](#duration)              | `Duration`       |          |         |             |         |
| group_wait        | [Duration](#duration)              | `Duration`       |          |         |             |         |
| object_matchers   | [ObjectMatchers](#object-matchers) | `ObjectMatchers` |          |         |             |         |
| provenance        | string                             | `Provenance`     |          |         |             |         |
| repeat_interval   | [Duration](#duration)              | `Duration`       |          |         |             |         |

### <span id="time-interval"></span> TimeInterval

> TimeInterval describes intervals of time. ContainsTime will tell you if a golang time is contained
> within the interval.

**Properties**

| Name        | Type                                     | Go type              | Required | Default | Description | Example |
| ----------- | ---------------------------------------- | -------------------- | :------: | ------- | ----------- | ------- |
| DaysOfMonth | [][dayofmonthrange](#day-of-month-range) | `[]*DayOfMonthRange` |          |         |             |         |
| Months      | [][monthrange](#month-range)             | `[]*MonthRange`      |          |         |             |         |
| Times       | [][timerange](#time-range)               | `[]*TimeRange`       |          |         |             |         |
| Weekdays    | [][weekdayrange](#weekday-range)         | `[]*WeekdayRange`    |          |         |             |         |
| Years       | [][yearrange](#year-range)               | `[]*YearRange`       |          |         |             |         |

### <span id="time-range"></span> TimeRange

> For example, 4:00PM to End of the day would Begin at 1020 and End at 1440.

**Properties**

| Name        | Type                      | Go type | Required | Default | Description | Example |
| ----------- | ------------------------- | ------- | :------: | ------- | ----------- | ------- |
| EndMinute   | int64 (formatted integer) | `int64` |          |         |             |         |
| StartMinute | int64 (formatted integer) | `int64` |          |         |             |         |

### <span id="validation-error"></span> ValidationError

**Properties**

| Name | Type   | Go type  | Required | Default | Description | Example |
| ---- | ------ | -------- | :------: | ------- | ----------- | ------- |
| Msg  | string | `string` |          |         |             |         |

### <span id="weekday-range"></span> WeekdayRange

**Properties**

| Name  | Type                      | Go type | Required | Default | Description | Example |
| ----- | ------------------------- | ------- | :------: | ------- | ----------- | ------- |
| Begin | int64 (formatted integer) | `int64` |          |         |             |         |
| End   | int64 (formatted integer) | `int64` |          |         |             |         |

### <span id="year-range"></span> YearRange

**Properties**

| Name  | Type                      | Go type | Required | Default | Description | Example |
| ----- | ------------------------- | ------- | :------: | ------- | ----------- | ------- |
| Begin | int64 (formatted integer) | `int64` |          |         |             |         |
| End   | int64 (formatted integer) | `int64` |          |         |             |         |
