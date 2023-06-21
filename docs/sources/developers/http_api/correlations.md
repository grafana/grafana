---
aliases:
  - ../../http_api/correlations/
canonical: /docs/grafana/latest/developers/http_api/correlation/
description: Grafana Correlations HTTP API
keywords:
  - grafana
  - http
  - documentation
  - api
  - correlations
  - Glue
title: 'Correlations HTTP API '
---

# Correlations API

This API can be used to define correlations between data sources.

## Create correlations

`POST /api/datasources/uid/:sourceUID/correlations`

Creates a correlation between two data sources - the source data source identified by `sourceUID` in the path, and the target data source which is specified in the body.

**Example request:**

```http
POST /api/datasources/uid/uyBf2637k/correlations HTTP/1.1
Accept: application/json
Content-Type: application/json
Authorization: Bearer eyJrIjoiT0tTcG1pUlY2RnVKZTFVaDFsNFZXdE9ZWmNrMkZYbk
{
	"targetUID": "PDDA8E780A17E7EF1",
	"label": "My Label",
	"description": "Logs to Traces",
  "config": {
    "type": "query",
    "field": "message",
    "target": {},
  }
}
```

JSON body schema:

- **targetUID** – Target data source uid.
- **label** – A label for the correlation.
- **description** – A description for the correlation.

**Example response:**

```http
HTTP/1.1 200
Content-Type: application/json
{
  "message": "Correlation created",
  "result": {
    "description": "Logs to Traces",
    "label": "My Label",
    "sourceUID": "uyBf2637k",
    "targetUID": "PDDA8E780A17E7EF1",
    "uid": "50xhMlg9k",
    "config": {
      "type": "query",
      "field": "message",
      "target": {},
    }
  }
}
```

Status codes:

- **200** – OK
- **400** - Errors (invalid JSON, missing or invalid fields)
- **401** – Unauthorized
- **403** – Forbidden, source data source is read-only
- **404** – Not found, either source or target data source could not be found
- **500** – Internal error

## Delete correlations

`DELETE /api/datasources/uid/:sourceUID/correlations/:correlationUID`

Deletes a correlation.

**Example request:**

```http
DELETE /api/datasources/uid/uyBf2637k/correlations/J6gn7d31L HTTP/1.1
Accept: application/json
Content-Type: application/json
Authorization: Bearer eyJrIjoiT0tTcG1pUlY2RnVKZTFVaDFsNFZXdE9ZWmNrMkZYbk
```

**Example response:**

```http
HTTP/1.1 200
Content-Type: application/json
{
  "message": "Correlation deleted"
}
```

Status codes:

- **200** – OK
- **401** – Unauthorized
- **403** – Forbidden, data source is read-only
- **404** – Correlation not found
- **500** – Internal error

## Update correlations

`PATCH /api/datasources/uid/:sourceUID/correlations/:correlationUID`

Updates a correlation.

**Example request:**

```http
POST /api/datasources/uid/uyBf2637k/correlations/J6gn7d31L HTTP/1.1
Accept: application/json
Content-Type: application/json
Authorization: Bearer eyJrIjoiT0tTcG1pUlY2RnVKZTFVaDFsNFZXdE9ZWmNrMkZYbk
{
	"label": "My Label",
	"description": "Logs to Traces",
}
```

JSON body schema:

- **label** – A label for the correlation.
- **description** – A description for the correlation.

**Example response:**

```http
HTTP/1.1 200
Content-Type: application/json
{
  "message": "Correlation updated",
  "result": {
    "description": "Logs to Traces",
    "label": "My Label",
    "sourceUID": "uyBf2637k",
    "targetUID": "PDDA8E780A17E7EF1",
    "uid": "J6gn7d31L",
    "config": {
			"type": "query",
			"field": "message",
			"target": {}
		}
  }
}
```

Status codes:

- **200** – OK
- **400** – Bad request
- **401** – Unauthorized
- **403** – Forbidden, source data source is read-only
- **404** – Not found, either source or target data source could not be found
- **500** – Internal error

## Get single correlation

`GET /api/datasources/uid/:sourceUID/correlations/:correlationUID`

Gets a single correlation.

**Example request:**

```http
GET /api/datasources/uid/uyBf2637k/correlations/J6gn7d31L HTTP/1.1
Accept: application/json
Authorization: Bearer eyJrIjoiT0tTcG1pUlY2RnVKZTFVaDFsNFZXdE9ZWmNrMkZYbk
```

**Example response:**

```http
HTTP/1.1 200
Content-Type: application/json
{
  "description": "Logs to Traces",
  "label": "My Label",
  "sourceUID": "uyBf2637k",
  "targetUID": "PDDA8E780A17E7EF1",
  "uid": "J6gn7d31L",
  "config": {
    "type": "query",
    "field": "message",
    "target": {},
  }
}
```

Status codes:

- **200** – OK
- **401** – Unauthorized
- **404** – Not found, either source data source or correlation were not found
- **500** – Internal error

## Get all correlations originating from a given data source

`GET /api/datasources/uid/:sourceUID/correlations`

Get all correlations originating from the data source identified by the given `sourceUID` in the path.

**Example request:**

```http
GET /api/datasources/uid/uyBf2637k/correlations HTTP/1.1
Accept: application/json
Authorization: Bearer eyJrIjoiT0tTcG1pUlY2RnVKZTFVaDFsNFZXdE9ZWmNrMkZYbk
```

**Example response:**

```http
HTTP/1.1 200
Content-Type: application/json
[
  {
    "description": "Logs to Traces",
    "label": "My Label",
    "sourceUID": "uyBf2637k",
    "targetUID": "PDDA8E780A17E7EF1",
    "uid": "J6gn7d31L",
    "config": {
      "type": "query",
      "field": "message",
      "target": {},
    }
  },
  {
    "description": "Logs to Metrics",
    "label": "Another Label",
    "sourceUID": "uyBf2637k",
    "targetUID": "P15396BDD62B2BE29",
    "uid": "uWCpURgVk",
    "config": {
      "type": "query",
      "field": "message",
      "target": {},
    }
  }
]
```

Status codes:

- **200** – OK
- **401** – Unauthorized
- **404** – Not found, either source data source is not found or no correlation exists originating from the given data source
- **500** – Internal error

## Get all correlations

`GET /api/datasources/correlations`

Get all correlations.

**Example request:**

```http
GET /api/datasources/correlations HTTP/1.1
Accept: application/json
Authorization: Bearer eyJrIjoiT0tTcG1pUlY2RnVKZTFVaDFsNFZXdE9ZWmNrMkZYbk
```

**Example response:**

```http
HTTP/1.1 200
Content-Type: application/json
[
  {
    "description": "Prometheus to Loki",
    "label": "My Label",
    "sourceUID": "uyBf2637k",
    "targetUID": "PDDA8E780A17E7EF1",
    "uid": "J6gn7d31L",
    "config": {
      "type": "query",
      "field": "message",
      "target": {},
    }
  },
  {
    "description": "Loki to Tempo",
    "label": "Another Label",
    "sourceUID": "PDDA8E780A17E7EF1",
    "targetUID": "P15396BDD62B2BE29",
    "uid": "uWCpURgVk",
    "config": {
      "type": "query",
      "field": "message",
      "target": {},
    }
  }
]
```

Status codes:

- **200** – OK
- **401** – Unauthorized
- **404** – Not found, no correlation is found
- **500** – Internal error
