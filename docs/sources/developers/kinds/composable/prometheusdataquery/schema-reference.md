---
keywords:
  - grafana
  - schema
title: PrometheusDataQuery kind
---
> Both documentation generation and kinds schemas are in active development and subject to change without prior notice.

## PrometheusDataQuery

#### Maturity: [experimental](../../../maturity/#experimental)
#### Version: 0.0



It extends [DataQuery](#dataquery).

| Property     | Type    | Required | Description                                                                                                                                                                                                                                                                                            |
|--------------|---------|----------|--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| `expr`       | string  | **Yes**  | The actual expression/query that will be evaluated by Prometheus                                                                                                                                                                                                                                       |
| `refId`      | string  | **Yes**  | *(Inherited from [DataQuery](#dataquery))*<br/>A unique identifier for the query within the list of targets.<br/>In server side expressions, the refId is used as a variable name to identify results.<br/>By default, the UI will assign A->Z; however setting meaningful names may be useful.        |
| `datasource` |         | No       | *(Inherited from [DataQuery](#dataquery))*<br/>For mixed data sources the selected datasource is on the query level.<br/>For non mixed scenarios this is undefined.<br/>TODO find a better way to do this ^ that's friendly to schema<br/>TODO this shouldn't be unknown but DataSourceRef &#124; null |
| `editorMode` | string  | No       | Possible values are: `code`, `builder`.                                                                                                                                                                                                                                                                |
| `exemplar`   | boolean | No       | Execute an additional query to identify interesting raw samples relevant for the given expr                                                                                                                                                                                                            |
| `format`     | string  | No       | Possible values are: `time_series`, `table`, `heatmap`.                                                                                                                                                                                                                                                |
| `hide`       | boolean | No       | *(Inherited from [DataQuery](#dataquery))*<br/>true if query is disabled (ie should not be returned to the dashboard)<br/>Note this does not always imply that the query should not be executed since<br/>the results from a hidden query may be used as the input to other queries (SSE etc)          |
| `instant`    | boolean | No       | Returns only the latest value that Prometheus has scraped for the requested time series                                                                                                                                                                                                                |
| `queryType`  | string  | No       | *(Inherited from [DataQuery](#dataquery))*<br/>Specify the query flavor<br/>TODO make this required and give it a default                                                                                                                                                                              |
| `range`      | boolean | No       | Returns a Range vector, comprised of a set of time series containing a range of data points over time for each time series                                                                                                                                                                             |

### DataQuery

These are the common properties available to all queries in all datasources.
Specific implementations will *extend* this interface, adding the required
properties for the given context.

| Property     | Type    | Required | Description                                                                                                                                                                                                                                             |
|--------------|---------|----------|---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| `refId`      | string  | **Yes**  | A unique identifier for the query within the list of targets.<br/>In server side expressions, the refId is used as a variable name to identify results.<br/>By default, the UI will assign A->Z; however setting meaningful names may be useful.        |
| `datasource` |         | No       | For mixed data sources the selected datasource is on the query level.<br/>For non mixed scenarios this is undefined.<br/>TODO find a better way to do this ^ that's friendly to schema<br/>TODO this shouldn't be unknown but DataSourceRef &#124; null |
| `hide`       | boolean | No       | true if query is disabled (ie should not be returned to the dashboard)<br/>Note this does not always imply that the query should not be executed since<br/>the results from a hidden query may be used as the input to other queries (SSE etc)          |
| `queryType`  | string  | No       | Specify the query flavor<br/>TODO make this required and give it a default                                                                                                                                                                              |


