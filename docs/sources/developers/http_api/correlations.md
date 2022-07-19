---
aliases:
  - /docs/grafana/latest/developers/http_api/correlations/
  - /docs/grafana/latest/http_api/correlations/
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

`POST /api/datasources/uid/:sourceUid/correlations`

Creates a correlation between two data sources - the source data source indicated by the path UID, and the target data source which is specified in the body.

**Example request:**

```http
POST /api/datasources/uid/uyBf2637k/correlations HTTP/1.1
Accept: application/json
Content-Type: application/json
Authorization: Bearer eyJrIjoiT0tTcG1pUlY2RnVKZTFVaDFsNFZXdE9ZWmNrMkZYbk
{
	"targetUid": "PDDA8E780A17E7EF1",
	"label": "My Label",
	"description": "Logs to Traces",
}
```

JSON body schema:

- **targetUid** – Target data source uid.
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
    "sourceUid": "uyBf2637k",
    "targetUid": "PDDA8E780A17E7EF1",
    "uid": "50xhMlg9k"
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

`DELETE /api/datasources/uid/:uid/correlation/:correlationUid`

Deletes a correlation.

**Example request:**

```http
DELETE /api/datasources/uid/uyBf2637k/correlation/J6gn7d31L HTTP/1.1
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
