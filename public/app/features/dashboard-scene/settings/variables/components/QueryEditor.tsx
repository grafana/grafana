import { useMemo } from 'react';

import { type DataSourceApi, LoadingState, type TimeRange } from '@grafana/data';
import { Trans } from '@grafana/i18n';
import { getTemplateSrv } from '@grafana/runtime';
import { type QueryVariable } from '@grafana/scenes';
import { Text, Box } from '@grafana/ui';
import { isLegacyQueryEditor, isQueryEditor } from 'app/features/variables/guard';
import { type VariableQueryEditorType } from 'app/features/variables/types';

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
  // Keep a stable reference across renders. The underlying query editors re-initialize their
  // internal state from this prop via useEffect, so a fresh object on every render would wipe
  // out in-flight edits (e.g. typing a variable into a label filter) whenever the parent
  // re-renders for an unrelated reason.
  const queryWithDefaults = useMemo(() => {
    if (typeof query === 'string') {
      return query || (datasource.variables?.getDefaultQuery?.() ?? '');
    }
    return {
      ...datasource.variables?.getDefaultQuery?.(),
      ...query,
    };
  }, [query, datasource]);

  if (VariableQueryEditor && isLegacyQueryEditor(VariableQueryEditor, datasource)) {
    return (
      <Box marginBottom={2}>
        <Text variant="bodySmall" weight="medium">
          <Trans i18nKey="dashboard-scene.query-editor.query">Query</Trans>
        </Text>
        <Box marginTop={0.25}>
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
        <Box marginTop={0.25}>
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
