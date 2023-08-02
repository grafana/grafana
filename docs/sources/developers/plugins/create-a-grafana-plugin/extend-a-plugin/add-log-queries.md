---
aliases:
  - ../../../plugins/add-support-for-log-queries/
description: Add features to log queries in Explore.
keywords:
  - grafana
  - plugins
  - plugin
  - queries
  - explore queries
  - explore
  - logs
  - log
labels:
  products:
    - enterprise
    - oss
title: Add features to log queries in Explore
weight: 400
---

# Add features to log queries in Explore

[Explore]({{< relref "../../../../explore" >}}) provides an excellent place for investigating incidents and troubleshooting using logs. If the data source produces log results, we highly recommend implementing the following APIs to empower your users to fully utilize the logs UI and its features within Explore.

This guide will walk you through the process of adding support for Explore features in a data source plugin through a seamless integration, maximizing the potential for logs analysis. By implementing these APIs, you can enhance the user experience and provide valuable insights through Explore's powerful log investigation capabilities.

## Supported APIs for external plugin developers

### Logs data frame format

The data frame should include following fields:

| Field name     | Field type                                      | Info                                                                                                                                                                                                                                        |
| -------------- | ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **timestamp**  | `time`                                          | Field with the timestamp, non nullable.                                                                                                                                                                                                     |
| **body**       | `string`                                        | Field with the content of the log line content, non nullable.                                                                                                                                                                               |
| **severity**   | `string`                                        | Represents the severity/level of the log line. If no severity field is found, consumers/client will decide the log level. More info about log level can be found [here](https://grafana.com/docs/grafana/latest/explore/logs-integration/). |
| **id**         | `string`                                        | Unique identifier of the log line.                                                                                                                                                                                                          |
| **attributes** | `json raw message` (Go) or `other` (Typescript) | This field represents additional attributes of the log line. Other systems may refer to this with different names, such as "Labels" in Loki. Its value should be represented with Record<string,any> type in javascript.                    |

Logs data frame's `type` needs to be set to `type: DataFrameType.LogLines` in data frame's meta.

Example of constructing a logs data frame in `Go`:

> Note: Should be used if you are creating data frames in Go

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

Example of constructing a logs data frame in `Typescript`:

> Note: Should be used if you are creating data frames in Typescript

```ts
const result = new MutableDataFrame({
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

### Show log results in Explore's Logs view

> Must be implemented in the data frame as a meta attribute

To ensure that your log results are displayed in an interactive Logs view, add a `meta` attribute to `preferredVisualisationType` in your log result data frame.

Example of constructing a data frame with specific meta information in `Go`:

> Note: Should be used if you are creating data frames in Go

```go
frame.Meta = &data.FrameMeta{
	PreferredVisualization: "logs",
}
```

Example of constructing a data frame with specific meta information in `Typescript`:

> Note: Should be used if you are creating data frames in Typescript

```ts
const result = new MutableDataFrame({
    fields: [...],
    meta: {
        preferredVisualisationType: 'logs',
    },
});
```

### Highlight searched words

> Must be implemented in the data frame as a meta attribute

The logs visualisation can [highlight specific words or strings]({{< relref "../../../../explore/logs-integration/#highlight-searched-words" >}}) in log entries. This feature is typically utilized for highlighting search terms, making it easier for users to locate and focus on relevant information in the logs. For the highlighting to work, search words need to be included in the data frame's meta information

Example of constructing a data frame that includes searchWords in `Go`:

> Note: Should be used if you are creating data frames in Go

```go
frame.Meta = &data.FrameMeta{
	Custom: map[string]interface{}{
    "searchWords": []string{"foo", "bar", "baz"} ,
  }
}
```

Example of constructing a data frame that includes searchWords in `Typescript`:

> Note: Should be used if you are creating data frames in Typescript

```ts
const result = new MutableDataFrame({
    fields: [...],
    meta: {
      custom: {
        searchWords: ["foo", "bar", "baz"],
      }
    },
});
```

### Log result meta information

> Must be implemented in the data frame as a meta attribute

[Log result meta information]({{< relref "../../../../explore/logs-integration/#log-result-meta-information" >}}) can be used to communicate information about logs results to the user. The following information can be shared with the user:

- **Count of received logs vs limit** - It displays the count of received logs compared to the specified limit. Data frames should have a "limit" a meta attribute with the number of requested log lines.
- **Error**: Displays possible errors in your log results. Data frames should to have an "error" meta attribute.
- **Common labels**: Labels, or attributes that are the same for all displayed log lines are shown as meta information. This feature is supported for data sources that produce log data frames with an `attributes` field. Refer to [Logs data frame format](#logs-data-frame-format) for more information.

Example of constructing a data frame with specific meta information in `Go`:

> Note: Should be used if you are creating data frames in Go

```go
frame.Meta = &data.FrameMeta{
	Custom: map[string]interface{}{
    "limit": 1000,
    "error": "Error information",
  }
}
```

Example of constructing a data frame with specific meta information in `Typescript`:

> Note: Should be used if you are creating data frames in Typescript

```ts
const result = new MutableDataFrame({
    fields: [...],
    meta: {
        custom: {
          limit: 1000,
          error: "Error information"
        }
    },
});
```

### Color coded log levels

> Must be implemented in the data frame as a field

Color coded [log levels]({{< relref "../../../../explore/logs-integration/#log-level" >}}) are displayed at the beginning of each log line. It improves the log visualization by allowing users to quickly assess the severity of log entrie, facilitating log analysis and troubleshooting. The log level is determined from the `severity` field of the data frame. In the case where the `severity` field is not present, Grafana tries to evaluate the level based on the content of the log line. If inferring the log level from the content is not possible, the log level is then set to `unknown`.

Refer to [Logs data frame format](#logs-data-frame-format) for more information.

### Copy link to log line

> Must be implemented in the data frame as a field

[Copy link to log line]({{< relref "../../../../explore/logs-integration/#copy-link-to-log-line" >}}) is a feature that allows you to generate a link to a specific log line for easy sharing and referencing. This feature is supported in data sources that produce log data frames with `id` fields.

In the case where the underlying database does not return an `id` field, you can implement one within the data source. For example, in the Loki data source, a combination of nanosecond timestamp, labels, and the content of the log line is used to create a unique id. On the other hand, Elasticsearch returns an `_id` field that is unique for the specified index. In such cases, to ensure uniqueness, both the `index name` and `_id` are used to create a unique id.

Refer to [Logs data frame format](#logs-data-frame-format) for more information.

### Filtering of fields using Log details

> To be implemented trough data source method

Every log line has an expandable part called "Log details" that can be opened by clicking on the line. Within Log details, [Fields]({{< relref "../../../../explore/logs-integration/#fields" >}}) associated with that log entry are displayed. If the data source implements `modifyQuery?(query: TQuery, action: QueryFixAction): TQuery;` API, then filtering functionality is available for each field. For logs, two filtering options are currently available:

- `ADD_FILTER` - to filter for log lines that include selected fields
- `ADD_FILTER_OUT` - to filter for log lines that do not include selected fields

```ts
export class ExampleDatasource extends DataSourceApi<ExampleQuery, ExampleOptions> {
  modifyQuery(query: ExampleQuery, action: QueryFixAction): ExampleQuery {
    let queryText = query.query ?? '';
    switch (action.type) {
      case 'ADD_FILTER':
        if (action.options?.key && action.options?.value) {
          // This is a mocked implementation. Be sure to adjust this based on your data source logic.
          queryText = addLabelToQuery(queryText, action.options.key, '=', action.options.value);
        }
        break;
      case 'ADD_FILTER_OUT':
        {
          if (action.options?.key && action.options?.value) {
            // This is a mocked implementation. Be sure to adjust this based on your data source logic.
            queryText = addLabelToQuery(queryText, action.options.key, '!=', action.options.value);
          }
        }
        break;
    }
    return { ...query, query: queryText };
  }
}
```

### Live tailing

> To be implemented trough data source method and enabled in plugin.json

[Live tailing]({{< relref "../../../../explore/logs-integration/#live-tailing" >}}) is a feature that enables real-time log result streaming using Explore. To enable live tailing for your data source, you need to follow these steps:

1. **Enable streaming in plugin.json**: In your data source plugin's plugin.json file, set the `streaming` attribute to `true`. This allows Explore to recognize and enable live tailing controls for your data source.

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

### Log context

> To be implemented in data source trough implementing DataSourceWithXXXSupport interface

[Log context]({{< relref "../../../../explore/logs-integration/#log-context" >}}) is a feature in Explore that enables the display of additional lines of context surrounding a log entry that matches a specific search query. This feature allows users to gain deeper insights into the log data by viewing the log entry within its relevant context. By showing the surrounding log lines, users can have a better understanding of the sequence of events and the context in which the log entry occurred, facilitating a more comprehensive log analysis and troubleshooting.

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
    // createRequestFromQuery is a mocked implementation. Be sure to adjust this based on your data source logic.
    const request = createRequestFromQuery(row, query, options);
    return lastValueFrom(
      // this.query is a mocked implementation. Be sure to adjust this based on your data source logic.
      this.query(request).pipe(
        catchError((err) => {
          const error: DataQueryError = {
            message: 'Error during context query. Please check JS console logs.',
            status: err.status,
            statusText: err.statusText,
          };
          throw error;
        }),
        // processResultsToDataQueryResponse is a mocked implementation. Be sure to adjust this based on your data source logic.
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

  // This method can be used to show "context" button based on runtime conditions (for example row model data or plugin settings,...)
  showContextToggle(row?: LogRowModel): boolean {
    // If you want to always show toggle, you can just return true
    if (row && row.searchWords && row.searchWords.length > 0) {
      return true;
    }
  }
}
```

## APIs being currently developed that are not supported for external plugin developers

These APIs can be used in data sources within grafana/grafana repository.

### Show full-range logs volume

> Currently not supported for external plugins outside of Grafana repo.
> To be implemented in data source trough implementing DataSourceWithXXXSupport interface.

With [full range logs volume]({{< relref "../../../../explore/logs-integration/#logs-volume" >}}) Explore displays a graph showing the log distribution for all the entered log queries. To add full-range logs volume support to data source plugin, use `DataSourceWithSupplementaryQueriesSupport` API.

Implement DataSourceWithSupplementaryQueriesSupport API in data source:

> Note: The API needs to be implemented in data source in typescript code.

```ts
import { queryLogsVolume } from '../features/logs/logsModel'; // This is currently not possible to use outside of Grafana repo
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

  // This is a mocked implementation. Be sure to adjust this based your data source logic.
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

> Currently not supported for external plugins outside of Grafana repo.
> To be implemented in data source trough implementing DataSourceWithXXXSupport interface.

The [Logs sample]({{< relref "../../../../explore/logs-integration/#logs-sample" >}}) feature is a valuable addition when your data source supports both logs and metrics. It enables users to view samples of log lines that contributed to the visualized metrics, providing deeper insights into the data.

To implement Logs sample support in your data source plugin, you can use the `DataSourceWithSupplementaryQueriesSupport` API.

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
        // This is a mocked implementation. Be sure to adjust this based on your data source logic.
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

Example of [PR implementing Logs sample in Elasticsearch data source](https://github.com/grafana/grafana/pull/70258/)

### Log context query editor

> Currently not supported for external plugins outside of Grafana repo.
> @alpha API that is currently in process of development

It allows plugin developers to display a custom UI in the context view by implementing `getLogRowContextUi?(row: LogRowModel, runContextQuery?: () => void, origQuery?: TQuery): React.ReactNode;` method.
