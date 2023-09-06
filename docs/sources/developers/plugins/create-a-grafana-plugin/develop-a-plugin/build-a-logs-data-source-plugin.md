---
aliases:
  - ../../../plugins/build-a-logs-data-source-plugin/
description: How to build a logs data source plugin.
keywords:
  - grafana
  - plugins
  - plugin
  - logs
  - logs data source
  - datasource
labels:
  products:
    - enterprise
    - oss
title: Build a logs data source plugin
weight: 500
---

# Build a logs data source plugin

Grafana data source plugins support metrics, logs, and other data types. The steps to build a logs data source plugin are largely the same as for a metrics data source, but there are a few differences which we will explain in this guide.

## Before you begin

This guide assumes that you're already familiar with how to [Build a data source plugin]({{< relref "./build-a-data-source-plugin" >}}) for metrics. We recommend that you review this material before continuing.

## Add logs support to your data source

To add logs support to an existing data source, you need to:

1. Enable logs support
1. Construct the log data frame

When these steps are done, then you can improve the user experience with one or more [optional features](#enhance-your-logs-data-source-plugin-with-optional-features).

### Step 1: Enable logs support

Tell Grafana that your data source plugin can return log data, by adding `"logs": true` to the [plugin.json]({{< relref "../../metadata.md" >}}) file.

```json
{
  "logs": true
}
```

### Step 2: Construct the log data frame

### Logs data frame format

The log data frame should include following fields:

| Field name     | Field type                                      | Required field | Description                                                                                                                                                                                                                                   |
| -------------- | ----------------------------------------------- | -------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **timestamp**  | `time`                                          | required       | Timestamp, non-nullable.                                                                                                                                                                                                                      |
| **body**       | `string`                                        | required       | Content of the log line, non-nullable.                                                                                                                                                                                                        |
| **severity**   | `string`                                        | optional       | Severity/level of the log line. If no severity field is found, consumers/client will decide the log level. More information about log levels, refer to [Logs integration](https://grafana.com/docs/grafana/latest/explore/logs-integration/). |
| **id**         | `string`                                        | optional       | Unique identifier of the log line.                                                                                                                                                                                                            |
| **attributes** | `json raw message` (Go) or `other` (TypeScript) | optional       | Additional attributes of the log line. Other systems may refer to this with different names, such as "Labels" in Loki. Represent its value as Record<string,any> type in JavaScript.                                                          |

Logs data frame's `type` needs to be set to `type: DataFrameType.LogLines` in data frame's meta.

**Example of constructing a logs data frame in Go:**

```go
frame := data.NewFrame(
   "logs",
  data.NewField("timestamp", nil, []time.Time{time.UnixMilli(1645030244810), time.UnixMilli(1645030247027), time.UnixMilli(1645030247027)}),
  data.NewField("body", nil, []string{"message one", "message two", "message three"}),
  data.NewField("severity", nil, []string{"critical", "error", "warning"}),
  data.NewField("id", nil, []string{"xxx-001", "xyz-002", "111-003"}),
  data.NewField("attributes", nil, []json.RawMessage{[]byte(`{}`), []byte(`{"hello":"world"}`), []byte(`{"hello":"world", "foo": 123.45, "bar" :["yellow","red"], "baz" : { "name": "alice" }}`)}),
)

frame.SetMeta(&data.FrameMeta{
	Type:   data.FrameTypeLogLines,
})
```

**Example of constructing a logs data frame in TypeScript:**

```ts
import { createDataFrame, DataFrameType, FieldType } from '@grafana/data';

const result = createDataFrame({
  fields: [
    { name: 'timestamp', type: FieldType.time, values: [1645030244810, 1645030247027, 1645030247027] },
    { name: 'body', type: FieldType.string, values: ['message one', 'message two', 'message three'] },
    { name: 'severity', type: FieldType.string, values: ['critical', 'error', 'warning'] },
    { name: 'id', type: FieldType.string, values: ['xxx-001', 'xyz-002', '111-003'] },
    {
      name: 'attributes',
      type: FieldType.other,
      values: [{}, { hello: 'world' }, { hello: 'world', foo: 123.45, bar: ['yellow', 'red'], baz: { name: 'alice' } }],
    },
  ],
  meta: {
    type: DataFrameType.LogLines,
  },
});
```

## Enhance your logs data source plugin with optional features

You can use the following optional features to enhance your logs data source plugin.

### Implement features that enhance log querying experience in Explore

[Explore]({{< relref "../../../../explore" >}}) provides a useful interface for investigating incidents and troubleshooting logs. If the data source produces log results, we highly recommend implementing the following APIs to allow your users to get the most out of the logs UI and its features within Explore.

The following steps show the process for adding support for Explore features in a data source plugin through a seamless integration. Implement these APIs to enhance the user experience and take advantage of Explore's powerful log investigation capabilities.

#### Show log results in Explore's Logs view

To ensure that your log results are displayed in an interactive Logs view, you must add a `meta` attribute to `preferredVisualisationType` in your log result data frame.

**Example in Go:**

```go
frame.Meta = &data.FrameMeta{
	PreferredVisualization: "logs",
}
```

**Example in TypeScript:**

```ts
import { createDataFrame } from '@grafana/data';

const result = createDataFrame({
    fields: [...],
    meta: {
        preferredVisualisationType: 'logs',
    },
});
```

#### Highlight searched words

{{% admonition type="note" %}} This feature must be implemented in the data frame as a meta attribute. {{%
/admonition %}}

The logs visualization can [highlight specific words or strings]({{< relref "../../../../explore/logs-integration/#highlight-searched-words" >}}) in log entries. This feature is typically used for highlighting search terms, making it easier for users to locate and focus on relevant information in the logs. For the highlighting to work, you must include search words in the data frame's `meta` information.

**Example in Go:**

```go
frame.Meta = &data.FrameMeta{
	Custom: map[string]interface{}{
    "searchWords": []string{"foo", "bar", "baz"} ,
  }
}
```

**Example in TypeScript:**

```ts
import { createDataFrame } from '@grafana/data';

const result = createDataFrame({
    fields: [...],
    meta: {
      custom: {
        searchWords: ["foo", "bar", "baz"],
      }
    },
});
```

#### Log result `meta` information

{{% admonition type="note" %}} This feature must be implemented in the data frame as a meta attribute, or in the data frame as a field. {{%
/admonition %}}

[Log result meta information]({{< relref "../../../../explore/logs-integration/#log-result-meta-information" >}}) can be used to communicate information about logs results to the user. The following information can be shared with the user:

- **Count of received logs vs limit** - Displays the count of received logs compared to the specified limit. Data frames should set a limit with a meta attribute for the number of requested log lines.
- **Error**: Displays possible errors in your log results. Data frames should to have an `error` in the `meta` attribute.
- **Common labels**: Displays attributes present in the `attributes` data frame field that are the same for all displayed log lines. This feature is supported for data sources that produce log data frames with an attributes field. Refer to [Logs data frame format](#logs-data-frame-format) for more information.

**Example in Go:**

```go
frame.Meta = &data.FrameMeta{
	Custom: map[string]interface{}{
    "limit": 1000,
    "error": "Error information",
  }
}
```

**Example in TypeScript:**

```ts
import { createDataFrame } from '@grafana/data';

const result = createDataFrame({
    fields: [...],
    meta: {
      custom: {
        limit: 1000,
        error: "Error information"
      }
    },
});
```

### Logs to trace using data link with url

If your log data contains **trace IDs**, you can enhance your log data frames by adding a field with _trace ID values_ and _URL data links_. These links should use the trace ID value to accurately link to the appropriate trace. This enhancement enables users to seamlessly move from log lines to the relevant traces.

**Example in TypeScript:**

```ts
import { createDataFrame, FieldType } from '@grafana/data';

const result = createDataFrame({
  fields: [
    ...,
    { name: 'traceID',
      type: FieldType.string,
      values: ['a006649127e371903a2de979', 'e206649127z371903c3be12q' 'k777549127c371903a2lw34'],
      config: {
        links: [
          {
            // Be sure to adjust this example based on your data source logic.
            title: 'Trace view',
            url: `http://linkToTraceID/${__value.raw}` // ${__value.raw} is a variable that will be replaced with actual traceID value.
          }
        ]
      }
    }
  ],
  ...,
});
```

#### Color-coded log levels

{{% admonition type="note" %}} This feature must be implemented in the data frame as a field. {{%
/admonition %}}

Color-coded [log levels]({{< relref "../../../../explore/logs-integration/#log-level" >}}) are displayed at the beginning of each log line. They allow users to quickly assess the severity of log entries and facilitate log analysis and troubleshooting. The log level is determined from the `severity` field of the data frame. If the `severity` field isn't present, Grafana tries to evaluate the level based on the content of the log line. If inferring the log level from the content isn't possible, the log level is then set to `unknown`.

Refer to [Logs data frame format](#logs-data-frame-format) for more information.

#### Copy link to log line

{{% admonition type="note" %}} This feature must be implemented in the data frame as a field. {{%
/admonition %}}

[Copy link to log line]({{< relref "../../../../explore/logs-integration/#copy-link-to-log-line" >}}) is a feature that allows you to generate a link to a specific log line for easy sharing and referencing. Grafana supports this feature in data sources that produce log data frames with `id` fields.

If the underlying database doesn't return an `id` field, you can implement one within the data source. For example, in the Loki data source, a combination of nanosecond timestamp, labels, and the content of the log line is used to create a unique `id`. On the other hand, Elasticsearch returns an `_id` field that is unique for the specified index. In such cases, to ensure uniqueness, both the `index name` and `_id` are used to create a unique `id`.

Refer to [Logs data frame format](#logs-data-frame-format) for more information.

#### Filter fields using Log details

{{% admonition type="note" %}} Implement this feature through the data source method. {{%
/admonition %}}

Every log line has an expandable part called "Log details" that you can open by clicking on the line. Within Log details, Grafana displays [Fields]({{< relref "../../../../explore/logs-integration/#fields" >}}) associated with that log entry. If the data source implements `modifyQuery?(query: TQuery, action: QueryFixAction): TQuery;` API, then filtering functionality is available for each field. For logs, two filtering options are currently available:

- `ADD_FILTER` - Use to filter for log lines that include selected fields.
- `ADD_FILTER_OUT` - Use to filter for log lines that don't include selected fields.

```ts
export class ExampleDatasource extends DataSourceApi<ExampleQuery, ExampleOptions> {
  modifyQuery(query: ExampleQuery, action: QueryFixAction): ExampleQuery {
    let queryText = query.query ?? '';
    switch (action.type) {
      case 'ADD_FILTER':
        if (action.options?.key && action.options?.value) {
          // Be sure to adjust this example code based on your data source logic.
          queryText = addLabelToQuery(queryText, action.options.key, '=', action.options.value);
        }
        break;
      case 'ADD_FILTER_OUT':
        {
          if (action.options?.key && action.options?.value) {
            // Be sure to adjust this example code based on your data source logic.
            queryText = addLabelToQuery(queryText, action.options.key, '!=', action.options.value);
          }
        }
        break;
    }
    return { ...query, query: queryText };
  }
}
```

#### Live tailing

{{% admonition type="note" %}} Implement this feature data source method and enabled in `plugin.json` {{%
/admonition %}}

[Live tailing]({{< relref "../../../../explore/logs-integration/#live-tailing" >}}) is a feature that enables real-time log result streaming using Explore. To enable live tailing for your data source, follow these steps:

1. **Enable streaming in `plugin.json`**: In your data source plugin's `plugin.json` file, set the `streaming` attribute to `true`. This allows Explore to recognize and enable live tailing controls for your data source.

```json
{
  "type": "datasource",
  "name": "Example",
  "id": "example",
  "logs": true,
  "streaming": true
}
```

2. Ensure that your data source's `query` method can handle queries with `liveStreaming` set to true.

```ts
export class ExampleDatasource extends DataSourceApi<ExampleQuery, ExampleOptions> {
  query(request: DataQueryRequest<ExampleQuery>): Observable<DataQueryResponse> {
    // This is a mocked implementation. Be sure to adjust this based on your data source logic.
    if (request.liveStreaming) {
      return this.runLiveStreamQuery(request);
    }
    return this.runRegularQuery(request);
  }
}
```

#### Log context

{{% admonition type="note" %}} Implement this feature through the `DataSourceWithXXXSupport` interface{{%
/admonition %}}

[Log context]({{< relref "../../../../explore/logs-integration/#log-context" >}}) is a feature in Explore that enables the display of additional lines of context surrounding a log entry that matches a specific search query. This feature allows users to gain deeper insights into the log data by viewing the log entry within its relevant context. Because Grafana will show the surrounding log lines, users can gain a better understanding of the sequence of events and the context in which the log entry occurred, improving log analysis and troubleshooting.

```ts
import {
  DataQueryRequest,
  DataQueryResponse,
  DataSourceWithLogsContextSupport,
  LogRowContextOptions,
  LogRowContextQueryDirection,
  LogRowModel,
} from '@grafana/data';
import { catchError, lastValueFrom, of, switchMap, Observable } from 'rxjs';

