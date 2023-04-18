---
aliases:
  - /docs/grafana/latest/http_api/query_history/
description: Grafana Query History HTTP API
keywords:
  - grafana
  - http
  - documentation
  - api
  - queryHistory
title: 'Query History HTTP API '
---

# Query history API

This API can be used to add queries to Query history. It requires that the user is logged in and that Query history feature is enabled in config file.

## Add query to Query history

`POST /api/query-history`

Adds query to query history.

**Example request:**

```http
POST /api/query-history HTTP/1.1
Accept: application/json
Content-Type: application/json
Authorization: Bearer eyJrIjoiT0tTcG1pUlY2RnVKZTFVaDFsNFZXdE9ZWmNrMkZYbk
{
  "dataSourceUid": "PE1C5CBDA0504A6A3",
  "queries": [
    {
        "refId": "A",
        "key": "Q-87fed8e3-62ba-4eb2-8d2a-4129979bb4de-0",
        "scenarioId": "csv_content",
        "datasource": {
            "type": "testdata",
            "uid": "PD8C576611E62080A"
        }
    }
]
}
```

JSON body schema:

- **datasourceUid** – Data source uid.
- **queries** – JSON of query or queries.

**Example response:**

```http
HTTP/1.1 200
Content-Type: application/json
{
  "message": "Query successfully added to query history",
}
```

Status codes:

- **200** – OK
- **500** – Errors (invalid JSON, missing or invalid fields)
