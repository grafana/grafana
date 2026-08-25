import { useAsyncFn } from 'react-use';

import { LoadingState, type DataSourceInstanceSettings } from '@grafana/data';
import { t } from '@grafana/i18n';
import { useDataSourceInstanceSettings } from '@grafana/runtime/unstable';
import { sceneGraph, type VizPanel } from '@grafana/scenes';
import { Button, Stack } from '@grafana/ui';
import { getVizSuggestionForQuery } from 'app/features/dashboard-scene/utils/getVizSuggestionForQuery';
import { getQueryRunnerFor } from 'app/features/dashboard-scene/utils/utils';
import { DataSourcePicker } from 'app/features/datasources/components/picker/DataSourcePicker';
import { QueryEditorRow } from 'app/features/query/components/QueryEditorRow';

interface Props {
  panel: VizPanel;
}

/**
 * The inline editing surface for a query-first notebook cell: pick a datasource, write a query, run
 * it. `panel` already carries a real SceneQueryRunner,
 * which auto-runs on activation and re-runs on a time-range change the same way any dashboard panel
 * does. This component only reads and writes that runner's live state.
 */
export function PanelQueryEditor({ panel }: Props) {
  const queryRunner = getQueryRunnerFor(panel);
  const { queries } = queryRunner?.useState() ?? { queries: [] };
  const query = queries[0];
  const { data } = sceneGraph.getData(panel).useState();
  const range = sceneGraph.getTimeRange(panel).useState().value;

  const { settings: dsSettings } = useDataSourceInstanceSettings(query?.datasource);

  // Picks a visualization that actually fits the query's result shape
  // instead of the panel staying stuck on whatever it started as — the same suggestion pipeline
  // UnconfiguredPanel's "Use saved query" button already runs on a dashboard, via
  // VizPanel.changePluginType rather than DashboardScene.changePanelPlugin (a thin wrapper around the
  // same call) so it works with no DashboardScene above this panel. Runs the query twice — once here
  // for the shape, once for real through the panel's own runner — the same trade-off that flow already
  // accepts. A failed suggestion (bad datasource, timeout) must not block the real run.
  const [runState, runQuery] = useAsyncFn(async () => {
    if (!query || !queryRunner) {
      return;
    }
    try {
      const suggestion = await getVizSuggestionForQuery(query, range);
      if (suggestion) {
        await panel.changePluginType(suggestion.pluginId, suggestion.options, suggestion.fieldConfig);
      }
    } catch {
      console.error('Failed to get viz suggestion for query', query);
    }
    queryRunner.runQueries();
  }, [query, range, panel, queryRunner]);

  if (!queryRunner || !query) {
    return null;
  }

  const changeDataSource = (settings: DataSourceInstanceSettings) => {
    const datasource = { uid: settings.uid, type: settings.type };
    queryRunner.setState({ datasource, queries: [{ ...query, datasource }] });
  };

  return (
    <Stack direction="column" gap={1}>
      <Stack justifyContent="flex-end">
        <Button icon="play" onClick={runQuery} disabled={runState.loading} size="sm">
          {t('notebook.cell.query.run', 'Run query')}
        </Button>
      </Stack>

      {dsSettings ? (
        <QueryEditorRow
          data={data ?? { state: LoadingState.NotStarted, series: [], timeRange: range }}
          query={query}
          queries={[query]}
          id={query.refId}
          index={0}
          dataSource={dsSettings}
          onChangeDataSource={changeDataSource}
          onChange={(updated) => queryRunner.setState({ queries: [updated] })}
          onRunQuery={runQuery}
          onAddQuery={() => {}}
          onRemoveQuery={() => {}}
          range={range}
          hideActionButtons
          hideHideQueryButton
        />
      ) : (
        <DataSourcePicker current={query.datasource} onChange={changeDataSource} />
      )}
    </Stack>
  );
}
