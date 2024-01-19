import React from 'react';

import { DataSourceApi, LoadingState, TimeRange } from '@grafana/data';
import { getTemplateSrv } from '@grafana/runtime';
import { QueryVariable } from '@grafana/scenes';
import { Text, Box } from '@grafana/ui';
import { isLegacyQueryEditor, isQueryEditor } from 'app/features/variables/guard';
import { VariableQueryEditorType } from 'app/features/variables/types';

type VariableQueryType = QueryVariable['state']['query'];

interface QueryEditorProps {
  query: VariableQueryType;
  datasource: DataSourceApi;
  VariableQueryEditor: VariableQueryEditorType;
  timeRange: TimeRange;
  onLegacyQueryChange: (query: VariableQueryType, definition: string) => void;
  onQueryChange: (query: VariableQueryType) => void;
}

export function QueryEditor({
  query,
  datasource,
  VariableQueryEditor,
  onLegacyQueryChange,
  onQueryChange,
  timeRange,
}: QueryEditorProps) {
  let queryWithDefaults;
  if (typeof query === 'string') {
    queryWithDefaults = query || (datasource.variables?.getDefaultQuery?.() ?? '');
  } else {
    queryWithDefaults = {
      ...datasource.variables?.getDefaultQuery?.(),
      ...query,
    };
  }

  if (VariableQueryEditor && isLegacyQueryEditor(VariableQueryEditor, datasource)) {
    return (
      <Box marginBottom={2}>
        <Text element={'h4'}>Query</Text>
        <Box marginTop={1}>
          <VariableQueryEditor
            key={datasource.uid}
            datasource={datasource}
            query={queryWithDefaults}
            templateSrv={getTemplateSrv()}
            onChange={onLegacyQueryChange}
          />
        </Box>
      </Box>
    );
  }

  if (VariableQueryEditor && isQueryEditor(VariableQueryEditor, datasource)) {
    return (
      <Box marginBottom={2}>
        <Text element={'h4'}>Query</Text>
        <Box marginTop={1}>
          <VariableQueryEditor
            key={datasource.uid}
            datasource={datasource}
            query={queryWithDefaults}
            onChange={onQueryChange}
            onRunQuery={() => {}}
            data={{ series: [], state: LoadingState.Done, timeRange }}
            range={timeRange}
            onBlur={() => {}}
            history={[]}
          />
        </Box>
      </Box>
    );
  }

  return null;
}
