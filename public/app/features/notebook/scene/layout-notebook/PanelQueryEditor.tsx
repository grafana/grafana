import { isEqual } from 'lodash';
import { useRef } from 'react';
import { useAsyncFn } from 'react-use';

import { LoadingState } from '@grafana/data';
import { t } from '@grafana/i18n';
import { sceneGraph, type VizPanel } from '@grafana/scenes';
import { type DataQuery } from '@grafana/schema';
import { Button, Stack } from '@grafana/ui';
import { addQuery } from 'app/core/utils/query';
import { getVizSuggestionForQuery } from 'app/features/dashboard-scene/utils/getVizSuggestionForQuery';
import { getQueryRunnerFor } from 'app/features/dashboard-scene/utils/utils';

import { type NotebookCellItem } from './NotebookCellItem';
import { PanelQueryEditorRow } from './PanelQueryEditorRow';
import { applyQueries } from './applyQueries';

interface Props {
  panel: VizPanel;
  cell?: NotebookCellItem;
  /** True right after this cell was inserted or converted — see NotebookCellRenderer's own doc comment. */
  autoFocus?: boolean;
}

/**
 * The inline editing surface for a query-first notebook cell: pick a datasource, write one or more
 * queries, run them. `panel` already carries a real SceneQueryRunner, which auto-runs on activation
 * and re-runs on a time-range change the same way any dashboard panel does. This component only
 * reads and writes that runner's live state — one PanelQueryEditorRow per query.
 */
export function PanelQueryEditor({ panel, cell, autoFocus }: Props) {
  const queryRunner = getQueryRunnerFor(panel);
  const { queries } = queryRunner?.useState() ?? { queries: [] };
  const { data } = sceneGraph.getData(panel).useState();
  const range = sceneGraph.getTimeRange(panel).useState().value;
  // The last query we successfully fetched a viz suggestion for.
  const lastSuggestedQuery = useRef<DataQuery | undefined>(undefined);

  const [runState, runQuery] = useAsyncFn(async () => {
    if (!queryRunner || queries.length === 0) {
      return;
    }
    if (!isEqual(lastSuggestedQuery.current, queries[0])) {
      try {
        const suggestion = await getVizSuggestionForQuery(queries[0], range);
        lastSuggestedQuery.current = queries[0];
        if (suggestion) {
          await panel.changePluginType(suggestion.pluginId, suggestion.options, suggestion.fieldConfig);
        }
      } catch {
        console.error('Failed to get viz suggestion for query', queries[0]);
      }
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
          // Hints the new query at the existing datasource — a bare `addQuery(queries)` would hand it
          // `datasource: undefined`, which setQueryRunnerQueries treats as a different datasource and
          // wrongly flips the runner to Mixed.
          onClick={() =>
            applyQueries(
              cell,
              queryRunner,
              addQuery(queries, undefined, queries[0]?.datasource ?? undefined),
              t('notebooks.history.add-query', 'Add query')
            )
          }
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
          cell={cell}
          queryRunner={queryRunner}
          queries={queries}
          query={query}
          index={index}
          data={panelData}
          range={range}
          onRunQuery={runQuery}
          startOpen={autoFocus}
        />
      ))}
    </Stack>
  );
}
