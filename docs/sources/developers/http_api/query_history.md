---
aliases:
  - ../../http_api/query_history/
canonical: /docs/grafana/latest/developers/http_api/query_history/
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
  "datasourceUid": "PE1C5CBDA0504A6A3",
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
- **401** – Unauthorized
- **500** – Internal error

## Query history search

`GET /api/query-history`

Returns a list of queries in the query history that matches the search criteria. Query history search supports pagination. Use the `limit` parameter to control the maximum number of queries returned; the default limit is 100. You can also use the `page` query parameter to fetch queries from any page other than the first one.

Query parameters:

- **datasourceUid** - Filter the query history for the selected data source. To perform an "AND" filtering with multiple data sources, specify the data source parameter using the following format: `datasourceUid=uid1&datasourceUid=uid2`.
- **searchString** – Filter the query history based on the content.
- **sort** - Specify the sorting order. Sorting can be `time-asc` or `time-desc`. The default is `time-desc`.
- **onlyStarred** - Search for queries that are starred. Defaults to `false`.
- **page** - Search supports pagination. Specify which page number to return. Use the limit parameter to specify the number of queries per page.
- **limit** - Limits the number of returned query history items per page. The default is 100 queries per page.
- **from/to** - Specifies time range for the query history search. The time can be either epoch timestamps in milliseconds or relative using Grafana time units. For example, now-5m.

**Example request for query history search**:

```http
GET /api/query-history?datasourceUid="PE1C5CBDA0504A6A3"&datasourceUid="FG1C1CBDA0504A6EL"&searchString="ALERTS"&sort="time-asc" HTTP/1.1
Accept: application/json
Content-Type: application/json
Authorization: Bearer eyJrIjoiT0tTcG1pUlY2RnVKZTFVaDFsNFZXdE9ZWmNrMkZYbk
```

**Example response for query history search**:

```http
HTTP/1.1 200
Content-Type: application/json
{
  "result": {
    "totalCount": 150,
    "page": 1,
    "perPage": 100
    "queryHistory":[{
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
            "uid": "PE1C5CBDA0504A6A3"
        }
      }
    ]
  }]
}
```

Status codes:

- **200** – OK
- **401** – Unauthorized
- **500** – Internal error

## Delete query from Query history by UID

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
- **401** – Unauthorized
- **500** – Internal error

## Update comment of query in Query history by UID

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
- **401** – Unauthorized
- **500** – Internal error

## Star query in Query history

`POST /api/query-history/star/:uid`

Stars query in query history.

**Example request:**

```http
POST /api/query-history/star/P8zM2I1nz HTTP/1.1
Accept: application/json
Content-Type: application/json
Authorization: Bearer eyJrIjoiT0tTcG1pUlY2RnVKZTFVaDFsNFZXdE9ZWmNrMkZYbk
```

**Example response:**

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
- **401** – Unauthorized
- **500** – Internal error

## Unstar query in Query history

`DELETE /api/query-history/star/:uid`

Removes stars from query in query history.

**Example request:**

```http
DELETE /api/query-history/star/P8zM2I1nz  HTTP/1.1
Accept: application/json
Content-Type: application/json
Authorization: Bearer eyJrIjoiT0tTcG1pUlY2RnVKZTFVaDFsNFZXdE9ZWmNrMkZYbk
```

**Example response:**

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
- **401** – Unauthorized
- **500** – Internal error

## Migrate queries to Query history

`POST /api/query-history/migrate`

Migrates multiple queries in to query history.

**Example request:**

```http
POST /api/query-history HTTP/1.1
Accept: application/json
Content-Type: application/json
Authorization: Bearer eyJrIjoiT0tTcG1pUlY2RnVKZTFVaDFsNFZXdE9ZWmNrMkZYbk
{
  "queries": [
    {
      "datasourceUid": "PE1C5CBDA0504A6A3",
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
      ],
      "starred": false,
      "createdAt": 1643630762,
      "comment": "debugging"
    }
  ]
}
```

JSON body schema:

- **queries** – JSON of query history items.

**Example response:**

```http
HTTP/1.1 200
Content-Type: application/json
{
  "message": "Query history successfully migrated",
  "totalCount": 105,
  "starredCount": 10
}
```

Status codes:

- **200** – OK
- **400** - Errors (invalid JSON, missing or invalid fields)
- **401** – Unauthorized
- **500** – Internal error
