import { useEffect, useRef, useState } from 'react';
import { useAsyncFn } from 'react-use';
import AutoSizer from 'react-virtualized-auto-sizer';

import {
  type AbsoluteTimeRange,
  dateTime,
  type DataSourceInstanceSettings,
  EventBusSrv,
  LoadingState,
  type PanelData,
  type SplitOpen,
} from '@grafana/data';
import { t } from '@grafana/i18n';
import { useDataSourceInstanceSettings } from '@grafana/runtime/unstable';
import { sceneGraph } from '@grafana/scenes';
import { type DataQuery } from '@grafana/schema';
import { Alert, Button, PanelChrome, Stack } from '@grafana/ui';
import { DataSourcePicker } from 'app/features/datasources/components/picker/DataSourcePicker';
import { ExploreGraph } from 'app/features/explore/Graph/ExploreGraph';
import { ExploreGraphLabel } from 'app/features/explore/Graph/ExploreGraphLabel';
import { type CellContentKind, type PanelQueryKind } from 'app/features/notebook/types';
import { QueryEditorRow } from 'app/features/query/components/QueryEditorRow';
import { PanelQueryRunner } from 'app/features/query/state/PanelQueryRunner';
import { type ExploreGraphStyle } from 'app/types/explore';

import { type NotebookCellItem } from '../NotebookCellItem';

// A lone graph fills its parent, so it needs a resolved height (not just min-height) or PanelChrome
// measures 0 and nothing shows.
const GRAPH_HEIGHT = 300;

const noopSplitOpen: SplitOpen = () => {};
const DEFAULT_GRAPH_STYLE: ExploreGraphStyle = 'lines';

interface Props {
  content: CellContentKind;
  isEditing: boolean;
  autoFocus?: boolean;
  /**
   * The scene object this content belongs to — a real node in the scene graph, parented under the
   * notebook's own `$timeRange`. Read directly via `sceneGraph.getTimeRange(cell)` below rather than
   * threaded down as a plain `TimeRange` prop by components that don't otherwise care about it.
   */
  cell: NotebookCellItem;
  onChange: (content: CellContentKind) => void;
}

/**
 * An ad hoc, Explore-like query: pick a datasource, write a query, run it, see a graph. Unlike a
 * VizPanel, nothing here is a Scene object — running a query is local component state,
 * so a notebook full of these needs no query-runner machinery beyond what this one cell keeps for itself.
 */
