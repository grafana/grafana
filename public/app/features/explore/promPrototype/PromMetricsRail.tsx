// Prototype-only. Not internationalized.
// Left-hand rail for Option A — "Datasource explorer".
// Expanded: header (title + collapse) → Metrics section (search + tree) →
//   docked stats (when a metric is selected) → Outline section (ContentOutline).
// Collapsed: narrow icon strip with expand + metrics-browser icon. Clicking the
// metrics icon opens MetricsBrowserOverlay; clicking a metric inside the overlay
// expands the rail back out.

import { css, cx } from '@emotion/css';
import { useEffect, useMemo, useRef, useState } from 'react';

import { getNextRefId, type GrafanaTheme2 } from '@grafana/data';
import { type DataQuery } from '@grafana/schema';
import { Icon, IconButton, Input, ScrollContainer, useStyles2 } from '@grafana/ui';
import { type StoreState, useDispatch, useSelector } from 'app/types/store';

import { splitOpen } from '../state/main';
import { changeQueries } from '../state/query';

import { CounterSuggestionsPopover } from './CounterSuggestionsPopover';
import { EmbeddedOutline } from './EmbeddedOutline';
import { InsertionActionMenu } from './InsertionActionMenu';
import { MetricStatsPanel } from './MetricStatsPanel';
import { MetricTree } from './MetricTree';
import { MetricsBrowserOverlay } from './MetricsBrowserOverlay';
import { usePromPrototype } from './PromPrototypeContext';
import { mockPrometheusQuery } from './mockPrometheusQuery';
import {
  getEditorSnapshot,
  insertAtCursorWithNewCursor,
  replaceEditorText,
  subscribeToEditorSelection,
} from './promEditorBridge';
import { detectMetricInExpr, findMetric, type MockMetric } from './prometheusMockCatalog';
import {
  insertLabelAbsence,
  insertLabelPresence,
  insertLabelValueAtCursor,
  insertLabelValueExclusion,
  insertMetric,
  isAmbiguous,
  type AmbiguousInsertion,
  type InsertionChoice,
} from './promqlInsertion';

interface Props {
  exploreId: string;
  scroller: HTMLElement | undefined;
  panelId: string;
}

