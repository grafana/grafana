// Prototype-only. Not internationalized.
// Query-card rail used for both Mixed panes and single-datasource Prometheus
// panes (so the experience is consistent). Each query becomes a card:
//   - Prometheus query → the chevron (hover) expands its own MetricTree;
//     clicking a metric docks its stats at the bottom of the rail.
//   - Any non-Prometheus query (e.g. our fake Loki) → no metrics to browse.
// Clicking a card jumps to that query in the query UI. Adding from a card's
// tree routes to that card's query: an unambiguous insertion rewrites the
// query's expr; an ambiguous one reuses the shared overwrite / new-query /
// split-view menu. Sections top-to-bottom: Queries · docked metric stats ·
// "Jump to" (Graph/Table outline items).
/* eslint-disable @grafana/i18n/no-untranslated-strings -- prototype-only, not internationalized */
/* eslint-disable @typescript-eslint/consistent-type-assertions -- prototype-only casts (query shapes, monkey-patching) */

import { css, cx } from '@emotion/css';
import { useEffect, useMemo, useRef, useState } from 'react';

import { colorManipulator, getNextRefId, type GrafanaTheme2 } from '@grafana/data';
import { getDataSourceSrv } from '@grafana/runtime';
import { type DataQuery, type DataSourceRef } from '@grafana/schema';
import { Icon, ScrollContainer, useStyles2 } from '@grafana/ui';
import { type StoreState, useDispatch, useSelector } from 'app/types/store';

import { useContentOutlineContext } from '../ContentOutline/ContentOutlineContext';
import { splitOpen } from '../state/main';
import { changeQueries } from '../state/query';

import { EmbeddedOutline } from './EmbeddedOutline';
import { InsertionActionMenu } from './InsertionActionMenu';
import { MetricStatsPanel } from './MetricStatsPanel';
import { MetricTree } from './MetricTree';
import { usePromPrototype } from './PromPrototypeContext';
import { mockPrometheusQuery } from './mockPrometheusQuery';
import { subscribeToEditorSelection } from './promEditorBridge';
import { detectMetricInExpr, findMetric, type MockMetric } from './prometheusMockCatalog';
import {
  insertLabelAbsence,
  insertLabelPresence,
  insertLabelValueAtCursor,
  insertLabelValueExclusion,
  insertMetric,
  isAmbiguous,
  type InsertionChoice,
  type MaybeAmbiguous,
} from './promqlInsertion';

interface Props {
  exploreId: string;
  scroller: HTMLElement | undefined;
}

interface AmbiguousState {
  reason: string;
  options: InsertionChoice[];
  anchor: DOMRect;
  resolve: (choice: InsertionChoice) => void;
}

type ExprQuery = DataQuery & { expr?: string };