export function QueryCell({ content, isEditing, cell, onChange }: Props) {
  const [data, setData] = useState<PanelData>();

  const [viewGraphStyle, setViewGraphStyle] = useState<ExploreGraphStyle>();

  // Scoped to this cell alone, the same way Explore itself scopes a bus per pane
  // (Explore.tsx's own graphEventBus) — nothing outside this cell publishes or subscribes to it, so
  // it exists purely to satisfy ExploreGraph's contract rather than to actually cross-notify anyone.
  const eventBusRef = useRef<EventBusSrv | null>(null);
  if (!eventBusRef.current) {
    eventBusRef.current = new EventBusSrv();
  }

  const runnerRef = useRef<PanelQueryRunner | null>(null);
  if (!runnerRef.current) {
    runnerRef.current = new PanelQueryRunner({
      getDataSupport: () => ({ annotations: false, alertStates: false }),
      getFieldOverrideOptions: () => undefined,
      getTransformations: () => undefined,
    });
  }

  const panelQuery = content.kind === 'Query' ? content.spec.query : undefined;
  const queryOptions = content.kind === 'Query' ? content.spec.queryOptions : undefined;
  const query = panelQuery ? dataQueryFromPanelQueryKind(panelQuery) : undefined;
  const persistedGraphStyle = content.kind === 'Query' ? content.spec.graphStyle : undefined;

  // Edit mode always shows (and writes) the real persisted value; view mode shows a local override
  // once the reader has picked one, falling back to the persisted value (or the default) until they do.
  const graphStyle = isEditing
    ? (persistedGraphStyle ?? DEFAULT_GRAPH_STYLE)
    : (viewGraphStyle ?? persistedGraphStyle ?? DEFAULT_GRAPH_STYLE);

  const timeRangeObj = sceneGraph.getTimeRange(cell);
  const { value: resolvedRange } = timeRangeObj.useState();
  const dsRefName = panelQuery?.spec.query.datasource?.name;

  const { settings: dsSettings } = useDataSourceInstanceSettings(dsRefName);

  const hadQueryAtMount = useRef(Boolean(panelQuery && Object.keys(panelQuery.spec.query.spec).length > 0));

  useEffect(() => {
    const subscription = runnerRef
      .current!.getData({ withFieldConfig: false, withTransforms: false })
      .subscribe(setData);
    return () => subscription.unsubscribe();
  }, []);

  // Set inside runQuery rather than only in the auto-run effect, so an explicit Run counts too —
  // otherwise a cell the reader already fetched would still leave stale series under a new axis
  // when they later move the shared picker (see the range-change effect below).
  const hasRun = useRef(false);

  const [queryState, runQuery] = useAsyncFn(async () => {
    if (!dsSettings || !query) {
      return;
    }
    hasRun.current = true;
    await runnerRef.current!.run({
      datasource: { uid: dsSettings.uid, type: dsSettings.type },
      queries: [query],
      timezone: 'browser',
      timeRange: resolvedRange,
      maxDataPoints: queryOptions?.maxDataPoints ?? 500,
      minInterval: queryOptions?.interval,
    });
  }, [dsSettings, query, resolvedRange, queryOptions]);

  // Runs once the notebook (and this cell within it) has loaded, instead of leaving the reader to
  // click Run themselves for a query that was already saved — same reasoning as auto-loading any
  // other already-authored content. Guarded by a ref rather than an empty dependency array: it has
  // to wait for `dsSettings` to resolve first, which happens a render or two after mount.
  useEffect(() => {
    if (hasRun.current || !dsSettings || !hadQueryAtMount.current) {
      return;
    }
    runQuery();
  }, [dsSettings, runQuery]);

  const rangeFromMs = resolvedRange.from.valueOf();
  const rangeToMs = resolvedRange.to.valueOf();
  const prevRangeFromMs = useRef(rangeFromMs);
  const prevRangeToMs = useRef(rangeToMs);
  useEffect(() => {
    const rangeChanged = prevRangeFromMs.current !== rangeFromMs || prevRangeToMs.current !== rangeToMs;
    prevRangeFromMs.current = rangeFromMs;
    prevRangeToMs.current = rangeToMs;
    if (!rangeChanged || !hasRun.current) {
      return;
    }
    runQuery();
  }, [rangeFromMs, rangeToMs, runQuery]);

  const onChangeTime = ({ from, to }: AbsoluteTimeRange) => {
    timeRangeObj.onTimeRangeChange({
      from: dateTime(from),
      to: dateTime(to),
      raw: { from: dateTime(from), to: dateTime(to) },
    });
  };

  if (content.kind !== 'Query' || !panelQuery || !query) {
    return null;
  }

  // The query editor body only ever mounts while editing (see `isOpen` below), so this can't be reached
  // by a reader in practice — kept anyway as the actual guarantee behind "don't persist a view-mode
  // edit or hit undo/redo", independent of whatever keeps the body itself out of the DOM.
  const changeQuery = (updated: DataQuery) => {
    if (!isEditing) {
      return;
    }
    onChange({ kind: 'Query', spec: { ...content.spec, query: panelQueryKindFromDataQuery(updated, panelQuery) } });
  };

  const changeDataSource = (settings: DataSourceInstanceSettings) => {
    if (!isEditing) {
      return;
    }
    changeQuery({ ...query, datasource: { uid: settings.uid, type: settings.type } });
  };

  const onGraphStyleChange = (style: ExploreGraphStyle) => {
    if (isEditing) {
      onChange({ kind: 'Query', spec: { ...content.spec, graphStyle: style } });
    } else {
      setViewGraphStyle(style);
    }
  };

  return (
    <Stack direction="column" gap={1}>
      <Stack justifyContent="flex-end">
        <Button icon="play" onClick={runQuery} disabled={!dsSettings || queryState.loading} size="sm">
          {t('notebook.cell.query.run', 'Run query')}
        </Button>
      </Stack>

      {dsSettings ? (
        <QueryEditorRow
          data={data ?? { state: LoadingState.NotStarted, series: [], timeRange: resolvedRange }}
          query={query}
          queries={[query]}
          id={query.refId}
          index={0}
          dataSource={dsSettings}
          onChangeDataSource={isEditing ? changeDataSource : undefined}
          onChange={changeQuery}
          onRunQuery={runQuery}
          onAddQuery={() => {}}
          onRemoveQuery={() => {}}
          range={resolvedRange}
          hideActionButtons
          collapsable={isEditing}
          isOpen={isEditing}
          hideHideQueryButton
        />
      ) : (
        <DataSourcePicker current={dsRefName} onChange={changeDataSource} disabled={!isEditing} />
      )}

      {data?.state === LoadingState.Error && (
        <Alert severity="error" title={t('notebook.cell.query.error', 'Query failed')}>
          {data.errors?.[0]?.message}
        </Alert>
      )}

      {data && data.state !== LoadingState.NotStarted && data.state !== LoadingState.Error && (
        <AutoSizer disableHeight>
          {({ width }) =>
            width > 0 && (
              <PanelChrome
                title={t('graph.container.title', 'Graph')}
                width={width}
                height={GRAPH_HEIGHT}
                loadingState={data.state}
                actions={<ExploreGraphLabel graphStyle={graphStyle} onChangeGraphStyle={onGraphStyleChange} />}
              >
                {(innerWidth, innerHeight) => (
                  <ExploreGraph
                    graphStyle={graphStyle}
                    data={data.series}
                    height={innerHeight}
                    width={innerWidth}
                    timeRange={resolvedRange}
                    timeZone="browser"
                    onChangeTime={onChangeTime}
                    splitOpenFn={noopSplitOpen}
                    loadingState={data.state}
                    eventBus={eventBusRef.current!}
                  />
                )}
              </PanelChrome>
            )
          }
        </AutoSizer>
      )}
    </Stack>
  );
}

