---
keywords:
  - grafana
  - schema
title: ElasticsearchDataQuery kind
---
> Both documentation generation and kinds schemas are in active development and subject to change without prior notice.

## ElasticsearchDataQuery

#### Maturity: [experimental](../../../maturity/#experimental)
#### Version: 0.0



| Property     | Type                                      | Required | Default | Description                                                                                                                                                                                                                                             |
|--------------|-------------------------------------------|----------|---------|---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| `refId`      | string                                    | **Yes**  |         | A unique identifier for the query within the list of targets.<br/>In server side expressions, the refId is used as a variable name to identify results.<br/>By default, the UI will assign A->Z; however setting meaningful names may be useful.        |
| `alias`      | string                                    | No       |         | Alias pattern                                                                                                                                                                                                                                           |
| `bucketAggs` | [BucketAggregation](#bucketaggregation)[] | No       |         | List of bucket aggregations                                                                                                                                                                                                                             |
| `datasource` |                                           | No       |         | For mixed data sources the selected datasource is on the query level.<br/>For non mixed scenarios this is undefined.<br/>TODO find a better way to do this ^ that's friendly to schema<br/>TODO this shouldn't be unknown but DataSourceRef &#124; null |
| `hide`       | boolean                                   | No       |         | true if query is disabled (ie should not be returned to the dashboard)<br/>Note this does not always imply that the query should not be executed since<br/>the results from a hidden query may be used as the input to other queries (SSE etc)          |
| `metrics`    | [MetricAggregation](#metricaggregation)[] | No       |         | List of metric aggregations                                                                                                                                                                                                                             |
| `queryType`  | string                                    | No       |         | Specify the query flavor<br/>TODO make this required and give it a default                                                                                                                                                                              |
| `query`      | string                                    | No       |         | Lucene query                                                                                                                                                                                                                                            |
| `timeField`  | string                                    | No       |         | Name of time field                                                                                                                                                                                                                                      |

### BucketAggregation

| Property | Type                                                                                                                                                                | Required | Default | Description |
|----------|---------------------------------------------------------------------------------------------------------------------------------------------------------------------|----------|---------|-------------|
| `object` | Possible types are: [DateHistogram](#datehistogram), [Histogram](#histogram), [Terms](#terms), [Filters](#filters), [GeoHashGrid](#geohashgrid), [Nested](#nested). |          |         |

### DateHistogram

It extends [BucketAggregationWithField](#bucketaggregationwithfield).

| Property   | Type   | Required | Default | Description                                                                                                                                                                        |
|------------|--------|----------|---------|------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| `type`     | string | **Yes**  |         | *(Inherited from [BucketAggregationWithField](#bucketaggregationwithfield))*<br/>Possible values are: `terms`, `filters`, `geohash_grid`, `date_histogram`, `histogram`, `nested`. |
| `field`    | string | No       |         | *(Inherited from [BucketAggregationWithField](#bucketaggregationwithfield))*                                                                                                       |
| `id`       | string | No       |         | *(Inherited from [BucketAggregationWithField](#bucketaggregationwithfield))*                                                                                                       |
| `settings` |        | No       |         | *(Inherited from [BucketAggregationWithField](#bucketaggregationwithfield))*                                                                                                       |

### BucketAggregationWithField

It extends [BaseBucketAggregation](#basebucketaggregation).

| Property   | Type   | Required | Default | Description                                                                                                                                                              |
|------------|--------|----------|---------|--------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| `id`       | string | **Yes**  |         | *(Inherited from [BaseBucketAggregation](#basebucketaggregation))*                                                                                                       |
| `type`     | string | **Yes**  |         | *(Inherited from [BaseBucketAggregation](#basebucketaggregation))*<br/>Possible values are: `terms`, `filters`, `geohash_grid`, `date_histogram`, `histogram`, `nested`. |
| `field`    | string | No       |         |                                                                                                                                                                          |
| `settings` |        | No       |         | *(Inherited from [BaseBucketAggregation](#basebucketaggregation))*                                                                                                       |

### BaseBucketAggregation

| Property   | Type   | Required | Default | Description                                                                                       |
|------------|--------|----------|---------|---------------------------------------------------------------------------------------------------|
| `id`       | string | **Yes**  |         |                                                                                                   |
| `type`     | string | **Yes**  |         | Possible values are: `terms`, `filters`, `geohash_grid`, `date_histogram`, `histogram`, `nested`. |
| `settings` |        | No       |         |                                                                                                   |

### Filters

It extends [BaseBucketAggregation](#basebucketaggregation).

| Property   | Type   | Required | Default | Description                                                                                                                                                              |
|------------|--------|----------|---------|--------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| `id`       | string | **Yes**  |         | *(Inherited from [BaseBucketAggregation](#basebucketaggregation))*                                                                                                       |
| `type`     | string | **Yes**  |         | *(Inherited from [BaseBucketAggregation](#basebucketaggregation))*<br/>Possible values are: `terms`, `filters`, `geohash_grid`, `date_histogram`, `histogram`, `nested`. |
| `settings` |        | No       |         | *(Inherited from [BaseBucketAggregation](#basebucketaggregation))*                                                                                                       |

### GeoHashGrid

It extends [BucketAggregationWithField](#bucketaggregationwithfield).

| Property   | Type   | Required | Default | Description                                                                                                                                                                        |
|------------|--------|----------|---------|------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| `type`     | string | **Yes**  |         | *(Inherited from [BucketAggregationWithField](#bucketaggregationwithfield))*<br/>Possible values are: `terms`, `filters`, `geohash_grid`, `date_histogram`, `histogram`, `nested`. |
| `field`    | string | No       |         | *(Inherited from [BucketAggregationWithField](#bucketaggregationwithfield))*                                                                                                       |
| `id`       | string | No       |         | *(Inherited from [BucketAggregationWithField](#bucketaggregationwithfield))*                                                                                                       |
| `settings` |        | No       |         | *(Inherited from [BucketAggregationWithField](#bucketaggregationwithfield))*                                                                                                       |

### Histogram

It extends [BucketAggregationWithField](#bucketaggregationwithfield).

| Property   | Type   | Required | Default | Description                                                                                                                                                                        |
|------------|--------|----------|---------|------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| `type`     | string | **Yes**  |         | *(Inherited from [BucketAggregationWithField](#bucketaggregationwithfield))*<br/>Possible values are: `terms`, `filters`, `geohash_grid`, `date_histogram`, `histogram`, `nested`. |
| `field`    | string | No       |         | *(Inherited from [BucketAggregationWithField](#bucketaggregationwithfield))*                                                                                                       |
| `id`       | string | No       |         | *(Inherited from [BucketAggregationWithField](#bucketaggregationwithfield))*                                                                                                       |
| `settings` |        | No       |         | *(Inherited from [BucketAggregationWithField](#bucketaggregationwithfield))*                                                                                                       |

### Nested

It extends [BucketAggregationWithField](#bucketaggregationwithfield).

| Property   | Type   | Required | Default | Description                                                                                                                                                                        |
|------------|--------|----------|---------|------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| `type`     | string | **Yes**  |         | *(Inherited from [BucketAggregationWithField](#bucketaggregationwithfield))*<br/>Possible values are: `terms`, `filters`, `geohash_grid`, `date_histogram`, `histogram`, `nested`. |
| `field`    | string | No       |         | *(Inherited from [BucketAggregationWithField](#bucketaggregationwithfield))*                                                                                                       |
| `id`       | string | No       |         | *(Inherited from [BucketAggregationWithField](#bucketaggregationwithfield))*                                                                                                       |
| `settings` |        | No       |         | *(Inherited from [BucketAggregationWithField](#bucketaggregationwithfield))*                                                                                                       |

### Terms

It extends [BucketAggregationWithField](#bucketaggregationwithfield).

| Property   | Type   | Required | Default | Description                                                                                                                                                                        |
|------------|--------|----------|---------|------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| `type`     | string | **Yes**  |         | *(Inherited from [BucketAggregationWithField](#bucketaggregationwithfield))*<br/>Possible values are: `terms`, `filters`, `geohash_grid`, `date_histogram`, `histogram`, `nested`. |
| `field`    | string | No       |         | *(Inherited from [BucketAggregationWithField](#bucketaggregationwithfield))*                                                                                                       |
| `id`       | string | No       |         | *(Inherited from [BucketAggregationWithField](#bucketaggregationwithfield))*                                                                                                       |
| `settings` |        | No       |         | *(Inherited from [BucketAggregationWithField](#bucketaggregationwithfield))*                                                                                                       |

### MetricAggregation

| Property | Type                                                                                                 | Required | Default | Description |
|----------|------------------------------------------------------------------------------------------------------|----------|---------|-------------|
| `object` | Possible types are: [Count](#count), [PipelineMetricAggregation](#pipelinemetricaggregation), [](#). |          |         |

### Count

It extends [BaseMetricAggregation](#basemetricaggregation).

| Property | Type    | Required | Default | Description                                                                                                                                                                                                                                                                                                                            |
|----------|---------|----------|---------|----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| `id`     | string  | **Yes**  |         | *(Inherited from [BaseMetricAggregation](#basemetricaggregation))*                                                                                                                                                                                                                                                                     |
| `type`   | string  | **Yes**  |         | *(Inherited from [BaseMetricAggregation](#basemetricaggregation))*<br/>Possible values are: `count`, `avg`, `sum`, `min`, `max`, `extended_stats`, `percentiles`, `cardinality`, `raw_document`, `raw_data`, `logs`, `rate`, `top_metrics`, `moving_avg`, `moving_fn`, `derivative`, `serial_diff`, `cumulative_sum`, `bucket_script`. |
| `hide`   | boolean | No       |         | *(Inherited from [BaseMetricAggregation](#basemetricaggregation))*                                                                                                                                                                                                                                                                     |

### BaseMetricAggregation

| Property | Type    | Required | Default | Description                                                                                                                                                                                                                                                     |
|----------|---------|----------|---------|-----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| `id`     | string  | **Yes**  |         |                                                                                                                                                                                                                                                                 |
| `type`   | string  | **Yes**  |         | Possible values are: `count`, `avg`, `sum`, `min`, `max`, `extended_stats`, `percentiles`, `cardinality`, `raw_document`, `raw_data`, `logs`, `rate`, `top_metrics`, `moving_avg`, `moving_fn`, `derivative`, `serial_diff`, `cumulative_sum`, `bucket_script`. |
| `hide`   | boolean | No       |         |                                                                                                                                                                                                                                                                 |

### PipelineMetricAggregation

| Property | Type                                                                                                                                            | Required | Default | Description |
|----------|-------------------------------------------------------------------------------------------------------------------------------------------------|----------|---------|-------------|
| `object` | Possible types are: [MovingAverage](#movingaverage), [Derivative](#derivative), [CumulativeSum](#cumulativesum), [BucketScript](#bucketscript). |          |         |

### BucketScript

It extends [PipelineMetricAggregationWithMultipleBucketPaths](#pipelinemetricaggregationwithmultiplebucketpaths).

| Property            | Type                                    | Required | Default | Description                                                                                                                                                                                                                                                                                                                                                                                  |
|---------------------|-----------------------------------------|----------|---------|----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| `type`              | string                                  | **Yes**  |         | *(Inherited from [PipelineMetricAggregationWithMultipleBucketPaths](#pipelinemetricaggregationwithmultiplebucketpaths))*<br/>Possible values are: `count`, `avg`, `sum`, `min`, `max`, `extended_stats`, `percentiles`, `cardinality`, `raw_document`, `raw_data`, `logs`, `rate`, `top_metrics`, `moving_avg`, `moving_fn`, `derivative`, `serial_diff`, `cumulative_sum`, `bucket_script`. |
| `hide`              | boolean                                 | No       |         | *(Inherited from [PipelineMetricAggregationWithMultipleBucketPaths](#pipelinemetricaggregationwithmultiplebucketpaths))*                                                                                                                                                                                                                                                                     |
| `id`                | string                                  | No       |         | *(Inherited from [PipelineMetricAggregationWithMultipleBucketPaths](#pipelinemetricaggregationwithmultiplebucketpaths))*                                                                                                                                                                                                                                                                     |
| `pipelineVariables` | [PipelineVariable](#pipelinevariable)[] | No       |         | *(Inherited from [PipelineMetricAggregationWithMultipleBucketPaths](#pipelinemetricaggregationwithmultiplebucketpaths))*                                                                                                                                                                                                                                                                     |
| `settings`          | [object](#settings)                     | No       |         |                                                                                                                                                                                                                                                                                                                                                                                              |

### PipelineMetricAggregationWithMultipleBucketPaths

It extends [BaseMetricAggregation](#basemetricaggregation).

| Property            | Type                                    | Required | Default | Description                                                                                                                                                                                                                                                                                                                            |
|---------------------|-----------------------------------------|----------|---------|----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| `id`                | string                                  | **Yes**  |         | *(Inherited from [BaseMetricAggregation](#basemetricaggregation))*                                                                                                                                                                                                                                                                     |
| `type`              | string                                  | **Yes**  |         | *(Inherited from [BaseMetricAggregation](#basemetricaggregation))*<br/>Possible values are: `count`, `avg`, `sum`, `min`, `max`, `extended_stats`, `percentiles`, `cardinality`, `raw_document`, `raw_data`, `logs`, `rate`, `top_metrics`, `moving_avg`, `moving_fn`, `derivative`, `serial_diff`, `cumulative_sum`, `bucket_script`. |
| `hide`              | boolean                                 | No       |         | *(Inherited from [BaseMetricAggregation](#basemetricaggregation))*                                                                                                                                                                                                                                                                     |
| `pipelineVariables` | [PipelineVariable](#pipelinevariable)[] | No       |         |                                                                                                                                                                                                                                                                                                                                        |

### PipelineVariable

| Property      | Type   | Required | Default | Description |
|---------------|--------|----------|---------|-------------|
| `name`        | string | **Yes**  |         |             |
| `pipelineAgg` | string | **Yes**  |         |             |

### Settings

| Property | Type | Required | Default | Description |
|----------|------|----------|---------|-------------|
| `script` |      | No       |         |             |

### CumulativeSum

It extends [BasePipelineMetricAggregation](#basepipelinemetricaggregation).

| Property      | Type                | Required | Default | Description                                                                                                                                                                                                                                                                                                                                            |
|---------------|---------------------|----------|---------|--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| `type`        | string              | **Yes**  |         | *(Inherited from [BasePipelineMetricAggregation](#basepipelinemetricaggregation))*<br/>Possible values are: `count`, `avg`, `sum`, `min`, `max`, `extended_stats`, `percentiles`, `cardinality`, `raw_document`, `raw_data`, `logs`, `rate`, `top_metrics`, `moving_avg`, `moving_fn`, `derivative`, `serial_diff`, `cumulative_sum`, `bucket_script`. |
| `field`       | string              | No       |         | *(Inherited from [BasePipelineMetricAggregation](#basepipelinemetricaggregation))*                                                                                                                                                                                                                                                                     |
| `hide`        | boolean             | No       |         | *(Inherited from [BasePipelineMetricAggregation](#basepipelinemetricaggregation))*                                                                                                                                                                                                                                                                     |
| `id`          | string              | No       |         | *(Inherited from [BasePipelineMetricAggregation](#basepipelinemetricaggregation))*                                                                                                                                                                                                                                                                     |
| `pipelineAgg` | string              | No       |         | *(Inherited from [BasePipelineMetricAggregation](#basepipelinemetricaggregation))*                                                                                                                                                                                                                                                                     |
| `settings`    | [object](#settings) | No       |         |                                                                                                                                                                                                                                                                                                                                                        |

### BasePipelineMetricAggregation

It extends [MetricAggregationWithField](#metricaggregationwithfield).

| Property      | Type    | Required | Default | Description                                                                                                                                                                                                                                                                                                                                      |
|---------------|---------|----------|---------|--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| `type`        | string  | **Yes**  |         | *(Inherited from [MetricAggregationWithField](#metricaggregationwithfield))*<br/>Possible values are: `count`, `avg`, `sum`, `min`, `max`, `extended_stats`, `percentiles`, `cardinality`, `raw_document`, `raw_data`, `logs`, `rate`, `top_metrics`, `moving_avg`, `moving_fn`, `derivative`, `serial_diff`, `cumulative_sum`, `bucket_script`. |
| `field`       | string  | No       |         | *(Inherited from [MetricAggregationWithField](#metricaggregationwithfield))*                                                                                                                                                                                                                                                                     |
| `hide`        | boolean | No       |         | *(Inherited from [MetricAggregationWithField](#metricaggregationwithfield))*                                                                                                                                                                                                                                                                     |
| `id`          | string  | No       |         | *(Inherited from [MetricAggregationWithField](#metricaggregationwithfield))*                                                                                                                                                                                                                                                                     |
| `pipelineAgg` | string  | No       |         |                                                                                                                                                                                                                                                                                                                                                  |

### MetricAggregationWithField

It extends [BaseMetricAggregation](#basemetricaggregation).

| Property | Type    | Required | Default | Description                                                                                                                                                                                                                                                                                                                            |
|----------|---------|----------|---------|----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| `id`     | string  | **Yes**  |         | *(Inherited from [BaseMetricAggregation](#basemetricaggregation))*                                                                                                                                                                                                                                                                     |
| `type`   | string  | **Yes**  |         | *(Inherited from [BaseMetricAggregation](#basemetricaggregation))*<br/>Possible values are: `count`, `avg`, `sum`, `min`, `max`, `extended_stats`, `percentiles`, `cardinality`, `raw_document`, `raw_data`, `logs`, `rate`, `top_metrics`, `moving_avg`, `moving_fn`, `derivative`, `serial_diff`, `cumulative_sum`, `bucket_script`. |
| `field`  | string  | No       |         |                                                                                                                                                                                                                                                                                                                                        |
| `hide`   | boolean | No       |         | *(Inherited from [BaseMetricAggregation](#basemetricaggregation))*                                                                                                                                                                                                                                                                     |

### Settings

| Property | Type   | Required | Default | Description |
|----------|--------|----------|---------|-------------|
| `format` | string | No       |         |             |

### Derivative

It extends [BasePipelineMetricAggregation](#basepipelinemetricaggregation).

| Property      | Type                | Required | Default | Description                                                                                                                                                                                                                                                                                                                                            |
|---------------|---------------------|----------|---------|--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| `type`        | string              | **Yes**  |         | *(Inherited from [BasePipelineMetricAggregation](#basepipelinemetricaggregation))*<br/>Possible values are: `count`, `avg`, `sum`, `min`, `max`, `extended_stats`, `percentiles`, `cardinality`, `raw_document`, `raw_data`, `logs`, `rate`, `top_metrics`, `moving_avg`, `moving_fn`, `derivative`, `serial_diff`, `cumulative_sum`, `bucket_script`. |
| `field`       | string              | No       |         | *(Inherited from [BasePipelineMetricAggregation](#basepipelinemetricaggregation))*                                                                                                                                                                                                                                                                     |
| `hide`        | boolean             | No       |         | *(Inherited from [BasePipelineMetricAggregation](#basepipelinemetricaggregation))*                                                                                                                                                                                                                                                                     |
| `id`          | string              | No       |         | *(Inherited from [BasePipelineMetricAggregation](#basepipelinemetricaggregation))*                                                                                                                                                                                                                                                                     |
| `pipelineAgg` | string              | No       |         | *(Inherited from [BasePipelineMetricAggregation](#basepipelinemetricaggregation))*                                                                                                                                                                                                                                                                     |
| `settings`    | [object](#settings) | No       |         |                                                                                                                                                                                                                                                                                                                                                        |

### Settings

| Property | Type   | Required | Default | Description |
|----------|--------|----------|---------|-------------|
| `unit`   | string | No       |         |             |

### MovingAverage

#MovingAverage's settings are overridden in types.ts

It extends [BasePipelineMetricAggregation](#basepipelinemetricaggregation).

| Property      | Type                | Required | Default | Description                                                                                                                                                                                                                                                                                                                                            |
|---------------|---------------------|----------|---------|--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| `type`        | string              | **Yes**  |         | *(Inherited from [BasePipelineMetricAggregation](#basepipelinemetricaggregation))*<br/>Possible values are: `count`, `avg`, `sum`, `min`, `max`, `extended_stats`, `percentiles`, `cardinality`, `raw_document`, `raw_data`, `logs`, `rate`, `top_metrics`, `moving_avg`, `moving_fn`, `derivative`, `serial_diff`, `cumulative_sum`, `bucket_script`. |
| `field`       | string              | No       |         | *(Inherited from [BasePipelineMetricAggregation](#basepipelinemetricaggregation))*                                                                                                                                                                                                                                                                     |
| `hide`        | boolean             | No       |         | *(Inherited from [BasePipelineMetricAggregation](#basepipelinemetricaggregation))*                                                                                                                                                                                                                                                                     |
| `id`          | string              | No       |         | *(Inherited from [BasePipelineMetricAggregation](#basepipelinemetricaggregation))*                                                                                                                                                                                                                                                                     |
| `pipelineAgg` | string              | No       |         | *(Inherited from [BasePipelineMetricAggregation](#basepipelinemetricaggregation))*                                                                                                                                                                                                                                                                     |
| `settings`    | [object](#settings) | No       |         |                                                                                                                                                                                                                                                                                                                                                        |

### Settings

| Property | Type | Required | Default | Description |
|----------|------|----------|---------|-------------|

### Meta

| Property | Type | Required | Default | Description |
|----------|------|----------|---------|-------------|

### Settings

| Property  | Type     | Required | Default | Description |
|-----------|----------|----------|---------|-------------|
| `metrics` | string[] | No       |         |             |
| `orderBy` | string   | No       |         |             |
| `order`   | string   | No       |         |             |


