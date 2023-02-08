---
keywords:
  - grafana
  - schema
title: PhlareDataQuery kind
---
> Both documentation generation and kinds schemas are in active development and subject to change without prior notice.

## PhlareDataQuery

#### Maturity: [experimental](../../../maturity/#experimental)
#### Version: 0.0



It extends [DataQuery](#dataquery).

| Property        | Type     | Required | Description                                                                                                                                                                                                                                                                                            |
|-----------------|----------|----------|--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| `groupBy`       | string[] | **Yes**  | Allows to group the results.                                                                                                                                                                                                                                                                           |
| `labelSelector` | string   | **Yes**  | Specifies the query label selectors. Default: `{}`.                                                                                                                                                                                                                                                    |
| `profileTypeId` | string   | **Yes**  | Specifies the type of profile to query.                                                                                                                                                                                                                                                                |
| `refId`         | string   | **Yes**  | *(Inherited from [DataQuery](#dataquery))*<br/>A - Z                                                                                                                                                                                                                                                   |
| `datasource`    |          | No       | *(Inherited from [DataQuery](#dataquery))*<br/>For mixed data sources the selected datasource is on the query level.<br/>For non mixed scenarios this is undefined.<br/>TODO find a better way to do this ^ that's friendly to schema<br/>TODO this shouldn't be unknown but DataSourceRef &#124; null |
| `hide`          | boolean  | No       | *(Inherited from [DataQuery](#dataquery))*<br/>true if query is disabled (ie should not be returned to the dashboard)                                                                                                                                                                                  |
| `key`           | string   | No       | *(Inherited from [DataQuery](#dataquery))*<br/>Unique, guid like, string used in explore mode                                                                                                                                                                                                          |
| `queryType`     | string   | No       | *(Inherited from [DataQuery](#dataquery))*<br/>Specify the query flavor<br/>TODO make this required and give it a default                                                                                                                                                                              |

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


