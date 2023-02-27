---
title: Add anonymous usage reporting
---

# Add anonymous usage reporting to you plugin

The Grafana server administrator has the possibility to configure [anonymous usage tracking]({{< relref "../../setup-grafana/configure-grafana/#reporting_enabled" >}}).

By adding usage tracking to your plugin you will send events of how your plugin is being used to the configured tracking system.

Lets say we have a QueryEditor that looks something like the example below. It has an editor field where you can write your query and a query type selector so you can select what kind of query result you are expecting that query to return.

```ts
import React, { ReactElement } from 'react';
import { InlineFieldRow, InlineField, Select, CodeEditor } from '@grafana/ui';
import type { EditorProps } from './types';

export function QueryEditor(props: EditorProps): ReactElement {
  const { datasource, query, onChange, onRunQuery } = props;
  const queryType = { value: query.value ?? 'timeserie' };
  const queryTypes = [
    {
      label: 'Timeserie',
      value: 'timeserie',
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

Lets say that we would like to track how the usage looks between time series and table queries. All you need to do is to add the `usePluginInteractionReporter` to fetch a report function which takes two arguments. The first one is the event name which is used to identify the interaction being made. It need to start with `grafana_plugin_` which makes it easier to differentiate plugin events from Grafana core events. The second argument is optional and should be used to attach contextual data to the event. In our example, that would be the query type. It is optional because it does not make sense to pass contextual data for all user interactions.

```ts
import React, { ReactElement } from 'react';
import { InlineFieldRow, InlineField, Select, CodeEditor } from '@grafana/ui';
import { usePluginInteractionReporter } from '@grafana/runtime';
import type { EditorProps } from './types';

export function QueryEditor(props: EditorProps): ReactElement {
  const { datasource, query, onChange, onRunQuery } = props;
  const report = usePluginInteractionReporter();

  const queryType = { value: query.value ?? 'timeserie' };
  const queryTypes = [
    {
      label: 'Timeserie',
      value: 'timeserie',
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

Another benefit of using the `usePluginInteractionReporter` is that the report function that is handed back to you will automatically attach contextual data about the plugin you are tracking to every event. In our example the following information will be sent to the analytics service configured by the Grafana server administrator.

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
    query_type: 'timeserie'
  }
}
```
