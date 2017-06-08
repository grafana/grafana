+++
title = "Alerting HTTP API "
description = "Grafana Alerting HTTP API"
keywords = ["grafana", "http", "documentation", "api", "alerting"]
aliases = ["/http_api/alerting/"]
type = "docs"
[menu.docs]
name = "Alerting"
parent = "http_api"
+++


# Alerting API

You can use the Alerting API to get information about alerts and their states but this API cannot be used to modify the alert.
To create new alerts or modify them you need to update the dashboard json that contains the alerts.

This API can also be used to create, update and delete alert notifications.

## Get alerts

`GET /api/alerts/`

**Example Request**:

    GET /api/alerts HTTP/1.1
    Accept: application/json
    Content-Type: application/json
    Authorization: Bearer eyJrIjoiT0tTcG1pUlY2RnVKZTFVaDFsNFZXdE9ZWmNrMkZYbk

  Querystring Parameters:

  These parameters are used as querystring parameters. For example:

  `/api/alerts?dashboardId=1`

  - **dashboardId** – Return alerts for a specified dashboard.
  - **panelId** – Return alerts for a specified panel on a dashboard.
  - **limit** - Limit response to x number of alerts.
  - **state** - Return alerts with one or more of the following alert states: `ALL`,`no_data`, `paused`, `alerting`, `ok`, `pending`. To specify multiple states use the following format: `?state=paused&state=alerting`

**Example Response**:

    HTTP/1.1 200
    Content-Type: application/json
    [
      {
        "id": 1,
        "dashboardId": 1,
        "panelId": 1,
        "name": "fire place sensor",
        "message": "Someone is trying to break in through the fire place",
        "state": "alerting",
        "evalDate": "0001-01-01T00:00:00Z",
        "evalData": [
          {
            "metric": "fire",
            "tags": null,
            "value": 5.349999999999999
          }
        "newStateDate": "2016-12-25",
        "executionError": "",
        "dashboardUri": "http://grafana.com/dashboard/db/sensors"
      }
    ]

## Get one alert

`GET /api/alerts/:id`

**Example Request**:

    GET /api/alerts/1 HTTP/1.1
    Accept: application/json
    Content-Type: application/json
    Authorization: Bearer eyJrIjoiT0tTcG1pUlY2RnVKZTFVaDFsNFZXdE9ZWmNrMkZYbk

**Example Response**:

    HTTP/1.1 200
    Content-Type: application/json
    {
      "id": 1,
      "dashboardId": 1,
      "panelId": 1,
      "name": "fire place sensor",
      "message": "Someone is trying to break in through the fire place",
      "state": "alerting",
      "newStateDate": "2016-12-25",
      "executionError": "",
      "dashboardUri": "http://grafana.com/dashboard/db/sensors"
    }

## Pause alert

`POST /api/alerts/:id/pause`

**Example Request**:

    POST /api/alerts/1/pause HTTP/1.1
    Accept: application/json
    Content-Type: application/json
    Authorization: Bearer eyJrIjoiT0tTcG1pUlY2RnVKZTFVaDFsNFZXdE9ZWmNrMkZYbk

    {
      "paused": true
    }

The :id query parameter is the id of the alert to be paused or unpaused.

JSON Body Schema:

- **paused** – Can be `true` or `false`. True to pause an alert. False to unpause an alert.

**Example Response**:

    HTTP/1.1 200
    Content-Type: application/json
    {
      "alertId": 1,
      "state":   "Paused",
      "message": "alert paused"
    }

## Get alert notifications

`GET /api/alert-notifications`

**Example Request**:

    GET /api/alert-notifications HTTP/1.1
    Accept: application/json
    Content-Type: application/json
    Authorization: Bearer eyJrIjoiT0tTcG1pUlY2RnVKZTFVaDFsNFZXdE9ZWmNrMkZYbk



**Example Response**:

    HTTP/1.1 200
    Content-Type: application/json

    {
      "id": 1,
      "name": "Team A",
      "type": "email",
      "isDefault": true,
      "created": "2017-01-01 12:45",
      "updated": "2017-01-01 12:45"
    }

## Create alert notification

`POST /api/alert-notifications`

**Example Request**:

    POST /api/alert-notifications HTTP/1.1
    Accept: application/json
    Content-Type: application/json
    Authorization: Bearer eyJrIjoiT0tTcG1pUlY2RnVKZTFVaDFsNFZXdE9ZWmNrMkZYbk

    {
      "name": "new alert notification",  //Required
      "type":  "email", //Required
      "isDefault": false,
      "settings": {
        "addresses": "carl@grafana.com;dev@grafana.com"
      }
    }


**Example Response**:

    HTTP/1.1 200
    Content-Type: application/json
    {
      "id": 1,
      "name": "new alert notification",
      "type": "email",
      "isDefault": false,
      "settings": { addresses: "carl@grafana.com;dev@grafana.com"} }
      "created": "2017-01-01 12:34",
      "updated": "2017-01-01 12:34"
    }

## Update alert notification

`PUT /api/alert-notifications/1`

**Example Request**:

    PUT /api/alert-notifications/1 HTTP/1.1
    Accept: application/json
    Content-Type: application/json
    Authorization: Bearer eyJrIjoiT0tTcG1pUlY2RnVKZTFVaDFsNFZXdE9ZWmNrMkZYbk

    {
      "id": 1,
      "name": "new alert notification",  //Required
      "type":  "email", //Required
      "isDefault": false,
      "settings": {
        "addresses: "carl@grafana.com;dev@grafana.com"
      }
    }


**Example Response**:

    HTTP/1.1 200
    Content-Type: application/json
    {
      "id": 1,
      "name": "new alert notification",
      "type": "email",
      "isDefault": false,
      "settings": { addresses: "carl@grafana.com;dev@grafana.com"} }
      "created": "2017-01-01 12:34",
      "updated": "2017-01-01 12:34"
    }

## Delete alert notification

`DELETE /api/alert-notifications/:notificationId`

**Example Request**:

    DELETE /api/alert-notifications/1 HTTP/1.1
    Accept: application/json
    Content-Type: application/json
    Authorization: Bearer eyJrIjoiT0tTcG1pUlY2RnVKZTFVaDFsNFZXdE9ZWmNrMkZYbk

**Example Response**:

    HTTP/1.1 200
    Content-Type: application/json
    {
      "message": "Notification deleted"
    }
