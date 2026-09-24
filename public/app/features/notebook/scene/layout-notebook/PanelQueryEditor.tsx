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
  /** Called with the top viz suggestions every time a run recomputes them, for NotebookVizSuggestionsPicker. */
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
  // The query an explicit "Run query" click was for, so the effect below knows to auto-apply that
  // run's top suggestion once its data arrives. Unset otherwise — a time-range tick or the query
  // runner's own auto-run on activation populates NotebookVizSuggestionsPicker's options the same
  // way, but must never silently swap the panel's type out from under the reader.
  const pendingAutoApplyQuery = useRef<DataQuery | undefined>(undefined);
  // The query we've already auto-applied a suggestion for, so clicking "Run query" again for the
  // same query doesn't clobber a suggestion the reader picked manually in between.
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

  // The single source of both NotebookVizSuggestionsPicker's option list and (only right after an
  // explicit Run, via pendingAutoApplyQuery) the panel's auto-applied type — computed from the same
  // real data either way, so the two can never disagree the way two independent suggestion fetches
  // (e.g. one probing the datasource on its own, hardcoded request params and all) once could.
  useEffect(() => {
    if (!data || data.state === LoadingState.Loading || data.state === LoadingState.NotStarted) {
      // Mid-flight — leave whatever's already showing alone rather than blank it out for a moment.
      return;
    }
    if (data.state === LoadingState.Error || !hasData(data)) {
      // An empty result (e.g. a query nobody's filled in yet, or one that legitimately returns
      // nothing) has no shape to suggest a visualization from — the picker must go back to
      // disabled rather than keep showing suggestions computed for whatever ran before it, and this
      // run's own pending auto-apply (if any) has nothing to apply either.
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
        // Consumed either way — a query with no matching suggestion at all must not leave this
        // marker armed for some later, unrelated data arrival (e.g. a time-range tick) to pick up.
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
