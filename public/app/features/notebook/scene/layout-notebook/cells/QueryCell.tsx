import { css } from '@emotion/css';
import { useEffect, useRef, useState } from 'react';
import AutoSizer from 'react-virtualized-auto-sizer';

import {
  type AbsoluteTimeRange,
  type DataQuery,
  type DataSourceInstanceSettings,
  EventBusSrv,
  getDefaultTimeRange,
  type GrafanaTheme2,
  LoadingState,
  type PanelData,
  type SplitOpen,
  type TimeRange,
} from '@grafana/data';
import { t } from '@grafana/i18n';
import { getDataSourceInstanceSettings } from '@grafana/runtime/unstable';
import { Alert, Button, IconButton, Stack, useStyles2 } from '@grafana/ui';
import { DataSourcePicker } from 'app/features/datasources/components/picker/DataSourcePicker';
import { GraphContainer } from 'app/features/explore/Graph/GraphContainer';
import { type CellContentKind, type PanelQueryKind } from 'app/features/notebook/types';
import { QueryEditorRow } from 'app/features/query/components/QueryEditorRow';
import { PanelQueryRunner } from 'app/features/query/state/PanelQueryRunner';

// A lone graph fills its parent, so it needs a resolved height (not just min-height) or PanelChrome
// measures 0 and nothing shows — same reasoning as NotebookCellRenderer's PANEL_HEIGHT.
const GRAPH_HEIGHT = 300;

// Explore's own graph is GraphContainer -> ExploreGraph -> PanelRenderer(pluginId: 'timeseries') —
// this cell renders GraphContainer directly rather than PanelRenderer alone, so it gets the same
// centred "no data" chrome and the Lines/Bars/Points/Stacked style toggle Explore's graph offers,
// not just the bare timeseries panel underneath it.
const noopSplitOpen: SplitOpen = () => {};

interface Props {
  content: CellContentKind;
  isEditing: boolean;
  autoFocus?: boolean;
  /** The notebook's own shared time range — queries run against whatever range the reader has set. */
  range?: TimeRange;
  onChange: (content: CellContentKind) => void;
}

/**
 * An ad hoc, Explore-like query: pick a datasource, write a query, run it, see a graph. Unlike a
 * VizPanel, nothing here is a Scene object — running a query is local component state, the same way
 * CodeCell's own editor state is, so a notebook full of these needs no query-runner machinery beyond
 * what this one cell keeps for itself.
 */