export class ExampleDatasource
  extends DataSourceApi<ExampleQuery, ExampleOptions>
  implements DataSourceWithLogsContextSupport<ExampleQuery>
{
  // Retrieve context for a given log row
  async getLogRowContext(
    row: LogRowModel,
    options?: LogRowContextOptions,
    query?: ExampleQuery
  ): Promise<DataQueryResponse> {
    // Be sure to adjust this example implementation of createRequestFromQuery based on your data source logic.
    const request = createRequestFromQuery(row, query, options);
    return lastValueFrom(
      // Be sure to adjust this example of this.query based on your data source logic.
      this.query(request).pipe(
        catchError((err) => {
          const error: DataQueryError = {
            message: 'Error during context query. Please check JS console logs.',
            status: err.status,
            statusText: err.statusText,
          };
          throw error;
        }),
        // Be sure to adjust this example of processResultsToDataQueryResponse based on your data source logic.
        switchMap((res) => of(processResultsToDataQueryResponse(res)))
      )
    );
  }

  // Retrieve the context query object for a given log row. This is currently used to open LogContext queries in a split view.
  getLogRowContextQuery(
    row: LogRowModel,
    options?: LogRowContextOptions,
    query?: ExampleQuery
  ): Promise<ExampleQuery | null> {
    // Data source internal implementation that creates context query based on row, options and original query
  }

  // This method can be used to show "context" button based on runtime conditions (for example, row model data or plugin settings)
  showContextToggle(row?: LogRowModel): boolean {
    // If you want to always show toggle, you can just return true
    if (row && row.searchWords && row.searchWords.length > 0) {
      return true;
    }
  }
}
```

## APIs under development

These APIs can be used in data sources within the [`grafana/grafana`](https://github.com/grafana/grafana) repository. They are not supported for external plugin developers.

### Show full-range logs volume

{{% admonition type="note" %}} This feature is not currently not supported for external plugins outside of Grafana repo. It is implemented in data source by implementing `DataSourceWithXXXSupport` interface. {{%
/admonition %}}

With [full range logs volume]({{< relref "../../../../explore/logs-integration/#logs-volume" >}}), Explore displays a graph showing the log distribution for all the entered log queries. To add full-range logs volume support to the data source plugin, use the `DataSourceWithSupplementaryQueriesSupport` API.

**How to implement `DataSourceWithSupplementaryQueriesSupport` API in data source:**

{{% admonition type="note" %}} This API must be implemented in the data source in typescript code. {{%
/admonition %}}

```ts
import { queryLogsVolume } from '../features/logs/logsModel'; // This is currently not available for use outside of the Grafana repo
import {
  DataSourceWithSupplementaryQueriesSupport,
  LogLevel,
  SupplementaryQueryOptions,
  SupplementaryQueryType,
} from '@grafana/data';

