---
keywords:
  - grafana
  - schema
title: TempoDataQuery kind
---
> Both documentation generation and kinds schemas are in active development and subject to change without prior notice.

## TempoDataQuery

#### Maturity: [experimental](../../../maturity/#experimental)
#### Version: 0.0



It extends [DataQuery](#dataquery).

| Property          | Type    | Required | Description                                                                                                                                                                                                                                                                                            |
|-------------------|---------|----------|--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| `query`           | string  | **Yes**  | TraceQL query or trace ID                                                                                                                                                                                                                                                                              |
| `refId`           | string  | **Yes**  | *(Inherited from [DataQuery](#dataquery))*<br/>A - Z                                                                                                                                                                                                                                                   |
| `datasource`      |         | No       | *(Inherited from [DataQuery](#dataquery))*<br/>For mixed data sources the selected datasource is on the query level.<br/>For non mixed scenarios this is undefined.<br/>TODO find a better way to do this ^ that's friendly to schema<br/>TODO this shouldn't be unknown but DataSourceRef &#124; null |
| `hide`            | boolean | No       | *(Inherited from [DataQuery](#dataquery))*<br/>true if query is disabled (ie should not be returned to the dashboard)                                                                                                                                                                                  |
| `key`             | string  | No       | *(Inherited from [DataQuery](#dataquery))*<br/>Unique, guid like, string used in explore mode                                                                                                                                                                                                          |
| `limit`           | integer | No       | Defines the maximum number of traces that are returned from Tempo                                                                                                                                                                                                                                      |
| `maxDuration`     | string  | No       | Define the maximum duration to select traces. Use duration format, for example: 1.2s, 100ms                                                                                                                                                                                                            |
| `minDuration`     | string  | No       | Define the minimum duration to select traces. Use duration format, for example: 1.2s, 100ms                                                                                                                                                                                                            |
| `queryType`       | string  | No       | *(Inherited from [DataQuery](#dataquery))*<br/>Specify the query flavor<br/>TODO make this required and give it a default                                                                                                                                                                              |
| `search`          | string  | No       | Logfmt query to filter traces by their tags. Example: http.status_code=200 error=true                                                                                                                                                                                                                  |
| `serviceMapQuery` | string  | No       | Filters to be included in a PromQL query to select data for the service graph. Example: {client="app",service="app"}                                                                                                                                                                                   |
| `serviceName`     | string  | No       | Query traces by service name                                                                                                                                                                                                                                                                           |
| `spanName`        | string  | No       | Query traces by span name                                                                                                                                                                                                                                                                              |

### DataQuery

These are the common properties available to all queries in all datasources.
Specific implementations will *extend* this interface, adding the required
properties for the given context.

| Property     | Type    | Required | Description                                                                                                                                                                                                                                             |
|--------------|---------|----------|---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| `refId`      | string  | **Yes**  | A - Z                                                                                                                                                                                                                                                   |
| `datasource` |         | No       | For mixed data sources the selected datasource is on the query level.<br/>For non mixed scenarios this is undefined.<br/>TODO find a better way to do this ^ that's friendly to schema<br/>TODO this shouldn't be unknown but DataSourceRef &#124; null |
| `hide`       | boolean | No       | true if query is disabled (ie should not be returned to the dashboard)                                                                                                                                                                                  |
| `key`        | string  | No       | Unique, guid like, string used in explore mode                                                                                                                                                                                                          |
| `queryType`  | string  | No       | Specify the query flavor<br/>TODO make this required and give it a default                                                                                                                                                                              |