export function PromMetricsRail({ exploreId, scroller, panelId }: Props) {
  const styles = useStyles2(getStyles);
  const dispatch = useDispatch();
  const { railCollapsed, setRailCollapsed } = usePromPrototype();
  const currentQueries = useSelector((state: StoreState) => state.explore.panes[exploreId]?.queries ?? []);
  const datasourceInstance = useSelector((state: StoreState) => state.explore.panes[exploreId]?.datasourceInstance);
  const [filter, setFilter] = useState('');
  const [selectedMetric, setSelectedMetric] = useState<MockMetric | null>(null);
  const [overlayOpen, setOverlayOpen] = useState(false);
  const overlayAnchorRef = useRef<HTMLButtonElement | null>(null);
  const [ambiguous, setAmbiguous] = useState<{
    insertion: AmbiguousInsertion;
    anchor: DOMRect;
    resolve: (choice: InsertionChoice) => void;
  } | null>(null);

  // When the user selects text in the PromQL editor that matches a known
  // metric name, dock that metric's stats panel — same effect as clicking the
  // metric name in the tree. Empty selections (mere cursor moves) don't clear
  // the panel; only matching selections update it.
  useEffect(() => {
    return subscribeToEditorSelection((selected) => {
      if (!selected) {
        return;
      }
      const match = findMetric(selected);
      if (match) {
        setSelectedMetric(match);
      }
    });
  }, []);

  // Map metric-name → refIds of queries currently referencing it. Powers the
  // "A/B/C" badges in the tree and the top-of-list sort.
  const queryRefsByMetric = useMemo<Record<string, string[]>>(() => {
    const out: Record<string, string[]> = {};
    for (const q of currentQueries) {
      const expr = (q as { expr?: unknown }).expr;
      if (typeof expr !== 'string') {
        continue;
      }
      const m = detectMetricInExpr(expr);
      if (m) {
        (out[m.name] ??= []).push(q.refId);
      }
    }
    return out;
  }, [currentQueries]);

  // Monkey-patch the Prometheus datasource's query() to return fake time
  // series from our mock catalog, so "Run query" works without a live backend.
  // Restore the original method on unmount so switching prototypes / datasources
  // doesn't leave a stale patch around.
  useEffect(() => {
    if (!datasourceInstance || datasourceInstance.type !== 'prometheus') {
      return;
    }
    // Cast to a mutable shape — DataSourceApi.query is a method reference, but
    // we're deliberately replacing it on this instance for the prototype.
    const ds = datasourceInstance as unknown as { query: unknown };
    const original = ds.query;
    ds.query = mockPrometheusQuery;
    return () => {
      ds.query = original;
    };
  }, [datasourceInstance]);

  // While the rail is mounted, hide the two Grafana-owned buttons that this
  // rail replaces: the "Metrics browser" chooser in the PromQL query editor
  // (from @grafana/prometheus) and the "Outline" toggle in the Explore toolbar.
  // Applied via body attribute + injected stylesheet so both live and unmount
  // when the rail does.
  useEffect(() => {
    document.body.setAttribute('data-prom-proto-rail', 'true');
    const style = document.createElement('style');
    style.setAttribute('data-prom-proto', 'true');
    // Grafana's versioned selectors sometimes render with the literal
    // "data-testid " prefix baked into the attribute value; substring matches
    // handle either case.
    style.textContent = `
      body[data-prom-proto-rail="true"] [data-testid*="open metrics browser"],
      body[data-prom-proto-rail="true"] [data-testid*="explore-toolbar-content-outline-button"] {
        display: none !important;
      }
    `;
    document.head.appendChild(style);
    return () => {
      document.body.removeAttribute('data-prom-proto-rail');
      style.remove();
    };
  }, []);

  // Stats panel only shows for the explicitly-selected metric (no hover preview).
  const activeMetric = selectedMetric;

  // Build a PromQuery-shaped DataQuery attached to the current datasource.
  const buildQuery = (expr: string, refId: string): DataQuery & { expr: string } => ({
    refId,
    // The Prometheus datasource treats this as a PromQuery — expr is the query text.
    expr,
    datasource: datasourceInstance?.getRef(),
  });

  // Resolve an ambiguous choice using the preview text for that choice.
  const resolveAmbiguous = (choice: InsertionChoice, preview: string) => {
    if (choice === 'overwrite') {
      replaceEditorText(preview);
      return;
    }
    if (choice === 'newQuery') {
      // Append a fresh query to the same pane (A becomes A + B).
      const nextRefId = getNextRefId(currentQueries);
      const nextQueries = [...currentQueries, buildQuery(preview, nextRefId)];
      dispatch(changeQueries({ exploreId, queries: nextQueries }));
      return;
    }
    if (choice === 'splitView' && datasourceInstance?.uid) {
      // Open a new pane whose sole query is our preview.
      dispatch(
        splitOpen({
          datasourceUid: datasourceInstance.uid,
          queries: [buildQuery(preview, 'A')],
        })
      );
    }
  };

  const runInsertion = (result: ReturnType<typeof insertMetric | typeof insertLabelValueAtCursor>, anchor: DOMRect) => {
    if (isAmbiguous(result)) {
      setAmbiguous({
        insertion: result,
        anchor,
        resolve: (choice) => {
          const preview = result.previews[choice];
          if (preview) {
            resolveAmbiguous(choice, preview);
          }
        },
      });
    } else {
      insertAtCursorWithNewCursor(result.text, result.cursor);
    }
  };

  // Click metric name — dock stats + expand nested labels. No insertion.
  const handleMetricClick = (metric: MockMetric) => {
    setSelectedMetric(metric);
  };

  const handleMetricAdd = (metric: MockMetric, anchor: DOMRect) => {
    setSelectedMetric(metric);
    const snap = getEditorSnapshot() ?? { text: '', cursor: 0 };
    runInsertion(insertMetric(metric.name, snap), anchor);
  };

  // Shared logic for label/value insertions from the tree. Because the tree
  // already knows the parent metric, we can check whether the current query is
  // for the same metric and route the flow accordingly:
  //   - Empty query      → insert the whole selector directly (metric{snippet}).
  //   - Same metric      → normal in-place insertion, comma-aware.
  //   - Different metric → ambiguous menu, with previews set to the whole
  //     selector for all three choices ("Add new query" builds a real B query
  //     starting from `metric{snippet}`, not just the bare snippet).
  //   - Ambiguous for other reasons (function wrap, multi-selector) → same
  //     menu, same whole-selector previews.
  const runLabelOrValueInsertion = (
    metric: MockMetric,
    snippet: string,
    insertFn: (snap: { text: string; cursor: number }) => ReturnType<typeof insertLabelValueAtCursor>,
    anchor: DOMRect
  ) => {
    const snap = getEditorSnapshot() ?? { text: '', cursor: 0 };
    const wholeSelector = `${metric.name}{${snippet}}`;

    if (snap.text.trim().length === 0) {
      // Empty editor — just fill in the whole selector; nothing to disambiguate.
      replaceEditorText(wholeSelector);
      return;
    }

    const queryMetric = detectMetricInExpr(snap.text);

    const showAmbiguous = (reason: string) => {
      setAmbiguous({
        insertion: {
          needsChoice: true,
          reason,
          options: ['overwrite', 'newQuery', 'splitView'],
          previews: {
            overwrite: wholeSelector,
            newQuery: wholeSelector,
            splitView: wholeSelector,
          },
        },
        anchor,
        resolve: (choice) => resolveAmbiguous(choice, wholeSelector),
      });
    };

    if (queryMetric && queryMetric.name !== metric.name) {
      showAmbiguous(`${queryMetric.name} is already being queried`);
      return;
    }

    const result = insertFn(snap);
    if (isAmbiguous(result)) {
      showAmbiguous(result.reason);
    } else {
      insertAtCursorWithNewCursor(result.text, result.cursor);
    }
  };

  const handleLabelAdd = (metric: MockMetric, label: string, anchor: DOMRect) => {
    runLabelOrValueInsertion(metric, `${label}!=""`, (snap) => insertLabelPresence(label, snap), anchor);
  };

  const handleLabelExclude = (metric: MockMetric, label: string, anchor: DOMRect) => {
    runLabelOrValueInsertion(metric, `${label}=""`, (snap) => insertLabelAbsence(label, snap), anchor);
  };

  const handleValueAdd = (metric: MockMetric, label: string, value: string, anchor: DOMRect) => {
    runLabelOrValueInsertion(
      metric,
      `${label}="${value}"`,
      (snap) => insertLabelValueAtCursor(label, value, snap),
      anchor
    );
  };

  const handleValueExclude = (metric: MockMetric, label: string, value: string, anchor: DOMRect) => {
    runLabelOrValueInsertion(
      metric,
      `${label}!="${value}"`,
      (snap) => insertLabelValueExclusion(label, value, snap),
      anchor
    );
  };

  // Collapsed view: narrow icon strip.
  if (railCollapsed) {
    const anchorRect = overlayAnchorRef.current?.getBoundingClientRect() ?? null;
    return (
      <>
        <div className={cx(styles.rail, styles.railCollapsed)}>
          <button
            type="button"
            aria-label="Expand datasource explorer"
            title="Expand"
            className={cx(styles.iconStripBtnNative, styles.iconStripExpand)}
            onClick={() => setRailCollapsed(false)}
          >
            <Icon name="arrow-from-right" />
          </button>
          <button
            ref={overlayAnchorRef}
            type="button"
            aria-label="Browse metrics"
            title="Metrics"
            className={cx(styles.iconStripBtnNative, overlayOpen && styles.iconStripBtnActive)}
            onClick={() => setOverlayOpen((v) => !v)}
          >
            <Icon name="database" />
          </button>
          <div className={styles.iconStripSpacer} />
          <EmbeddedOutline scroller={scroller} compact />
        </div>
        {overlayOpen && anchorRect && (
          <MetricsBrowserOverlay
            anchor={anchorRect}
            filter={filter}
            onFilterChange={setFilter}
            onDismiss={() => setOverlayOpen(false)}
            onMetricClick={(m) => {
              setOverlayOpen(false);
              setRailCollapsed(false);
              handleMetricClick(m);
            }}
            onMetricAdd={(m, a) => {
              setOverlayOpen(false);
              setRailCollapsed(false);
              handleMetricAdd(m, a);
            }}
            onLabelAdd={(m, l, a) => {
              setOverlayOpen(false);
              setRailCollapsed(false);
              handleLabelAdd(m, l, a);
            }}
            onLabelExclude={(m, l, a) => {
              setOverlayOpen(false);
              setRailCollapsed(false);
              handleLabelExclude(m, l, a);
            }}
            onValueAdd={(m, l, v, a) => {
              setOverlayOpen(false);
              setRailCollapsed(false);
              handleValueAdd(m, l, v, a);
            }}
            onValueExclude={(m, l, v, a) => {
              setOverlayOpen(false);
              setRailCollapsed(false);
              handleValueExclude(m, l, v, a);
            }}
          />
        )}
        {ambiguous && (
          <InsertionActionMenu
            reason={ambiguous.insertion.reason}
            options={ambiguous.insertion.options}
            anchor={ambiguous.anchor}
            onPick={ambiguous.resolve}
            onDismiss={() => setAmbiguous(null)}
          />
        )}
        <CounterSuggestionsPopover />
      </>
    );
  }

  // Expanded view.
  return (
    <div className={styles.rail}>
      <div className={styles.header}>
        <span className={styles.title}>Datasource explorer</span>
        <button
          type="button"
          aria-label="Collapse datasource explorer"
          title="Collapse"
          className={styles.headerIconBtn}
          onClick={() => setRailCollapsed(true)}
        >
          <Icon name="arrow-from-right" className={styles.iconFlipped} />
        </button>
      </div>

      <div className={styles.metricsSection}>
        <div className={styles.sectionLabel}>Metrics</div>
        <Input
          className={styles.search}
          placeholder="Search metrics"
          value={filter}
          onChange={(e) => setFilter(e.currentTarget.value)}
          prefix={<Icon name="search" />}
          suffix={
            filter ? (
              <IconButton name="times" aria-label="Clear search" tooltip="Clear" onClick={() => setFilter('')} />
            ) : null
          }
        />
        <div className={styles.treeWrap}>
          <MetricTree
            filter={filter}
            onFilterChange={setFilter}
            hideSearch
            onMetricClick={handleMetricClick}
            onMetricAdd={handleMetricAdd}
            onLabelAdd={handleLabelAdd}
            onLabelExclude={handleLabelExclude}
            onValueAdd={handleValueAdd}
            onValueExclude={handleValueExclude}
            queryRefsByMetric={queryRefsByMetric}
            highlightedMetricName={selectedMetric?.name}
          />
        </div>
        {activeMetric && (
          <div className={styles.dockedStats}>
            <ScrollContainer>
              <MetricStatsPanel metric={activeMetric} onClose={() => setSelectedMetric(null)} />
            </ScrollContainer>
          </div>
        )}
      </div>

      <div className={styles.outlineSection}>
        <div className={styles.sectionLabel}>Outline</div>
        <EmbeddedOutline scroller={scroller} />
      </div>

      {ambiguous && (
        <InsertionActionMenu
          reason={ambiguous.insertion.reason}
          options={ambiguous.insertion.options}
          anchor={ambiguous.anchor}
          onPick={ambiguous.resolve}
          onDismiss={() => setAmbiguous(null)}
        />
      )}
      <CounterSuggestionsPopover />
    </div>
  );
}

