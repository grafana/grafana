+++
title = "Query History HTTP API "
description = "Grafana Query History HTTP API"
keywords = ["grafana", "http", "documentation", "api", "queryHistory"]
aliases = ["/docs/grafana/latest/http_api/query_history/"]
+++

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
  "result": {
    "uid": "Ahg678z",
    "datasourceUid": "PE1C5CBDA0504A6A3",
    "createdBy": 1,
    "createdAt": 1643630762,
    "starred": false,
    "comment": "",
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
}
```

Status codes:

- **200** – OK
- **400** - Errors (invalid JSON, missing or invalid fields)
- **500** – Unable to add query to the database

### Delete query from Query history by UID

`DELETE /api/query-history/:uid`

Deletes the query in query history that matches the specified uid. It requires that the user is logged in and that Query history feature is enabled in config file.

**Example Request**:

```http
DELETE /api/query-history/P8zM2I1nz HTTP/1.1
Accept: application/json
Content-Type: application/json
Authorization: Bearer eyJrIjoiT0tTcG1pUlY2RnVKZTFVaDFsNFZXdE9ZWmNrMkZYbk
```

**Example Response**:

```http
HTTP/1.1 200
Content-Type: application/json

{
    "message": "Query deleted",
    "id": 28
}
```

Status codes:

- **200** – OK
- **404** - Query in query history not found
- **500** – Unable to delete query from the database

### Update comment of query in Query history by UID

`PATCH /api/query-history/:uid`

Updates comment of a query with a specific uid that is stored in the query history.

Query parameters:

- **comment** – New comment that will be added to the specified query.

**Example Request**:

```http
PATCH /api/query-history/P8zM2I1nz HTTP/1.1
Accept: application/json
Content-Type: application/json
Authorization: Bearer eyJrIjoiT0tTcG1pUlY2RnVKZTFVaDFsNFZXdE9ZWmNrMkZYbk
{
  "comment": "Debugging query",
}
```

**Example Response**:

```http
HTTP/1.1 200
Content-Type: application/json
{
  "result": {
    "uid": "P8zM2I1nz",
    "datasourceUid": "PE1C5CBDA0504A6A3",
    "createdBy": 1,
    "createdAt": 1643630762,
    "starred": false,
    "comment": "Debugging query",
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
}
```

Status codes:

- **200** – OK
- **400** - Errors (invalid JSON, missing or invalid fields)
- **500** – Unable to update comment of query in the database