/**
 * The plain `DataQuery` QueryEditorRow/PanelQueryRunner speak, out of the PanelQueryKind
 * the cell persists
 */
function dataQueryFromPanelQueryKind(panelQuery: PanelQueryKind): DataQuery {
  const { query, refId, hidden } = panelQuery.spec;
  const datasource = query.datasource?.name
    ? { uid: query.datasource.name, type: query.group || undefined }
    : undefined;

  return {
    refId,
    hide: hidden,
    ...(datasource ? { datasource } : {}),
    ...query.spec,
  };
}

/**
 * The inverse of dataQueryFromPanelQueryKind — the single-query equivalent of dashboard-scene's own
 * per-query mapping inside getVizPanelQueries
 * (public/app/features/dashboard-scene/serialization/transformSceneToSaveModelSchemaV2.ts). `previous`
 * only supplies the query's `version`, which nothing in this cell's UI ever changes.
 */
function panelQueryKindFromDataQuery(query: DataQuery, previous: PanelQueryKind): PanelQueryKind {
  const { datasource, refId, hide, ...spec } = query;

  return {
    kind: 'PanelQuery',
    spec: {
      refId,
      hidden: Boolean(hide),
      query: {
        kind: 'DataQuery',
        group: datasource?.type ?? previous.spec.query.group,
        version: previous.spec.query.version || 'v0',
        ...(datasource?.uid ? { datasource: { name: datasource.uid } } : {}),
        spec,
      },
    },
  };
}