export class ExampleDatasource
  extends DataSourceApi<ExampleQuery, ExampleOptions>
  implements DataSourceWithSupplementaryQueriesSupport<ExampleQuery>
{
  // Returns supplementary query types that data source supports.
  getSupportedSupplementaryQueryTypes(): SupplementaryQueryType[] {
    return [SupplementaryQueryType.LogsVolume];
  }

  // Returns a supplementary query to be used to fetch supplementary data based on the provided type and original query.
  // If provided query is not suitable for provided supplementary query type, undefined should be returned.
  getSupplementaryQuery(options: SupplementaryQueryOptions, query: ExampleQuery): ExampleQuery | undefined {
    if (!this.getSupportedSupplementaryQueryTypes().includes(options.type)) {
      return undefined;
    }

    switch (options.type) {
      case SupplementaryQueryType.LogsVolume:
        // This is a mocked implementation. Be sure to adjust this based on your data source logic.
        return { ...query, refId: `logs-volume-${query.refId}`, queryType: 'count' };
      default:
        return undefined;
    }
  }

  // Returns an observable that will be used to fetch supplementary data based on the provided
  // supplementary query type and original request.
  getDataProvider(
    type: SupplementaryQueryType,
    request: DataQueryRequest<ExampleQuery>
  ): Observable<DataQueryResponse> | undefined {
    if (!this.getSupportedSupplementaryQueryTypes().includes(type)) {
      return undefined;
    }

    switch (type) {
      case SupplementaryQueryType.LogsVolume:
        return this.getLogsVolumeDataProvider(request);
      default:
        return undefined;
    }
  }

  // Be sure to adjust this example based your data source logic.
  private getLogsVolumeDataProvider(
    request: DataQueryRequest<ExampleQuery>
  ): Observable<DataQueryResponse> | undefined {
    const logsVolumeRequest = cloneDeep(request);
    const targets = logsVolumeRequest.targets
      .map((query) => this.getSupplementaryQuery({ type: SupplementaryQueryType.LogsVolume }, query))
      .filter((query): query is ExampleQuery => !!query);

    if (!targets.length) {
      return undefined;
    }

    // Use imported queryLogsVolume.
    return queryLogsVolume(
      this,
      { ...logsVolumeRequest, targets },
      {
        // Implement extract level to produce color-coded graph.
        extractLevel: (dataFrame: DataFrame) => LogLevel.unknown,
        range: request.range,
        targets: request.targets,
      }
    );
  }
}
```

### Logs sample

{{% admonition type="note" %}} This feature is currently not supported for external plugins outside of the Grafana repo. Add support for this API in a data source by implementing the `DataSourceWith<Feature>Support` interface. {{%
/admonition %}}

The [logs sample]({{< relref "../../../../explore/logs-integration/#logs-sample" >}}) feature is a valuable addition when your data source supports both logs and metrics. It enables users to view samples of log lines that contributed to the visualized metrics, providing deeper insights into the data.

To implement the logs sample support in your data source plugin, you can use the `DataSourceWithSupplementaryQueriesSupport` API.

```ts
import { queryLogsSample } from '../features/logs/logsModel'; // This is currently not possible to use outside of Grafana repo
import {
  DataSourceWithSupplementaryQueriesSupport,
  SupplementaryQueryOptions,
  SupplementaryQueryType,
} from '@grafana/data';

