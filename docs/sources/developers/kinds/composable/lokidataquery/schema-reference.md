---
keywords:
  - grafana
  - schema
title: LokiDataQuery kind
---
> Both documentation generation and kinds schemas are in active development and subject to change without prior notice.

## LokiDataQuery

#### Maturity: [experimental](../../../maturity/#experimental)
#### Version: 0.0



| Property       | Type    | Required | Default | Description                                                                                                                                                                                                                                             |
|----------------|---------|----------|---------|---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| `expr`         | string  | **Yes**  |         | The LogQL query.                                                                                                                                                                                                                                        |
| `refId`        | string  | **Yes**  |         | A unique identifier for the query within the list of targets.<br/>In server side expressions, the refId is used as a variable name to identify results.<br/>By default, the UI will assign A->Z; however setting meaningful names may be useful.        |
| `datasource`   |         | No       |         | For mixed data sources the selected datasource is on the query level.<br/>For non mixed scenarios this is undefined.<br/>TODO find a better way to do this ^ that's friendly to schema<br/>TODO this shouldn't be unknown but DataSourceRef &#124; null |
| `editorMode`   | string  | No       |         | Possible values are: `code`, `builder`.                                                                                                                                                                                                                 |
| `hide`         | boolean | No       |         | true if query is disabled (ie should not be returned to the dashboard)<br/>Note this does not always imply that the query should not be executed since<br/>the results from a hidden query may be used as the input to other queries (SSE etc)          |
| `instant`      | boolean | No       |         | @deprecated, now use queryType.                                                                                                                                                                                                                         |
| `legendFormat` | string  | No       |         | Used to override the name of the series.                                                                                                                                                                                                                |
| `maxLines`     | integer | No       |         | Used to limit the number of log rows returned.                                                                                                                                                                                                          |
| `queryType`    | string  | No       |         | Specify the query flavor<br/>TODO make this required and give it a default                                                                                                                                                                              |
| `range`        | boolean | No       |         | @deprecated, now use queryType.                                                                                                                                                                                                                         |
| `resolution`   | integer | No       |         | Used to scale the interval value.                                                                                                                                                                                                                       |


