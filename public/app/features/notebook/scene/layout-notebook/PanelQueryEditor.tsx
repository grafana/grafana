import { useAsyncFn } from 'react-use';

import { LoadingState } from '@grafana/data';
import { t } from '@grafana/i18n';
import { sceneGraph, type VizPanel } from '@grafana/scenes';
import { Button, Stack } from '@grafana/ui';
import { addQuery } from 'app/core/utils/query';
import { getVizSuggestionForQuery } from 'app/features/dashboard-scene/utils/getVizSuggestionForQuery';
import { getQueryRunnerFor } from 'app/features/dashboard-scene/utils/utils';

import { PanelQueryEditorRow } from './PanelQueryEditorRow';
import { setQueryRunnerQueries } from './setQueryRunnerQueries';

interface Props {
  panel: VizPanel;
}

/**
 * The inline editing surface for a query-first notebook cell: pick a datasource, write one or more
 * queries, run them. `panel` already carries a real SceneQueryRunner, which auto-runs on activation
 * and re-runs on a time-range change the same way any dashboard panel does. This component only
 * reads and writes that runner's live state — one PanelQueryEditorRow per query.
 */
export function PanelQueryEditor({ panel }: Props) {
  const queryRunner = getQueryRunnerFor(panel);
  const { queries } = queryRunner?.useState() ?? { queries: [] };
  const { data } = sceneGraph.getData(panel).useState();
  const range = sceneGraph.getTimeRange(panel).useState().value;

  // Picks a visualization that actually fits the query's result shape instead of the panel staying
  // stuck on whatever it started as — the same suggestion pipeline UnconfiguredPanel's "Use saved
  // query" button already runs on a dashboard, via VizPanel.changePluginType rather than
  // DashboardScene.changePanelPlugin (a thin wrapper around the same call) so it works with no
  // DashboardScene above this panel. Reflects only the first query — getVizSuggestionForQuery takes
  // one query, not the combined shape of several; a true multi-query suggestion would mean awaiting
  // the real run below and reading its settled series back, which is more than this needs yet. Runs
  // the query twice — once here for the shape, once for real through the panel's own runner — the
  // same trade-off that flow already accepts. A failed suggestion must not block the real run.
  const [runState, runQuery] = useAsyncFn(async () => {
    if (!queryRunner || queries.length === 0) {
      return;
    }
    try {
      const suggestion = await getVizSuggestionForQuery(queries[0], range);
      if (suggestion) {
        await panel.changePluginType(suggestion.pluginId, suggestion.options, suggestion.fieldConfig);
      }
    } catch {
      console.error('Failed to get viz suggestion for query', queries[0]);
    }
    queryRunner.runQueries();
  }, [queries, range, panel, queryRunner]);

  if (!queryRunner || queries.length === 0) {
    return null;
  }

  const panelData = data ?? { state: LoadingState.NotStarted, series: [], timeRange: range };

  return (
    <Stack direction="column" gap={1}>
      <Stack justifyContent="flex-end">
        <Button
          icon="plus"
          variant="secondary"
          fill="text"
          size="sm"
          onClick={() => setQueryRunnerQueries(queryRunner, addQuery(queries))}
        >
          {t('notebook.cell.query.add', 'Add query')}
        </Button>
        <Button icon="play" onClick={runQuery} disabled={runState.loading} size="sm">
          {t('notebook.cell.query.run', 'Run query')}
        </Button>
      </Stack>

      {queries.map((query, index) => (
        <PanelQueryEditorRow
          key={query.refId}
          queryRunner={queryRunner}
          queries={queries}
          query={query}
          index={index}
          data={panelData}
          range={range}
          onRunQuery={runQuery}
        />
      ))}
    </Stack>
  );
}