export class ExampleDatasource
  extends DataSourceApi<ExampleQuery, ExampleOptions>
  implements DataSourceWithSupplementaryQueriesSupport<ExampleQuery>
{
  // Returns supplementary query types that data source supports.
  getSupportedSupplementaryQueryTypes(): SupplementaryQueryType[] {
    return [SupplementaryQueryType.LogsSample];
  }

  // Returns a supplementary query to be used to fetch supplementary data based on the provided type and original query.
  // If provided query is not suitable for provided supplementary query type, undefined should be returned.
  getSupplementaryQuery(options: SupplementaryQueryOptions, query: ExampleQuery): ExampleQuery | undefined {
    if (!this.getSupportedSupplementaryQueryTypes().includes(options.type)) {
      return undefined;
    }

    switch (options.type) {
      case SupplementaryQueryType.LogsSample:
        // Be sure to adjust this example based on your data source logic.
        return { ...query, refId: `logs-sample-${query.refId}`, queryType: 'logs' };
      default:
        return undefined;
    }
  }

  // Returns an observable that will be used to fetch supplementary data based on the provided supplementary query type and original request.
  getDataProvider(
    type: SupplementaryQueryType,
    request: DataQueryRequest<ExampleQuery>
  ): Observable<DataQueryResponse> | undefined {
    if (!this.getSupportedSupplementaryQueryTypes().includes(type)) {
      return undefined;
    }

    switch (type) {
      case SupplementaryQueryType.LogsSample:
        return this.getLogsSampleDataProvider(request);
      default:
        return undefined;
    }
  }

  private getLogsSampleDataProvider(
    request: DataQueryRequest<ExampleQuery>
  ): Observable<DataQueryResponse> | undefined {
    const logsSampleRequest = cloneDeep(request);
    const targets = logsVolumeRequest.targets
      .map((query) => this.getSupplementaryQuery({ type: SupplementaryQueryType.LogsVolume }, query))
      .filter((query): query is ExampleQuery => !!query);

    if (!targets.length) {
      return undefined;
    }

    // Use imported queryLogsSample
    return queryLogsSample(this, { ...logsVolumeRequest, targets });
  }
}
```

For an example of how to implement the logs sample in the Elasticsearch data source, refer to [PR 70258](https://github.com/grafana/grafana/pull/70258/).

### Logs to trace using internal data links

{{% admonition type="note" %}} This feature is currently not supported for external plugins outside of the Grafana repo. The `@internal` API is currently under development. {{%
/admonition %}}

If you are developing a data source plugin that handles both logs and traces, and your log data contains trace IDs, you can enhance your log data frames by adding a field with trace ID values and internal data links. These links should use the trace ID value to accurately create a trace query that produces relevant trace. This enhancement enables users to seamlessly move from log lines to the traces.

**Example in TypeScript:**

```ts
import { createDataFrame } from '@grafana/data';