export function QueryCell({ content, isEditing, range, onChange }: Props) {
  const styles = useStyles2(getStyles);
  const [data, setData] = useState<PanelData>();
  const [running, setRunning] = useState(false);
  const [dsSettings, setDsSettings] = useState<DataSourceInstanceSettings>();
  // Reading a notebook starts every query editor collapsed (a wall of graphs, not a wall of query
  // builders); editing starts them expanded. Purely local — never touches `content`, so toggling one
  // back open isn't "editing" the notebook in any sense that should persist or be undoable.
  const [collapsed, setCollapsed] = useState(!isEditing);
  // Cells aren't remounted when the whole notebook flips between edit and view, so the useState above
  // only ever seeds the very first render's value — this is what re-applies the mode's own default on
  // every later transition too (e.g. edit -> view mid-session, not just a notebook opened straight into
  // view mode), while still leaving room for a manual toggle in between transitions.
  useEffect(() => {
    setCollapsed(!isEditing);
  }, [isEditing]);

  // Scoped to this cell alone, the same way Explore itself scopes a bus per pane
  // (Explore.tsx's own graphEventBus) — nothing outside this cell publishes or subscribes to it, so
  // it exists purely to satisfy GraphContainer's contract rather than to actually cross-notify anyone.
  const eventBusRef = useRef<EventBusSrv | null>(null);
  if (!eventBusRef.current) {
    eventBusRef.current = new EventBusSrv();
  }

  // One runner per mounted cell, not per render — recreating it on every keystroke would drop
  // whatever `data` its own ReplaySubject was replaying.
  const runnerRef = useRef<PanelQueryRunner | null>(null);
  if (!runnerRef.current) {
    runnerRef.current = new PanelQueryRunner({
      getDataSupport: () => ({ annotations: false, alertStates: false }),
      getFieldOverrideOptions: () => undefined,
      getTransformations: () => undefined,
    });
  }

  // Derived up front, ahead of the `content.kind` guard below, so every hook here (and the plain
  // functions between them and the guard) can depend on them regardless of what `content` turns out
  // to be — content.kind is 'Query' whenever cellTypeRegistry ever actually mounts this component,
  // but hooks can't assume that themselves.
  const panelQuery = content.kind === 'Query' ? content.spec.query : undefined;
  const queryOptions = content.kind === 'Query' ? content.spec.queryOptions : undefined;
  const query = panelQuery ? dataQueryFromPanelQueryKind(panelQuery) : undefined;
  const resolvedRange = range ?? getDefaultTimeRange();
  const dsRefName = panelQuery?.spec.query.datasource?.name;
  // Captured at mount, not re-derived each render: a freshly-inserted cell has an empty query spec
  // (see defaultQueryCellContentKind) and should wait for an explicit Run. A cell that already
  // carries a saved query should auto-run once dsSettings resolves. Gating on a live `hasQuery`
  // would also fire on the first keystroke into an empty cell, hitting the datasource with a
  // still-incomplete query.
  const hadQueryAtMount = useRef(Boolean(panelQuery && Object.keys(panelQuery.spec.query.spec).length > 0));

  useEffect(() => {
    const subscription = runnerRef
      .current!.getData({ withFieldConfig: false, withTransforms: false })
      .subscribe(setData);
    return () => subscription.unsubscribe();
  }, []);

  // Resolved fresh from `content` rather than trusted as caller-owned state: the persisted query is
  // the only source of truth for which datasource is selected, the same way CodeCell reads its
  // language straight from `content.spec` instead of shadowing it. `dsRefName` undefined (an
  // untouched cell) still resolves — to the org's default datasource, matching how a fresh Explore
  // pane or dashboard panel starts.
  useEffect(() => {
    let cancelled = false;
    getDataSourceInstanceSettings(dsRefName).then((settings) => {
      if (!cancelled) {
        setDsSettings(settings);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [dsRefName]);

  // Set inside runQuery rather than only in the auto-run effect, so an explicit Run counts too —
  // otherwise a cell the reader already fetched would still leave stale series under a new axis
  // when they later move the shared picker (see the range-change effect below).
  const hasRun = useRef(false);

  const runQuery = async () => {
    if (!dsSettings || !query) {
      return;
    }
    hasRun.current = true;
    setRunning(true);
    try {
      await runnerRef.current!.run({
        datasource: { uid: dsSettings.uid, type: dsSettings.type },
        queries: [query],
        timezone: 'browser',
        timeRange: resolvedRange,
        maxDataPoints: queryOptions?.maxDataPoints ?? 500,
        minInterval: queryOptions?.interval,
      });
    } finally {
      setRunning(false);
    }
  };

  // Runs once the notebook (and this cell within it) has loaded, instead of leaving the reader to
  // click Run themselves for a query that was already saved — same reasoning as auto-loading any
  // other already-authored content. Guarded by a ref rather than an empty dependency array: it has
  // to wait for `dsSettings` to resolve first, which happens a render or two after mount.
  useEffect(() => {
    if (hasRun.current || !dsSettings || !hadQueryAtMount.current) {
      return;
    }
    runQuery();
    // runQuery is a fresh closure every render (it captures dsSettings/query/etc); depending on it
    // here would just make this effect re-evaluate every render for no reason, since the ref
    // guard above — not the dependency array — is what makes this run once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dsSettings]);

  // GraphContainer's axis follows `range` on every render, so a picker change that does not fetch
  // again would leave the previous series under the new window. Only after this cell has already
  // run (auto or explicit) — a freshly-inserted empty cell still waits for Run rather than firing
  // the first time the reader moves the picker. Keyed off the window's endpoints rather than the
  // TimeRange object: the layout re-renders with a new object for unrelated scene updates too.
  // `resolvedRange` is not used here because the fallback (`getDefaultTimeRange()`) is a fresh
  // `now` every render and would retrigger forever when no shared range was passed.
  const rangeFromMs = range?.from.valueOf();
  const rangeToMs = range?.to.valueOf();
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rangeFromMs, rangeToMs]);

  // Drag-to-zoom on the graph is Explore's own gesture for changing time range there — this cell
  // shares the notebook's own range instead (see the `range` prop), so honoring a per-graph zoom
  // would need to write back up to the notebook's own time picker, not just to local state. Left as
  // a no-op for now: the drag still selects visually, it just doesn't change anything (yet).
  const onChangeTime = (_absoluteRange: AbsoluteTimeRange) => {};

  if (content.kind !== 'Query' || !panelQuery || !query) {
    return null;
  }

  // The CSS lock below only stops mouse interaction — a focused input can still be typed into via the
  // keyboard regardless of pointer-events, which would reach these otherwise. Refusing to call
  // `onChange` at all while reading is what actually keeps a stray edit from persisting or ever
  // reaching NotebookEditHistory's undo/redo — not the visual lock, which is just the user-facing half
  // of the same guarantee.
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

  const collapseToggle = (
    <IconButton
      name={collapsed ? 'angle-right' : 'angle-down'}
      tooltip={
        collapsed
          ? t('notebook.cell.query.expand', 'Expand query editor')
          : t('notebook.cell.query.collapse', 'Collapse query editor')
      }
      aria-expanded={!collapsed}
      onClick={() => setCollapsed((current) => !current)}
    />
  );

  return (
    <Stack direction="column" gap={1}>
      <Stack justifyContent="flex-end">
        <Button icon="play" onClick={runQuery} disabled={!dsSettings || running} size="sm">
          {t('notebook.cell.query.run', 'Run query')}
        </Button>
      </Stack>

      {dsSettings ? (
        // Locks the query editor body (the actual per-plugin editor UI) while the notebook is being
        // read rather than edited — see getStyles' own comment on why this reaches in via CSS instead
        // of a prop. The header (datasource label, collapse chevron) stays outside that lock, so a
        // reader can still collapse down to the graph without switching the notebook into edit mode.
        <div className={!isEditing ? styles.locked : undefined}>
          <QueryEditorRow
            data={data ?? { state: LoadingState.NotStarted, series: [], timeRange: resolvedRange }}
            query={query}
            queries={[query]}
            id={query.refId}
            index={0}
            dataSource={dsSettings}
            // Omitted while reading: QueryEditorRowHeader's own fallback for a missing
            // onChangeDataSource is a plain read-only "(datasource name)" label instead of the
            // picker — an existing, sanctioned behavior, not something bolted on here.
            onChangeDataSource={isEditing ? changeDataSource : undefined}
            onChange={changeQuery}
            onRunQuery={runQuery}
            onAddQuery={() => {}}
            onRemoveQuery={() => {}}
            range={resolvedRange}
            // Duplicate/remove/reorder never do anything meaningful for a cell that only ever has one
            // query — the notebook cell itself already has its own duplicate/delete. hideActionButtons
            // is the only lever QueryEditorRow exposes for this, and it also drops the datasource-help
            // toggle along with them; there's no way to keep just one without reaching past its own
            // props into its internals.
            hideActionButtons
            // Its own chevron is replaced by collapseToggle below: QueryOperationRow still syncs its
            // visibility from `isOpen` even with `collapsable={false}` (only the click target — the
            // chevron itself — goes away), and QueryEditorRow only ever reports an *open* row back
            // to the caller (there's no equivalent notification when one is collapsed), so driving
            // `isOpen` externally is the only way to actually own this state ourselves.
            collapsable={false}
            isOpen={!collapsed}
            hideHideQueryButton
            renderHeaderExtras={() => collapseToggle}
          />
        </div>
      ) : (
        <DataSourcePicker current={dsRefName} onChange={changeDataSource} disabled={!isEditing} />
      )}

      {data?.state === LoadingState.Error && (
        <Alert severity="error" title={t('notebook.cell.query.error', 'Query failed')}>
          {data.error?.message}
        </Alert>
      )}

      {data && data.state !== LoadingState.NotStarted && data.state !== LoadingState.Error && (
        <AutoSizer disableHeight>
          {({ width }) =>
            width > 0 && (
              <GraphContainer
                data={data.series}
                eventBus={eventBusRef.current!}
                height={GRAPH_HEIGHT}
                width={width}
                timeRange={resolvedRange}
                timeZone="browser"
                onChangeTime={onChangeTime}
                splitOpenFn={noopSplitOpen}
                loadingState={data.state}
              />
            )
          }
        </AutoSizer>
      )}
    </Stack>
  );
}

/**
 * The plain `DataQuery` QueryEditorRow/PanelQueryRunner speak, out of the k8s-shaped PanelQueryKind
 * the cell persists — the single-query equivalent of dashboard-scene's own
 * panelQueryKindToSceneQuery (public/app/features/dashboard-scene/serialization/layoutSerializers/utils.ts).
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

const getStyles = (theme: GrafanaTheme2) => ({
  // QueryEditorRow has no readOnly concept of its own to opt into, and the per-plugin query editor it
  // hosts can't be trusted to have one either — so this locks the editor body via plain CSS instead.
  // QueryOperationRow's own root renders exactly [header, content?] as direct children (see
  // QueryOperationRow.tsx) with nothing on either one stable enough to target by class or id, so this
  // reaches one level in and locks everything *after* the header rather than the header itself — if
  // that root structure ever changes, this selector needs to change with it.
  locked: css({
    '& > div > div:not(:first-child)': {
      pointerEvents: 'none',
      opacity: 0.6,
    },
  }),
});