const RAIL_WIDTH = 300;
const RAIL_COLLAPSED_WIDTH = 44;

const getStyles = (theme: GrafanaTheme2) => ({
  rail: css({
    display: 'flex',
    flexDirection: 'column',
    width: RAIL_WIDTH,
    minWidth: RAIL_WIDTH,
    marginRight: theme.spacing(1),
    marginBottom: theme.spacing(2),
    background: theme.colors.background.primary,
    border: `1px solid ${theme.colors.border.weak}`,
    borderRadius: theme.shape.radius.default,
    position: 'relative',
    overflow: 'hidden',
  }),
  railCollapsed: css({
    width: RAIL_COLLAPSED_WIDTH,
    minWidth: RAIL_COLLAPSED_WIDTH,
    alignItems: 'center',
    padding: theme.spacing(1, 0),
    gap: theme.spacing(0.5),
  }),
  header: css({
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: theme.spacing(1.5, 1.5, 1),
  }),
  title: css({
    fontSize: theme.typography.size.md,
    fontWeight: theme.typography.fontWeightMedium,
    color: theme.colors.text.primary,
  }),
  headerIconBtn: css({
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: 28,
    height: 28,
    background: 'transparent',
    border: 'none',
    color: theme.colors.text.secondary,
    cursor: 'pointer',
    borderRadius: theme.shape.radius.default,
    '&:hover': {
      background: theme.colors.action.hover,
      color: theme.colors.text.primary,
    },
  }),
  sectionLabel: css({
    padding: theme.spacing(1, 1.5, 0.5),
    fontSize: theme.typography.size.sm,
    color: theme.colors.text.secondary,
    fontWeight: theme.typography.fontWeightMedium,
  }),
  metricsSection: css({
    display: 'flex',
    flexDirection: 'column',
    flex: 1,
    minHeight: 0,
  }),
  search: css({
    padding: theme.spacing(0, 1.5, 0.5),
  }),
  treeWrap: css({
    display: 'flex',
    flexDirection: 'column',
    flex: 1,
    minHeight: 0,
    padding: theme.spacing(0, 0.5),
  }),
  dockedStats: css({
    borderTop: `1px solid ${theme.colors.border.weak}`,
    padding: theme.spacing(1),
    maxHeight: '40%',
    display: 'flex',
    flexDirection: 'column',
    minHeight: 0,
  }),
  // The one divider that image 7 shows: between the Metrics section and the Outline section.
  outlineSection: css({
    borderTop: `1px solid ${theme.colors.border.weak}`,
    paddingBottom: theme.spacing(1),
  }),
  iconStripExpand: css({
    marginBottom: theme.spacing(0.5),
  }),
  iconFlipped: css({
    transform: 'rotate(180deg)',
  }),
  iconStripBtnNative: css({
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: 32,
    height: 32,
    background: 'transparent',
    border: 'none',
    color: theme.colors.text.secondary,
    cursor: 'pointer',
    borderRadius: theme.shape.radius.default,
    '&:hover': {
      background: theme.colors.action.hover,
      color: theme.colors.text.primary,
    },
  }),
  iconStripBtnActive: css({
    background: theme.colors.action.selected,
    color: theme.colors.primary.text,
  }),
  iconStripSpacer: css({
    flex: 1,
    minHeight: theme.spacing(2),
  }),
});
