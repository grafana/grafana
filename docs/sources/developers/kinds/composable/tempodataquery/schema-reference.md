---
keywords:
  - grafana
  - schema
title: TempoDataQuery kind
---
> Both documentation generation and kinds schemas are in active development and subject to change without prior notice.

# TempoDataQuery kind

## Maturity: experimental
## Version: 0.0

## Properties

| Property          | Type   | Required | Description                                                                                                          |
|-------------------|--------|----------|----------------------------------------------------------------------------------------------------------------------|
| `limit`           | number | No       | Defines the maximum number of traces that are returned from Tempo                                                    |
| `maxDuration`     | string | No       | Define the maximum duration to select traces. Use duration format, for example: 1.2s, 100ms                          |
| `minDuration`     | string | No       | Define the minimum duration to select traces. Use duration format, for example: 1.2s, 100ms                          |
| `query`           | string | No       | TraceQL query or trace ID                                                                                            |
| `search`          | string | No       | Logfmt query to filter traces by their tags. Example: http.status_code=200 error=true                                |
| `serviceMapQuery` | string | No       | Filters to be included in a PromQL query to select data for the service graph. Example: {client="app",service="app"} |
| `serviceName`     | string | No       | Query traces by service name                                                                                         |
| `spanName`        | string | No       | Query traces by span name                                                                                            |