const result = createDataFrame({
  fields: [
    ...,
    { name: 'traceID',
      type: FieldType.string,
      values: ['a006649127e371903a2de979', 'e206649127z371903c3be12q' 'k777549127c371903a2lw34'],
      config: {
        links: [
          {
            title: 'Trace view',
            url: '',
            internal: {
              // Be sure to adjust this example with datasourceUid, datasourceName and query based on your data source logic.
              datasourceUid: instanceSettings.uid,
              datasourceName: instanceSettings.name,
              query: {
                { ...query, queryType: 'trace', traceId: '${__value.raw}'}, // ${__value.raw} is a variable that will be replaced with actual traceID value.
              }
            }

          }
        ]
      }

    }
  ],
  ...,
});
```

### Log context query editor

{{% admonition type="note" %}} This feature is currently not supported for external plugins outside of the Grafana repo. The`@alpha` API is currently under development. {{%
/admonition %}}

It allows plugin developers to display a custom UI in the context view by implementing the `getLogRowContextUi?(row: LogRowModel, runContextQuery?: () => void, origQuery?: TQuery): React.ReactNode;` method.

### Toggleable filters in Log Details

{{% admonition type="note" %}} This feature is currently not supported for external plugins outside of the Grafana repo. Add support for this API in a data source by implementing the `DataSourceWith<Feature>Support` interface. {{%
/admonition %}}

The [logs details]({{< relref "../../../../explore/logs-integration/#log-details-view" >}}) component offers the possibility of adding and removing filters from the query that generated a given log line by clicking the corresponding button next to each field associated with the log line. When this interface is implemented in your data source, you get access to the following functionalities:

- If a positive filter for the field and field value is present in the query, the "plus" icon is displayed as active.
- If a positive filter is active, it can be toggled off (removed) from the source query.
- If a positive filter is active, it can be changed to a negative equivalent by clicking on the "minus" icon.
- A negative filter for a field and field value can be added to the source query by clicking on the corresponding icon.

To implement toggleable filters support in your data source plugin, you can use the `DataSourceWithToggleableQueryFiltersSupport` API.

```ts
import { 
  queryHasPositiveFilter,
  removePositiveFilterFromQuery,
  addPositiveFilterToQuery,
  addNegativeFilterToQuery,
} from '../your/own/package/functions';
import { 
  DataSourceWithToggleableQueryFiltersSupport,
  QueryFilterOptions,
} from '@grafana/data';

