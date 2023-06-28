---
title: Add anonymous usage reporting
aliases:
  - ../../../plugins/add-anonymous-usage-reporting/
keywords:
  - grafana
  - plugins
  - plugin
  - anonymous usage
  - reporting
description: How to add anonymous usage tracking to your Grafana plugin.
weight: 200
---

# Add anonymous usage reporting

Add anonymous usage tracking to your plugin to send [reporting events]({{< relref "../../../../setup-grafana/configure-grafana#reporting_enabled" >}}) that describe how your plugin is being used to a tracking system configured by your Grafana server administrator.

## Event reporting

In this section, we show an example of tracking usage data from a query editor and receiving a report back from the analytics service.

### Sample query editor

Let's say you have a `QueryEditor` that looks similar to the example below. It has a `CodeEditor` field where you can write your query and a query type selector so you can select the kind of query result that you expect to return:

```ts
import React, { ReactElement } from 'react';
import { InlineFieldRow, InlineField, Select, CodeEditor } from '@grafana/ui';
import type { EditorProps } from './types';

export function QueryEditor(props: EditorProps): ReactElement {
  const { datasource, query, onChange, onRunQuery } = props;
  const queryType = { value: query.value ?? 'timeseries' };
  const queryTypes = [
    {
      label: 'Timeseries',
      value: 'timeseries',
    },
    {
      label: 'Table',
      value: 'table',
    },
  ];

  const onChangeQueryType = (type: string) => {
    onChange({
      ...query,
      queryType: type,
    });
    runQuery();
  };

  const onChangeRawQuery = (rawQuery: string) => {
    onChange({
      ...query,
      rawQuery: type,
    });
    runQuery();
  };

  return (
    <>
      <div>
        <CodeEditor
          height="200px"
          showLineNumbers={true}
          language="sql"
          onBlur={onChangeRawQuery}
          value={query.rawQuery}
        />
      </div>
      <InlineFieldRow>
        <InlineField label="Query type" grow>
          <Select options={queryTypes} onChange={onChangeQueryType} value={queryType} />
        </InlineField>
      </InlineFieldRow>
    </>
  );
}
```

### Track usage with `usePluginInteractionReporter`

Let's say that you want to track how the usage looks between time series and table queries.

What you want to do is to add the `usePluginInteractionReporter` to fetch a report function that takes two arguments:

- Required: An event name that begins with `grafana_plugin_`. It is used to identify the interaction being made.
- Optional: Attached contextual data. In our example, that is the query type.

```ts
import React, { ReactElement } from 'react';
import { InlineFieldRow, InlineField, Select, CodeEditor } from '@grafana/ui';
import { usePluginInteractionReporter } from '@grafana/runtime';
import type { EditorProps } from './types';

export function QueryEditor(props: EditorProps): ReactElement {
  const { datasource, query, onChange, onRunQuery } = props;
  const report = usePluginInteractionReporter();

  const queryType = { value: query.value ?? 'timeseries' };
  const queryTypes = [
    {
      label: 'Timeseries',
      value: 'timeseries',
    },
    {
      label: 'Table',
      value: 'table',
    },
  ];

  const onChangeQueryType = (type: string) => {
    onChange({
      ...query,
      queryType: type,
    });
    runQuery();
  };

  const onChangeRawQuery = (rawQuery: string) => {
    onChange({
      ...query,
      rawQuery: type,
    });

    report('grafana_plugin_executed_query', {
      query_type: queryType.value,
    });

    runQuery();
  };

  return (
    <>
      <div>
        <CodeEditor
          height="200px"
          showLineNumbers={true}
          language="sql"
          onBlur={onChangeRawQuery}
          value={query.rawQuery}
        />
      </div>
      <InlineFieldRow>
        <InlineField label="Query type" grow>
          <Select options={queryTypes} onChange={onChangeQueryType} value={queryType} />
        </InlineField>
      </InlineFieldRow>
    </>
  );
}
```

### Data returned from the analytics service

When you use `usePluginInteractionReporter`, the report function that is handed back to you automatically attaches contextual data about the plugin you are tracking to the events.

In our example, the following information is sent to the analytics service configured by the Grafana server administrator:

```ts
{
  type: 'interaction',
  payload: {
    interactionName: 'grafana_plugin_executed_query',
    grafana_version: '9.2.1',
    plugin_type: 'datasource',
    plugin_version: '1.0.0',
    plugin_id: 'grafana-example-datasource',
    plugin_name: 'Example',
    datasource_uid: 'qeSI8VV7z', // will only be added for datasources
    query_type: 'timeseries'
  }
}
```
