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
      "alertId": 1,
      "paused": true
    }

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

`POST /api/alerts-notifications`

**Example Request**:

    POST /api/alerts-notifications HTTP/1.1
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

`PUT /api/alerts-notifications/1`

**Example Request**:

    PUT /api/alerts-notifications/1 HTTP/1.1
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

`DELETE /api/alerts-notifications/:notificationId`

**Example Request**:

    DELETE /api/alerts-notifications/1 HTTP/1.1
    Accept: application/json
    Content-Type: application/json
    Authorization: Bearer eyJrIjoiT0tTcG1pUlY2RnVKZTFVaDFsNFZXdE9ZWmNrMkZYbk

**Example Response**:

    HTTP/1.1 200
    Content-Type: application/json
    {
      "message": "Notification deleted"
    }
