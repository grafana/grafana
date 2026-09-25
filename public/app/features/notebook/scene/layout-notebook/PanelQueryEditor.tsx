import { isEqual } from 'lodash';
import { useEffect, useRef } from 'react';

import { LoadingState, type PanelPluginVisualizationSuggestion } from '@grafana/data';
import { t } from '@grafana/i18n';
import { sceneGraph, type VizPanel } from '@grafana/scenes';
import { type DataQuery } from '@grafana/schema';
import { Button, Stack } from '@grafana/ui';
import { addQuery } from 'app/core/utils/query';
import { getQueryRunnerFor } from 'app/features/dashboard-scene/utils/getQueryRunnerFor';
import { TOP_VIZ_SUGGESTION_COUNT } from 'app/features/dashboard-scene/utils/getVizSuggestionForQuery';
import { getAllSuggestions } from 'app/features/panel/suggestions/getAllSuggestions';
import { hasData } from 'app/features/panel/suggestions/utils';

import { type NotebookCellItem } from './NotebookCellItem';
import { PanelQueryEditorRow } from './PanelQueryEditorRow';
import { applyQueries } from './applyQueries';

interface Props {
  panel: VizPanel;
  cell?: NotebookCellItem;
  /** True right after this cell was inserted or converted — see NotebookCellRenderer's own doc comment. */
  autoFocus?: boolean;
  /** For NotebookVizSuggestionsPicker's option list. */
  onSuggestionsChange?: (suggestions: PanelPluginVisualizationSuggestion[]) => void;
}

/**
 * The inline editing surface for a query-first notebook cell: pick a datasource, write one or more
 * queries, run them. `panel` already carries a real SceneQueryRunner, which auto-runs on activation
 * and re-runs on a time-range change the same way any dashboard panel does. This component only
 * reads and writes that runner's live state — one PanelQueryEditorRow per query.
 */
export function PanelQueryEditor({ panel, cell, autoFocus, onSuggestionsChange }: Props) {
  const queryRunner = getQueryRunnerFor(panel);
  const { queries } = queryRunner?.useState() ?? { queries: [] };
  const { data } = sceneGraph.getData(panel).useState();
  const range = sceneGraph.getTimeRange(panel).useState().value;
  // Set only by an explicit Run click, so a passive auto-run (time-range tick, activation) never
  // silently changes the panel's type.
  const pendingAutoApplyQuery = useRef<DataQuery | undefined>(undefined);
  // Prevents a repeat Run of the same query from clobbering a manually picked suggestion.
  const lastAutoAppliedQuery = useRef<DataQuery | undefined>(undefined);

  const runQuery = () => {
    if (!queryRunner || queries.length === 0) {
      return;
    }
    if (!isEqual(lastAutoAppliedQuery.current, queries[0])) {
      pendingAutoApplyQuery.current = queries[0];
    }
    queryRunner.runQueries();
  };

  // Single source for both the picker's options and (via pendingAutoApplyQuery) the auto-applied
  // type, so the two can't disagree.
  useEffect(() => {
    if (!data || data.state === LoadingState.Loading || data.state === LoadingState.NotStarted) {
      return;
    }
    if (data.state === LoadingState.Error || !hasData(data)) {
      // Nothing to suggest from — disable the picker instead of showing a stale suggestion.
      pendingAutoApplyQuery.current = undefined;
      onSuggestionsChange?.([]);
      return;
    }
    let cancelled = false;
    getAllSuggestions(data.series)
      .then(({ suggestions }) => {
        if (cancelled) {
          return;
        }
        const topSuggestions = suggestions.slice(0, TOP_VIZ_SUGGESTION_COUNT);
        onSuggestionsChange?.(topSuggestions);
        const pendingQuery = pendingAutoApplyQuery.current;
        const topSuggestion = topSuggestions[0];
        // Clear even with no suggestion, so it can't apply to a later, unrelated data arrival.
        pendingAutoApplyQuery.current = undefined;
        if (pendingQuery && topSuggestion) {
          lastAutoAppliedQuery.current = pendingQuery;
          panel.changePluginType(topSuggestion.pluginId, topSuggestion.options, topSuggestion.fieldConfig);
        }
      })
      .catch(() => console.error('Failed to get viz suggestions for panel data', data));
    return () => {
      cancelled = true;
    };
  }, [data, panel, onSuggestionsChange]);

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
        <Button icon="play" onClick={runQuery} size="sm">
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
