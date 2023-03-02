---
keywords:
  - grafana
  - schema
title: LokiDataSourceCfg kind
---
> Both documentation generation and kinds schemas are in active development and subject to change without prior notice.

## LokiDataSourceCfg

#### Maturity: [experimental](../../../maturity/#experimental)
#### Version: 0.0



| Property  | Type               | Required | Description |
|-----------|--------------------|----------|-------------|
| `Options` | [object](#options) | **Yes**  |             |

### Options

It extends [DataSourceJsonData](#datasourcejsondata).

| Property          | Type                                                          | Required | Description                                                                                           |
|-------------------|---------------------------------------------------------------|----------|-------------------------------------------------------------------------------------------------------|
| `alertmanagerUid` | string                                                        | No       | *(Inherited from [DataSourceJsonData](#datasourcejsondata))*                                          |
| `alertmanager`    | string                                                        | No       |                                                                                                       |
| `authType`        | string                                                        | No       | *(Inherited from [DataSourceJsonData](#datasourcejsondata))*                                          |
| `defaultRegion`   | string                                                        | No       | *(Inherited from [DataSourceJsonData](#datasourcejsondata))*                                          |
| `derivedFields`   | [Options.#DerivedFieldConfig](#options.#derivedfieldconfig)[] | No       | Derived fields can be used to extract new fields from a log message and create a link from its value. |
| `keepCookies`     | string[]                                                      | No       | Specify cookies by name that should be forwarded to the data source                                   |
| `manageAlerts`    | boolean                                                       | No       | *(Inherited from [DataSourceJsonData](#datasourcejsondata))*                                          |
| `maxLines`        | string                                                        | No       | Used to set default value for line limit                                                              |
| `profile`         | string                                                        | No       | *(Inherited from [DataSourceJsonData](#datasourcejsondata))*                                          |

### DataSourceJsonData

TODO docs

| Property          | Type    | Required | Description |
|-------------------|---------|----------|-------------|
| `alertmanagerUid` | string  | No       |             |
| `authType`        | string  | No       |             |
| `defaultRegion`   | string  | No       |             |
| `manageAlerts`    | boolean | No       |             |
| `profile`         | string  | No       |             |

### Options.#DerivedFieldConfig

| Property          | Type   | Required | Description |
|-------------------|--------|----------|-------------|
| `matcherRegex`    | string | **Yes**  |             |
| `name`            | string | **Yes**  |             |
| `datasourceUid`   | string | No       |             |
| `urlDisplayLabel` | string | No       |             |
| `url`             | string | No       |             |


