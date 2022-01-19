+++
title = "Query History HTTP API "
description = "Grafana Query History HTTP API"
keywords = ["grafana", "http", "documentation", "api", "queryHistory"]
aliases = ["/docs/grafana/latest/http_api/query_history/"]
+++

# Query history API

This API can be used to create/update/delete Query history, to add comments and to star/unstar queries in Query history. All actions require that the user is logged in.

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
  "queries": "[{\"refId\":\"A\",\"key\":\"Q-ddce2aa5-b9f8-4e07-839e-19510691eaf4-0\",\"instant\":true,\"range\":true,\"exemplar\":true,\"expr\":\"rate(ALERTS{job=\\\"grafana\\\"}[$__interval])\",\"datasource\":{\"type\":\"prometheus\",\"uid\":\"PE1C5CBDA0504A6A3\"}}]"
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

## Query history search

`GET /api/query-history`

Search in query history.

Query parameters:

- **searchString** – Part of the content of query searched for.
- **datasourceUids** - List of data source uid's to search for.
- **sort** - Sorting order. Can be `time-asc` or `time desc`. Defaults to `time-desc`.
- **onlyStarred** - Search for queries that are starred. Defaults to `false`.
  **Example request for query history search**:

```http
GET /api/query-history?dataSourceUids="PE1C5CBDA0504A6A3"&searchString="ALERTS"&sort="time-asc" HTTP/1.1
Accept: application/json
Content-Type: application/json
Authorization: Bearer eyJrIjoiT0tTcG1pUlY2RnVKZTFVaDFsNFZXdE9ZWmNrMkZYbk
```

**Example response for query history search**:

```http
HTTP/1.1 200
Content-Type: application/json

[
    {
        "starred": false,
        "uid": "F4pRBu1nk",
        "datasourceUid": "PE1C5CBDA0504A6A3",
        "createdBy": 1,
        "createdAt": 1642585657,
        "comment": "",
        "queries": [
            {
                "refId": "A",
                "key": "Q-ddce2aa5-b9f8-4e07-839e-19510691eaf4-0",
                "instant": true,
                "range": true,
                "exemplar": true,
                "expr":"rate(ALERTS{job=\"grafana\"}[$__interval])",
                "datasource": {
                    "type": "prometheus",
                    "uid": "PE1C5CBDA0504A6A3"
                }
            }
        ]
    }
]
```

### Delete query from Query history by Uid

`DELETE /api/query-historu/:uid`

Deletes the query in query history that matches the specified uid.

**Example Request**:

```http
DELETE /api/annotations/P8zM2I1nz HTTP/1.1
Accept: application/json
Content-Type: application/json
Authorization: Bearer eyJrIjoiT0tTcG1pUlY2RnVKZTFVaDFsNFZXdE9ZWmNrMkZYbk
```

**Example Response**:

```http
HTTP/1.1 200
Content-Type: application/json

{
    "message": "Query successfully deleted from query history"
}
```

Status codes:

- **200** – OK
- **500** – Errors

### Update comment of query in Query history by Uid

`PUT /api/query-historu/:uid`

Updates comment of query in the query history that matches the specified uid.

Query parameters:

- **comment** – New comment that will be added to specified query.

**Example Request**:

```http
PUT /api/annotations/P8zM2I1nz HTTP/1.1
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
    "message": "Query comment successfully updated"
}
```

Status codes:

- **200** – OK
- **500** – Errors

## Star query in Query history

`POST /api/query-history/star/:uid`

Stars query in query history.

**Example request:**

```http
POST /api/query-history HTTP/1.1
Accept: application/json
Content-Type: application/json
Authorization: Bearer eyJrIjoiT0tTcG1pUlY2RnVKZTFVaDFsNFZXdE9ZWmNrMkZYbk
```

**Example response:**

```http
HTTP/1.1 200
Content-Type: application/json

{
  "message": "Query successfully starred",
}
```

Status codes:

- **200** – OK
- **500** – Errors

## Unstar query in Query history

`DELETE /api/query-history/star/:uid`

Removes stars from query in query history.

**Example request:**

```http
DELETE /api/query-history HTTP/1.1
Accept: application/json
Content-Type: application/json
Authorization: Bearer eyJrIjoiT0tTcG1pUlY2RnVKZTFVaDFsNFZXdE9ZWmNrMkZYbk
```

**Example response:**

```http
HTTP/1.1 200
Content-Type: application/json

{
  "message": "Query successfully unstarred",
}
```

Status codes:

- **200** – OK
- **500** – Errors