export function MixedQueryRail({ exploreId, scroller }: Props) {
  const styles = useStyles2(getStyles);
  const dispatch = useDispatch();
  const { railCollapsed, setRailCollapsed } = usePromPrototype();
  const outlineCtx = useContentOutlineContext();
  const currentQueries = useSelector((state: StoreState) => state.explore.panes[exploreId]?.queries ?? []);
  // Pane data source — used as the fallback for queries that don't carry their
  // own ref (single-datasource panes, where every query inherits the pane DS).
  const paneDatasource = useSelector((state: StoreState) => state.explore.panes[exploreId]?.datasourceInstance);

  // Latest queries, read inside the (once-subscribed) editor-selection handler
  // without re-subscribing on every keystroke.
  const queriesRef = useRef(currentQueries);
  queriesRef.current = currentQueries;

  const [filterByRef, setFilterByRef] = useState<Record<string, string>>({});
  // A single active metric selection across all cards — its stats show in a
  // popover anchored beside the rail (rather than docked inside the card).
  const [selected, setSelected] = useState<{ refId: string; metric: MockMetric } | null>(null);
  // null = untouched (default: first Prometheus card expanded). Once the user
  // toggles anything, this becomes the concrete set of expanded refIds.
  const [expandedRefs, setExpandedRefs] = useState<Set<string> | null>(null);
  const [ambiguous, setAmbiguous] = useState<AmbiguousState | null>(null);

  // Resolve each query's data source type/name once per query list change.
  // Falls back to the pane data source so single-DS panes (e.g. a plain
  // Prometheus pane) render the same query cards as Mixed panes.
  const cards = useMemo(() => {
    const paneRef = paneDatasource?.getRef();
    return currentQueries.map((q) => {
      const ref = q.datasource ?? paneRef ?? undefined;
      const settings = ref ? getDataSourceSrv().getInstanceSettings(ref) : undefined;
      const type = settings?.type ?? ref?.type ?? 'unknown';
      return {
        refId: q.refId,
        ref,
        type,
        name: settings?.name ?? type,
        logo: settings?.meta.info.logos.small,
        isPrometheus: type === 'prometheus',
      };
    });
  }, [currentQueries, paneDatasource]);

  // Effective expanded set: the user's explicit choices, or (until they touch
  // anything) the first Prometheus card expanded by default.
  const effectiveExpanded = useMemo(() => {
    if (expandedRefs) {
      return expandedRefs;
    }
    const firstProm = cards.find((c) => c.isPrometheus);
    return new Set<string>(firstProm ? [firstProm.refId] : []);
  }, [expandedRefs, cards]);

  const toggleExpanded = (refId: string) => {
    setExpandedRefs((prev) => {
      const base = prev ?? effectiveExpanded;
      const next = new Set(base);
      if (next.has(refId)) {
        next.delete(refId);
      } else {
        next.add(refId);
      }
      return next;
    });
  };

  // Escape closes the metric stats popover.
  useEffect(() => {
    if (!selected) {
      return;
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setSelected(null);
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [selected]);

  // Highlighting a known metric name in a query editor docks that metric's
  // stats — switching from whatever was previously selected. Associates it with
  // the query that references it (if any) so that card's tree also highlights.
  useEffect(() => {
    return subscribeToEditorSelection((selectedText) => {
      if (!selectedText) {
        return;
      }
      const match = findMetric(selectedText) ?? detectMetricInExpr(selectedText);
      if (!match) {
        return;
      }
      const owning = queriesRef.current.find((q) => {
        const raw = (q as ExprQuery).expr;
        const expr = typeof raw === 'string' ? raw : '';
        return detectMetricInExpr(expr)?.name === match.name;
      });
      setSelected({ refId: owning?.refId ?? '', metric: match });
    });
  }, []);

  // Which metrics each query currently references — powers the A/B badges + top-sort
  // inside a Prometheus card's tree. Scoped to that one query.
  const refsForQuery = (refId: string): Record<string, string[]> => {
    const q = currentQueries.find((x) => x.refId === refId) as ExprQuery | undefined;
    const expr = typeof q?.expr === 'string' ? q.expr : '';
    const m = detectMetricInExpr(expr);
    return m ? { [m.name]: [refId] } : {};
  };

  // Patch the query() of every Prometheus instance referenced by the pane so
  // "Run query" returns fake series (Mixed dispatches through the real instance,
  // so we patch the same object it resolves). Restore on unmount / query change.
  useEffect(() => {
    const promUids = Array.from(new Set(cards.filter((c) => c.isPrometheus && c.ref?.uid).map((c) => c.ref!.uid!)));
    let cancelled = false;
    const restores: Array<() => void> = [];
    promUids.forEach((uid) => {
      getDataSourceSrv()
        .get(uid)
        .then((ds) => {
          if (cancelled) {
            return;
          }
          const inst = ds as unknown as { query: unknown };
          if (inst.query === mockPrometheusQuery) {
            return;
          }
          const original = inst.query;
          inst.query = mockPrometheusQuery;
          restores.push(() => {
            inst.query = original;
          });
        })
        .catch(() => {});
    });
    return () => {
      cancelled = true;
      restores.forEach((r) => r());
    };
  }, [cards]);

  // Same body-attribute + stylesheet trick as PromMetricsRail: hide the two
  // Grafana-owned controls this rail replaces while it is mounted.
  useEffect(() => {
    document.body.setAttribute('data-prom-proto-rail', 'true');
    const style = document.createElement('style');
    style.setAttribute('data-prom-proto', 'true');
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

  const setFilter = (refId: string, value: string) => setFilterByRef((p) => ({ ...p, [refId]: value }));

  // Scroll the main pane to a query row. Each row is wrapped in a
  // ContentOutlineItem (title === refId, level 'child'), so we reuse its ref.
  const jumpToQuery = (refId: string) => {
    const item = (outlineCtx?.outlineItems ?? []).find((i) => i.level === 'child' && i.title === refId);
    const ref = item?.ref;
    if (!ref || !scroller) {
      return;
    }
    const scrollerTop = scroller.getBoundingClientRect().top;
    const refTop = ref.getBoundingClientRect().top;
    scroller.scrollTo({ top: scroller.scrollTop + refTop - scrollerTop - 8, behavior: 'smooth' });
  };

  const getExpr = (refId: string): string => {
    const q = currentQueries.find((x) => x.refId === refId) as ExprQuery | undefined;
    return typeof q?.expr === 'string' ? q.expr : '';
  };

  const updateQueryExpr = (refId: string, expr: string) => {
    const next = currentQueries.map((q) => (q.refId === refId ? { ...q, expr } : q));
    dispatch(changeQueries({ exploreId, queries: next }));
  };

  const appendQuery = (expr: string, ref: DataSourceRef | undefined) => {
    const nextRefId = getNextRefId(currentQueries);
    const newQuery: ExprQuery = { refId: nextRefId, expr, datasource: ref };
    dispatch(changeQueries({ exploreId, queries: [...currentQueries, newQuery] }));
  };

  // Turn an insertion result into either a direct expr rewrite or the shared
  // ambiguity menu, all scoped to one query (refId + its data source ref).
  const commit = (refId: string, ref: DataSourceRef | undefined, result: MaybeAmbiguous, anchor: DOMRect) => {
    if (!isAmbiguous(result)) {
      updateQueryExpr(refId, result.text);
      return;
    }
    setAmbiguous({
      reason: result.reason,
      options: result.options,
      anchor,
      resolve: (choice) => {
        const preview = result.previews[choice];
        if (!preview) {
          return;
        }
        if (choice === 'overwrite') {
          updateQueryExpr(refId, preview);
        } else if (choice === 'newQuery') {
          appendQuery(preview, ref);
        } else if (choice === 'splitView' && ref?.uid) {
          dispatch(splitOpen({ datasourceUid: ref.uid, queries: [{ refId: 'A', expr: preview, datasource: ref }] }));
        }
      },
    });
  };

  const handleMetricAdd = (refId: string, ref: DataSourceRef | undefined, metric: MockMetric, anchor: DOMRect) => {
    setSelected({ refId, metric });
    const expr = getExpr(refId);
    commit(refId, ref, insertMetric(metric.name, { text: expr, cursor: expr.length }), anchor);
  };

  // Label/value insertion, scoped to one query. Mirrors PromMetricsRail's
  // runLabelOrValueInsertion: empty expr → whole selector; a different metric
  // already queried → ambiguous (whole-selector previews); otherwise in-place.
  const runLabelOrValueInsertion = (
    refId: string,
    ref: DataSourceRef | undefined,
    metric: MockMetric,
    snippet: string,
    insertFn: (snap: { text: string; cursor: number }) => MaybeAmbiguous,
    anchor: DOMRect
  ) => {
    const expr = getExpr(refId);
    const wholeSelector = `${metric.name}{${snippet}}`;

    if (expr.trim().length === 0) {
      updateQueryExpr(refId, wholeSelector);
      return;
    }

    const showAmbiguous = (reason: string) =>
      commit(
        refId,
        ref,
        {
          needsChoice: true,
          reason,
          options: ['overwrite', 'newQuery', 'splitView'],
          previews: { overwrite: wholeSelector, newQuery: wholeSelector, splitView: wholeSelector },
        },
        anchor
      );

    const queryMetric = detectMetricInExpr(expr);
    if (queryMetric && queryMetric.name !== metric.name) {
      showAmbiguous(`${queryMetric.name} is already being queried`);
      return;
    }
    commit(refId, ref, insertFn({ text: expr, cursor: expr.length }), anchor);
  };

  // Only ever called for Prometheus cards (non-Prometheus cards don't expand).
  const renderCardBody = (card: (typeof cards)[number]) => {
    const highlighted = selected?.refId === card.refId ? selected.metric.name : undefined;
    return (
      <div className={styles.treeWrap}>
        <MetricTree
          filter={filterByRef[card.refId] ?? ''}
          onFilterChange={(f) => setFilter(card.refId, f)}
          searchClassName={styles.tallSearch}
          onMetricClick={(m) =>
            setSelected((cur) =>
              cur && cur.refId === card.refId && cur.metric.name === m.name ? null : { refId: card.refId, metric: m }
            )
          }
          onMetricAdd={(m, a) => handleMetricAdd(card.refId, card.ref, m, a)}
          onLabelAdd={(m, l, a) =>
            runLabelOrValueInsertion(card.refId, card.ref, m, `${l}!=""`, (snap) => insertLabelPresence(l, snap), a)
          }
          onLabelExclude={(m, l, a) =>
            runLabelOrValueInsertion(card.refId, card.ref, m, `${l}=""`, (snap) => insertLabelAbsence(l, snap), a)
          }
          onValueAdd={(m, l, v, a) =>
            runLabelOrValueInsertion(
              card.refId,
              card.ref,
              m,
              `${l}="${v}"`,
              (snap) => insertLabelValueAtCursor(l, v, snap),
              a
            )
          }
          onValueExclude={(m, l, v, a) =>
            runLabelOrValueInsertion(
              card.refId,
              card.ref,
              m,
              `${l}!="${v}"`,
              (snap) => insertLabelValueExclusion(l, v, snap),
              a
            )
          }
          queryRefsByMetric={refsForQuery(card.refId)}
          highlightedMetricName={highlighted}
        />
      </div>
    );
  };

  if (railCollapsed) {
    return (
      <div className={cx(styles.rail, styles.railCollapsed)}>
        <button
          type="button"
          aria-label="Expand datasource explorer"
          title="Expand"
          className={styles.iconStripBtn}
          onClick={() => setRailCollapsed(false)}
        >
          <Icon name="arrow-from-right" />
        </button>
        <div className={styles.iconStripSpacer} />
        <EmbeddedOutline scroller={scroller} compact />
      </div>
    );
  }

  const renderCard = (card: (typeof cards)[number], expanded: boolean) => {
    return (
      <div key={card.refId} className={cx(styles.card, expanded && styles.cardExpanded)}>
        {/* Clicking the card jumps to that query in the query UI; the chevron
            (Prometheus only) toggles the nested metrics explorer. */}
        <div
          className={cx(styles.cardHeader, card.isPrometheus && styles.cardHeaderProm)}
          role="button"
          tabIndex={0}
          title={`Jump to query ${card.refId}`}
          onClick={() => jumpToQuery(card.refId)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              jumpToQuery(card.refId);
            }
          }}
        >
          {card.isPrometheus && (
            <button
              type="button"
              className={styles.cardChevron}
              data-chevron
              aria-label={expanded ? 'Collapse metrics explorer' : 'Expand metrics explorer'}
              onClick={(e) => {
                e.stopPropagation();
                toggleExpanded(card.refId);
              }}
            >
              <Icon name={expanded ? 'angle-down' : 'angle-right'} />
            </button>
          )}
          <span className={styles.cardTitle}>{card.refId}</span>
          {card.logo ? (
            <img src={card.logo} alt="" className={styles.dsLogo} />
          ) : (
            <Icon name="database" className={styles.dsLogoFallback} />
          )}
          <span className={styles.dsName}>{card.name}</span>
        </div>
        {expanded && <div className={styles.cardBody}>{renderCardBody(card)}</div>}
      </div>
    );
  };

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

      <div className={styles.sectionLabel}>Queries</div>
      <div className={styles.cardsArea}>
        {cards.length === 0 && <div className={styles.emptyText}>Add a query to browse its data source.</div>}
        {/* Cards stay in query order; expanding one grows it in place and pushes
            the cards below it down. */}
        {cards.map((card) => renderCard(card, card.isPrometheus && effectiveExpanded.has(card.refId)))}
      </div>

      {/* Docked between the queries and the "Jump to" section; stays visible even
          when query cards are expanded. */}
      {selected && (
        <div className={styles.metricStats}>
          <ScrollContainer>
            <MetricStatsPanel metric={selected.metric} onClose={() => setSelected(null)} />
          </ScrollContainer>
        </div>
      )}

      <div className={styles.jumpToSection}>
        <div className={styles.sectionLabel}>Jump to</div>
        <EmbeddedOutline scroller={scroller} omitPanelIds={['Queries']} />
      </div>

      {ambiguous && (
        <InsertionActionMenu
          reason={ambiguous.reason}
          options={ambiguous.options}
          anchor={ambiguous.anchor}
          onPick={ambiguous.resolve}
          onDismiss={() => setAmbiguous(null)}
        />
      )}
    </div>
  );
}

const RAIL_WIDTH = 300;
const RAIL_COLLAPSED_WIDTH = 44;
// Matches the panel editor's SidebarCard sizing.
const SIDEBAR_CARD_HEIGHT = 30;
const SIDEBAR_CARD_SPACING = 1;

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
  iconFlipped: css({
    transform: 'rotate(180deg)',
  }),
  // Fills the space between the header and the outline; expanded explorers grow
  // into it, compact cards sit at the bottom.
  cardsArea: css({
    display: 'flex',
    flexDirection: 'column',
    flex: 1,
    minHeight: 0,
    overflowY: 'auto',
    gap: theme.spacing(SIDEBAR_CARD_SPACING),
    padding: theme.spacing(0, 1, 1),
  }),
  // Mirrors the panel editor's SidebarCard: primary background, medium border,
  // and (only when open) a slim orange accent strip down the left edge.
  card: css({
    position: 'relative',
    // Cards keep their natural height and order; an expanded one grows instead.
    flexShrink: 0,
    minHeight: SIDEBAR_CARD_HEIGHT,
    background: theme.colors.background.primary,
    border: `1px solid ${theme.colors.border.medium}`,
    borderRadius: theme.shape.radius.default,
    overflow: 'hidden',
  }),
  cardExpanded: css({
    display: 'flex',
    flexDirection: 'column',
    flex: 1,
    minHeight: 0,
    // Orange accent strip marks the open/selected card only.
    '&::before': {
      content: '""',
      position: 'absolute',
      left: 0,
      top: 0,
      bottom: 0,
      width: 2,
      background: theme.colors.warning.main,
    },
  }),
  cardHeader: css({
    position: 'relative',
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1),
    width: '100%',
    minHeight: SIDEBAR_CARD_HEIGHT,
    flexShrink: 0,
    padding: theme.spacing(0.5, 1, 0.5, 1.25),
    background: 'transparent',
    border: 'none',
    cursor: 'pointer',
    textAlign: 'left',
    overflow: 'hidden',
    minWidth: 0,
    '&:hover': {
      background: colorManipulator.alpha(theme.colors.text.primary, 0.08),
    },
  }),
  // Prometheus cards: chevron is absolutely positioned (no layout space at
  // rest, so titles stay flush-left). On hover the content shifts right to
  // expose it.
  cardHeaderProm: css({
    [theme.transitions.handleMotion('no-preference', 'reduce')]: {
      transition: theme.transitions.create(['padding-left'], {
        duration: theme.transitions.duration.shortest,
      }),
    },
    '&:hover': {
      paddingLeft: theme.spacing(3.5),
    },
    '&:hover [data-chevron]': {
      opacity: 1,
    },
  }),
  cardChevron: css({
    position: 'absolute',
    left: theme.spacing(1),
    top: '50%',
    transform: 'translateY(-50%)',
    display: 'flex',
    alignItems: 'center',
    padding: 0,
    background: 'transparent',
    border: 'none',
    cursor: 'pointer',
    color: theme.colors.text.secondary,
    opacity: 0,
    '&:hover': {
      color: theme.colors.text.primary,
    },
    [theme.transitions.handleMotion('no-preference', 'reduce')]: {
      transition: theme.transitions.create(['opacity'], {
        duration: theme.transitions.duration.shortest,
      }),
    },
  }),
  cardTitle: css({
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    color: theme.colors.text.primary,
    ...theme.typography.code,
    fontWeight: theme.typography.fontWeightLight,
    flexShrink: 0,
  }),
  dsLogo: css({
    width: 16,
    height: 16,
    flexShrink: 0,
  }),
  dsLogoFallback: css({
    color: theme.colors.text.secondary,
    flexShrink: 0,
  }),
  dsName: css({
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    color: theme.colors.text.secondary,
    fontSize: theme.typography.size.sm,
  }),
  cardBody: css({
    display: 'flex',
    flexDirection: 'column',
    flex: 1,
    minHeight: 0,
    borderTop: `1px solid ${theme.colors.border.weak}`,
  }),
  treeWrap: css({
    display: 'flex',
    flexDirection: 'column',
    flex: 1,
    minHeight: 0,
    padding: theme.spacing(0.5, 0.5, 1),
  }),
  tallSearch: css({
    height: theme.spacing(4.5),
    '& input': {
      height: '100%',
    },
  }),
  // Docked metric stats: pinned between the queries and the "Jump to" section,
  // capped in height with its own scroll so it stays visible.
  metricStats: css({
    flexShrink: 0,
    maxHeight: '40%',
    display: 'flex',
    flexDirection: 'column',
    minHeight: 0,
    borderTop: `1px solid ${theme.colors.border.weak}`,
    padding: theme.spacing(1),
  }),
  emptyText: css({
    color: theme.colors.text.secondary,
    fontSize: theme.typography.size.sm,
    padding: theme.spacing(0, 0.5),
  }),
  sectionLabel: css({
    flexShrink: 0,
    padding: theme.spacing(1, 1.5, 0.5),
    fontSize: theme.typography.size.sm,
    color: theme.colors.text.secondary,
    fontWeight: theme.typography.fontWeightMedium,
  }),
  jumpToSection: css({
    flexShrink: 0,
    borderTop: `1px solid ${theme.colors.border.weak}`,
    paddingBottom: theme.spacing(1),
  }),
  iconStripBtn: css({
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
  iconStripSpacer: css({
    flex: 1,
    minHeight: theme.spacing(2),
  }),
});
