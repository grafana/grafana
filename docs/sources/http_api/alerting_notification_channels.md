+++
title = "Alerting Notification Channels HTTP API "
description = "Grafana Alerting Notification Channel HTTP API"
keywords = ["grafana", "http", "documentation", "api", "alerting", "alerts", "notifications"]
aliases = []
type = "docs"
[menu.docs]
name = "Alerting Notification Channels"
parent = "http_api"
+++

# Alerting Notification Channels API

## Identifier (id) vs unique identifier (uid)

The identifier (id) of a notification channel is an auto-incrementing numeric value and is only unique per Grafana install.

The unique identifier (uid) of a notification channel can be used for uniquely identify a notification channel between
multiple Grafana installs. It's automatically generated if not provided when creating a notification channel. The uid
allows having consistent URL's for accessing notification channels and when syncing notification channels between multiple
Grafana installs, see [alert notification channel provisioning](/administration/provisioning/#alert-notification-channels)
for more information.

The uid can have a maximum length of 40 characters.

## Get all notification channels

Returns all notification channels that the authenticated user has permission to view.

`GET /api/alert-notifications`

**Example Request**:

```http
GET /api/alert-notifications HTTP/1.1
Accept: application/json
Content-Type: application/json
Authorization: Bearer eyJrIjoiT0tTcG1pUlY2RnVKZTFVaDFsNFZXdE9ZWmNrMkZYbk
```

**Example Response**:

```http
HTTP/1.1 200
Content-Type: application/json

[
  {
    "id": 1,
    "uid": "team-a-email-notifier",
    "name": "Team A",
    "type": "email",
    "isDefault": false,
    "sendReminder": false,
    "disableResolveMessage": false,
    "settings": {
      "addresses": "dev@grafana.com"
    },
    "created": "2018-04-23T14:44:09+02:00",
    "updated": "2018-08-20T15:47:49+02:00"
  }
]

```

## Get notification channel by uid

`GET /api/alert-notifications/uid/:uid`

Will return the notification channel given the notification channel uid.

**Example Request**:

```http
GET /api/alert-notifications/uid/team-a-email-notifier HTTP/1.1
Accept: application/json
Content-Type: application/json
Authorization: Bearer eyJrIjoiT0tTcG1pUlY2RnVKZTFVaDFsNFZXdE9ZWmNrMkZYbk
```

**Example Response**:

```http
HTTP/1.1 200
Content-Type: application/json

{
  "id": 1,
  "uid": "team-a-email-notifier",
  "name": "Team A",
  "type": "email",
  "isDefault": false,
  "sendReminder": false,
  "disableResolveMessage": false,
  "settings": {
    "addresses": "dev@grafana.com"
  },
  "created": "2018-04-23T14:44:09+02:00",
  "updated": "2018-08-20T15:47:49+02:00"
}
```

## Get notification channel by id

`GET /api/alert-notifications/:id`

Will return the notification channel given the notification channel id.

**Example Request**:

```http
GET /api/alert-notifications/1 HTTP/1.1
Accept: application/json
Content-Type: application/json
Authorization: Bearer eyJrIjoiT0tTcG1pUlY2RnVKZTFVaDFsNFZXdE9ZWmNrMkZYbk
```

**Example Response**:

```http
HTTP/1.1 200
Content-Type: application/json

{
  "id": 1,
  "uid": "team-a-email-notifier",
  "name": "Team A",
  "type": "email",
  "isDefault": false,
  "sendReminder": false,
  "disableResolveMessage": false,
  "settings": {
    "addresses": "dev@grafana.com"
  },
  "created": "2018-04-23T14:44:09+02:00",
  "updated": "2018-08-20T15:47:49+02:00"
}
```

## Create notification channel

You can find the full list of [supported notifiers](/alerting/notifications/#all-supported-notifier) at the alert notifiers page.

`POST /api/alert-notifications`

**Example Request**:

```http
POST /api/alert-notifications HTTP/1.1
Accept: application/json
Content-Type: application/json
Authorization: Bearer eyJrIjoiT0tTcG1pUlY2RnVKZTFVaDFsNFZXdE9ZWmNrMkZYbk

{
  "uid": "new-alert-notification", // optional
  "name": "new alert notification",  //Required
  "type":  "email", //Required
  "isDefault": false,
  "sendReminder": false,
  "settings": {
    "addresses": "dev@grafana.com"
  }
}
```

**Example Response**:

```http
HTTP/1.1 200
Content-Type: application/json

{
  "id": 1,
  "uid": "new-alert-notification",
  "name": "new alert notification",
  "type": "email",
  "isDefault": false,
  "sendReminder": false,
  "settings": {
    "addresses": "dev@grafana.com"
  },
  "created": "2018-04-23T14:44:09+02:00",
  "updated": "2018-08-20T15:47:49+02:00"
}
```

## Update notification channel by uid

`PUT /api/alert-notifications/uid/:uid`

Updates an existing notification channel identified by uid.

**Example Request**:

```http
PUT /api/alert-notifications/uid/cIBgcSjkk HTTP/1.1
Accept: application/json
Content-Type: application/json
Authorization: Bearer eyJrIjoiT0tTcG1pUlY2RnVKZTFVaDFsNFZXdE9ZWmNrMkZYbk

{
  "uid": "new-alert-notification", // optional
  "name": "new alert notification",  //Required
  "type":  "email", //Required
  "isDefault": false,
  "sendReminder": true,
  "frequency": "15m",
  "settings": {
    "addresses": "dev@grafana.com"
  }
}
```

**Example Response**:

```http
HTTP/1.1 200
Content-Type: application/json

{
  "id": 1,
  "uid": "new-alert-notification",
  "name": "new alert notification",
  "type": "email",
  "isDefault": false,
  "sendReminder": true,
  "frequency": "15m",
  "settings": {
    "addresses": "dev@grafana.com"
  },
  "created": "2017-01-01 12:34",
  "updated": "2017-01-01 12:34"
}
```

## Update notification channel by id

`PUT /api/alert-notifications/:id`

Updates an existing notification channel identified by id.

**Example Request**:

```http
PUT /api/alert-notifications/1 HTTP/1.1
Accept: application/json
Content-Type: application/json
Authorization: Bearer eyJrIjoiT0tTcG1pUlY2RnVKZTFVaDFsNFZXdE9ZWmNrMkZYbk

{
  "id": 1,
  "uid": "new-alert-notification", // optional
  "name": "new alert notification",  //Required
  "type":  "email", //Required
  "isDefault": false,
  "sendReminder": true,
  "frequency": "15m",
  "settings": {
    "addresses": "dev@grafana.com"
  }
}
```

**Example Response**:

```http
HTTP/1.1 200
Content-Type: application/json

{
  "id": 1,
  "uid": "new-alert-notification",
  "name": "new alert notification",
  "type": "email",
  "isDefault": false,
  "sendReminder": true,
  "frequency": "15m",
  "settings": {
    "addresses": "dev@grafana.com"
  },
  "created": "2017-01-01 12:34",
  "updated": "2017-01-01 12:34"
}
```

## Delete alert notification by uid

`DELETE /api/alert-notifications/uid/:uid`

Deletes an existing notification channel identified by uid.

**Example Request**:

```http
DELETE /api/alert-notifications/uid/team-a-email-notifier HTTP/1.1
Accept: application/json
Content-Type: application/json
Authorization: Bearer eyJrIjoiT0tTcG1pUlY2RnVKZTFVaDFsNFZXdE9ZWmNrMkZYbk
```

**Example Response**:

```http
HTTP/1.1 200
Content-Type: application/json

{
  "message": "Notification deleted"
}
```

## Delete alert notification by id

`DELETE /api/alert-notifications/:id`

Deletes an existing notification channel identified by id.

**Example Request**:

```http
DELETE /api/alert-notifications/1 HTTP/1.1
Accept: application/json
Content-Type: application/json
Authorization: Bearer eyJrIjoiT0tTcG1pUlY2RnVKZTFVaDFsNFZXdE9ZWmNrMkZYbk
```

**Example Response**:

```http
HTTP/1.1 200
Content-Type: application/json

{
  "message": "Notification deleted"
}
```

## Test notification channel

Sends a test notification message for the given notification channel type and settings.
You can find the full list of [supported notifiers](/alerting/notifications/#all-supported-notifier) at the alert notifiers page.

`POST /api/alert-notifications/test`

**Example Request**:

```http
POST /api/alert-notifications/test HTTP/1.1
Accept: application/json
Content-Type: application/json
Authorization: Bearer eyJrIjoiT0tTcG1pUlY2RnVKZTFVaDFsNFZXdE9ZWmNrMkZYbk

{
  "type":  "email",
  "settings": {
    "addresses": "dev@grafana.com"
  }
}
```

**Example Response**:

```http
HTTP/1.1 200
Content-Type: application/json

{
  "message": "Test notification sent"
}
```

