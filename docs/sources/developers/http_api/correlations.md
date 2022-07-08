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

`POST /api/datasources/:sourceUid/correlations`

Creates a correlation between two data sources - the source data source indicated by the path UID, and the target data source which is specified in the body.

**Example request:**

```http
POST /api/datasources/uyBf2637k/correlations HTTP/1.1
Accept: application/json
Content-Type: application/json
Authorization: Bearer eyJrIjoiT0tTcG1pUlY2RnVKZTFVaDFsNFZXdE9ZWmNrMkZYbk
{
	"targetUid": "PDDA8E780A17E7EF1",
	"label": "A label",
	"description": "A long description",
	"version": 10
}
```

JSON body schema:

- **targetUid** – Target data source uid.
- **label** – A label for the correlation.
- **description** – A description for the correlation.
- **version** – The source data source version as returned by [Get a single data source by uid](/docs/grafana/latest/http_api/datasource/#get-a-single-data-source-by-uid). If provided Grafana will ensure no concurrent edits are made to the data source.

**Example response:**

```http
HTTP/1.1 200
Content-Type: application/json
{
  "correlation": {
    "target": "PDDA8E780A17E7EF1",
    "label": "A label",
    "description": "A long description",
    "version": 11
  },
  "message": "Correlation created"
}
```

Status codes:

- **200** – OK
- **400** - Errors (invalid JSON, missing or invalid fields)
- **401** – Unauthorized
- **403** – Forbidden, source data source is read-only
- **404** – Not found, either source or target data source could not be found
- **500** – Internal error