export class ExampleDatasource
  extends DataSourceApi<ExampleQuery, ExampleOptions>
  implements DataSourceWithToggleableQueryFiltersSupport<ExampleQuery>
{
  /**
   * Given a query, determine if it has a filter that matches the options.
   */
  queryHasFilter(query: ExampleQuery, filter: QueryFilterOptions): boolean {
    /**
     * Pass the query and the key => value pair to your query-analyzing function.
     * We only care about equality/positive filters as only those fields will be 
     * present in the log lines.
     */
    return queryHasPositiveFilter(query, filter.key, filter.value);
  }

  /**
   * Toggle filters on and off from query.
   * If the filter is already present, it should be removed.
   * If the opposite filter is present, it should be replaced.
   */
  toggleQueryFilter(query: ExampleQuery, filter: ToggleFilterAction): LokiQuery {ç
    const expression = query.expr; // The current query expression.
    // We currently support 2 types of filter: FILTER_FOR (positive) and FILTER_OUT (negative).
    switch (filter.type) {
      case 'FILTER_FOR': {
        // This gives the user the ability to toggle a filter on and off.
          expression = queryHasPositiveFilter(expression, filter.options.key, value)
            ? removePositiveFilterFromQuery(expression, filter.options.key, value)
            : addPositiveFilterToQuery(expression, filter.options.key, value);
        break;
      }
      case 'FILTER_OUT': {
        // If there is a positive filter with the same key and value, remove it.
        if (queryHasPositiveFilter(expression, filter.options.key, value)) {
          expression = removePositiveLabelFromQuery(expression, filter.options.key, value);
        }
        // Add the inequality filter to the query.
        expression = addNegativeFilterToQuery(expression, filter.options.key, value);
        break;
      }
      default:
        break;
    }
    return { ...query, expr: expression };
  }
}
```