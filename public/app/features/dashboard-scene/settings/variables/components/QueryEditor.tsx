import { DataSourceApi, LoadingState, TimeRange } from '@grafana/data';
import { getTemplateSrv } from '@grafana/runtime';
import { QueryVariable } from '@grafana/scenes';
import { Box, Text } from '@grafana/ui';
import { Trans } from 'app/core/internationalization';
import { LegacyVariableQueryEditor } from 'app/features/variables/editor/LegacyVariableQueryEditor';
import { isLegacyQueryEditor, isQueryEditor } from 'app/features/variables/guard';
import { VariableQueryEditorType } from 'app/features/variables/types';

type VariableQueryType = QueryVariable['state']['query'];

// BMC Code start
const bmcDefaultDs = 'bmchelix-ade-datasource';
// BMC Code end

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

  // BMC Code Start
  if (datasource.type === bmcDefaultDs && (!query || typeof query === 'string')) {
    return (
      <Box marginBottom={2}>
        <Text element={'h4'}>
          <Trans i18nKey="bmc.variables.query-editor.query-text">Query</Trans>
        </Text>
        <Box marginTop={1}>
          <LegacyVariableQueryEditor
            datasource={datasource}
            query={query}
            templateSrv={getTemplateSrv()}
            onChange={onLegacyQueryChange}
          />
        </Box>
      </Box>
    );
  }
  // BMC Code End

  if (VariableQueryEditor && isLegacyQueryEditor(VariableQueryEditor, datasource)) {
    return (
      <Box marginBottom={2}>
        <Text element={'h4'}>
          <Trans i18nKey="bmcgrafana.dashboards.settings.variables.editor.types.query.query-text">Query</Trans>
        </Text>
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
        <Text element={'h4'}>
          <Trans i18nKey="bmcgrafana.dashboards.settings.variables.editor.types.query.query-text">Query</Trans>
        </Text>
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
