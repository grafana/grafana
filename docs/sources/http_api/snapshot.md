+++
title = "HTTP Snapshot API "
description = "Grafana HTTP API"
keywords = ["grafana", "http", "documentation", "api", "snapshot"]
aliases = ["/http_api/snapshot/"]
type = "docs"
[menu.docs]
name = "Snapshot"
parent = "http_api"
+++

# Snapshot API

## Create new snapshot

`POST /api/snapshots`

**Example Request**:

    POST /api/snapshots HTTP/1.1
    Accept: application/json
    Content-Type: application/json
    Authorization: Bearer eyJrIjoiT0tTcG1pUlY2RnVKZTFVaDFsNFZXdE9ZWmNrMkZYbk

    {
      "dashboard": {
        "editable":false,
        "hideControls":true,
        "nav":[
        {
          "enable":false,
        "type":"timepicker"
        }
        ],
        "rows": [
          {

          }
        ],
        "style":"dark",
        "tags":[],
        "templating":{
          "list":[
          ]
        },
        "time":{
        },
        "timezone":"browser",
        "title":"Home",
        "version":5
        },
      "expires": 3600
    }

**Example Response**:

    HTTP/1.1 200
    Content-Type: application/json
    {
      "deleteKey":"XXXXXXX",
      "deleteUrl":"myurl/dashboard/snapshot/XXXXXXX",
      "key":"YYYYYYY",
      "url":"myurl/dashboard/snapshot/YYYYYYY"
    }

Keys:

- **deleteKey** – Key generated to delete the snapshot
- **key** – Key generated to share the dashboard

## Get Snapshot by Id

`GET /api/snapshots/:key`

**Example Request**:

    GET /api/snapshots/YYYYYYY HTTP/1.1
    Accept: application/json
    Content-Type: application/json
    Authorization: Bearer eyJrIjoiT0tTcG1pUlY2RnVKZTFVaDFsNFZXdE9ZWmNrMkZYbk

**Example Response**:

    HTTP/1.1 200
    Content-Type: application/json

    {
      "meta":{
        "isSnapshot":true,
        "type":"snapshot",
        "canSave":false,
        "canEdit":false,
        "canStar":false,
        "slug":"",
        "expires":"2200-13-32T25:23:23+02:00",
        "created":"2200-13-32T28:24:23+02:00"
        },
        "dashboard": {
          "editable":false,
          "hideControls":true,
          "nav":[
          {
            "enable":false,
          "type":"timepicker"
          }
          ],
          "rows": [
            {

            }
          ],
          "style":"dark",
          "tags":[],
          "templating":{
            "list":[
            ]
          },
          "time":{
          },
          "timezone":"browser",
          "title":"Home",
          "version":5
        }
    }

## Delete Snapshot by Id

`GET /api/snapshots-delete/:key`

**Example Request**:

    GET /api/snapshots/YYYYYYY HTTP/1.1
    Accept: application/json
    Content-Type: application/json
    Authorization: Bearer eyJrIjoiT0tTcG1pUlY2RnVKZTFVaDFsNFZXdE9ZWmNrMkZYbk

**Example Response**:

    HTTP/1.1 200
    Content-Type: application/json

    {"message":"Snapshot deleted. It might take an hour before it's cleared from a CDN cache."}
