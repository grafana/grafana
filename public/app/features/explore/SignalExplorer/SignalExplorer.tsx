import { css } from '@emotion/css';
import { type ReactNode, useEffect, useMemo, useState } from 'react';

import { type DataSourceApi, type GrafanaTheme2, type TimeRange } from '@grafana/data';
import { t } from '@grafana/i18n';
import { useDatasourcePluginMetas } from '@grafana/runtime/internal';
import { useDataSourceInstanceList } from '@grafana/runtime/unstable';
import { type DataQuery, type DataSourceRef } from '@grafana/schema';
import { ScrollContainer, useStyles2 } from '@grafana/ui';

import { useContentOutlineContext } from '../ContentOutline/ContentOutlineContext';
import { QUERIES_PANEL_ID } from '../ContentOutline/ContentOutlineItem';
import { scrollOutlineItemIntoView } from '../ContentOutline/scrollIntoView';
import { isPrometheusType } from '../utils/prometheus';

import { MetricsList } from './MetricsList';
import { SignalCard } from './SignalCard';

interface CardDescriptor {
  refId: string;
  datasourceName: string;
  datasourceLogo?: string;
  isExpandable: boolean;
  /**
   * Kept as primitives rather than a `DataSourceRef` because `MetricsList` is the `memo()` boundary
   * this crosses: these descriptors are rebuilt on every keystroke in a query editor, since `queries`
   * arrives from the store with a fresh identity, and a new ref object each time would re-render the
   * metrics list for a datasource that never changed. `MetricsList` assembles the ref once and passes
   * it on as an object from there.
   */
  dsUid?: string;
  dsType?: string;
}

interface Props {
  queries: DataQuery[];
  /**
   * Pane-level datasource, used for queries that don't carry their own ref so that
   * single-datasource panes render the same cards as Mixed panes.
   */
  paneDatasource: DataSourceApi | null | undefined;
  /** The pane's range, which scopes every metric and label lookup a card makes. */
  timeRange: TimeRange;
  scroller: HTMLElement | undefined;
  /** Owned by ContentOutline, which holds the collapse state for the whole sidebar. */
  toggleButton: ReactNode;
}

/**
 * Datasource explorer sidebar: one card per query, so Mixed mode makes it clear
 * which query and datasource the user is interacting with.
 */
export function SignalExplorer({ queries, paneDatasource, timeRange, scroller, toggleButton }: Props) {
  const styles = useStyles2(getStyles);
  const { outlineItems } = useContentOutlineContext() ?? { outlineItems: [] };
  const [expandedRefIds, setExpandedRefIds] = useState<Set<string>>(new Set());

  // The whole list once, rather than a lookup per ref: a card's datasource is resolved inside the
  // memo below, and one hook per query would break the rules of hooks as queries come and go.
  // `all` because a query can target any datasource, whatever capabilities its plugin reports, and
  // `mixed` so a Mixed pane's own datasource resolves for a query that carries no ref of its own.
  const { items: dataSourceItems } = useDataSourceInstanceList({ all: true, mixed: true });
  // Logos come from the plugin metas keyed by type, not from the resolved instance, so a ref that
  // matches no instance still shows its plugin's logo alongside the type it names.
  const { value: pluginMetas } = useDatasourcePluginMetas();

  const logosByType = useMemo(() => {
    const logos = new Map<string, string | undefined>();

    for (const meta of pluginMetas ?? []) {
      logos.set(meta.id, meta.info.logos.small);
      // A datasource instance's type can be the old id of a renamed plugin.
      for (const aliasId of meta.aliasIDs ?? []) {
        logos.set(aliasId, meta.info.logos.small);
      }
    }

    return logos;
  }, [pluginMetas]);

  const cards: CardDescriptor[] = useMemo(() => {
    const paneRef = paneDatasource?.uid ? { uid: paneDatasource.uid, type: paneDatasource.type } : undefined;

    return queries.map((query) => {
      // Widened past the declared type because legacy Explore URLs still carry a query's
      // `datasource` as a plain uid-or-name string, and a Mixed pane keeps that form in state
      // rather than rewriting it to a ref. The settings lookup this replaced accepted it.
      const rawRef: DataSourceRef | string | null | undefined = query.datasource ?? paneRef;
      const ref = typeof rawRef === 'string' ? { uid: rawRef } : rawRef;
      // Matched on name as well as uid: a ref can name its datasource rather than carry its uid,
      // and the settings lookup this replaced resolved either form.
      const item = ref?.uid ? dataSourceItems.find((ds) => ds.uid === ref.uid || ds.name === ref.uid) : undefined;
      const type = item?.type ?? ref?.type;

      return {
        refId: query.refId,
        datasourceName: item?.name ?? type ?? t('explore.signal-explorer.unknown-datasource', 'Unknown datasource'),
        datasourceLogo: type ? logosByType.get(type) : undefined,
        // Prometheus is currently the only datasource with an explorer to open.
        isExpandable: isPrometheusType(type),
        // The resolved uid rather than the ref's: a ref naming a datasource by name resolves to the
        // uid here, and the uid is what the metric cache keys its entries on.
        dsUid: item?.uid ?? ref?.uid,
        dsType: type,
      };
    });
  }, [queries, paneDatasource, dataSourceItems, logosByType]);

  // A card's expanded state has to go away with the card's ability to expand:
  // - a deleted query, because Explore hands out the lowest unused refId when a query is
  //   added, so the next query in that slot would render already expanded;
  // - a query that moved to a datasource with no explorer, because the card collapses on
  //   screen and would otherwise reopen by itself if the query moved back.
  useEffect(() => {
    setExpandedRefIds((prev) => {
      if (prev.size === 0) {
        return prev;
      }

      const expandable = new Set(cards.filter((card) => card.isExpandable).map((card) => card.refId));
      const next = new Set([...prev].filter((refId) => expandable.has(refId)));

      // Returning the previous set lets React skip the extra render.
      return next.size === prev.size ? prev : next;
    });
  }, [cards]);

  const toggleExpanded = (refId: string) => {
    setExpandedRefIds((prev) => {
      const next = new Set(prev);
      if (!next.delete(refId)) {
        next.add(refId);
      }
      return next;
    });
  };

  const jumpToQuery = (refId: string) => {
    // Query rows register themselves as children of the Queries outline item, so
    // reuse those refs to scroll exactly like the outline does.
    const queriesItem = outlineItems.find((item) => item.panelId === QUERIES_PANEL_ID && item.level === 'root');
    const queryItem = queriesItem?.children?.find((child) => child.title === refId);

    if (!queryItem) {
      return;
    }

    scrollOutlineItemIntoView(scroller, queryItem.ref, queryItem.customTopOffset);
  };

  return (
    <div className={styles.wrapper}>
      <div className={styles.header}>
        <span className={styles.headerTitle}>
          {t('explore.signal-explorer.title-datasource-explorer', 'Datasource explorer')}
        </span>
        <div className={styles.toggleWrapper}>{toggleButton}</div>
      </div>

      <div className={styles.sectionLabel}>{t('explore.signal-explorer.section-label-queries', 'Queries')}</div>
      <ScrollContainer>
        <div className={styles.cards}>
          {/* Explore always hands over at least one query today, because the sidebar is
              gated on a Prometheus datasource being present. Kept because an empty list
              is a legal input to this component. */}
          {cards.length === 0 ? (
            <div className={styles.emptyText}>
              {t('explore.signal-explorer.empty-text', 'Add a query to browse its datasource.')}
            </div>
          ) : (
            cards.map((card) => (
              <SignalCard
                key={card.refId}
                refId={card.refId}
                datasourceName={card.datasourceName}
                datasourceLogo={card.datasourceLogo}
                isExpandable={card.isExpandable}
                isExpanded={expandedRefIds.has(card.refId)}
                onToggleExpanded={() => toggleExpanded(card.refId)}
                onJumpToQuery={() => jumpToQuery(card.refId)}
              >
                <MetricsList dsUid={card.dsUid} dsType={card.dsType} timeRange={timeRange} />
              </SignalCard>
            ))
          )}
        </div>
      </ScrollContainer>
    </div>
  );
}

const getStyles = (theme: GrafanaTheme2) => {
  return {
    wrapper: css({
      label: 'signal-explorer',
      display: 'flex',
      flexDirection: 'column',
      flex: '1 1 auto',
      minHeight: 0,
    }),
    header: css({
      label: 'signal-explorer-header',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: theme.spacing(1),
      flex: '0 0 auto',
      padding: theme.spacing(1, 1, 0.5, 1),
    }),
    headerTitle: css({
      label: 'signal-explorer-header-title',
      flex: '1 1 auto',
      minWidth: 0,
      fontSize: theme.typography.h6.fontSize,
      fontWeight: theme.typography.fontWeightMedium,
      color: theme.colors.text.primary,
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      whiteSpace: 'nowrap',
    }),
    toggleWrapper: css({
      label: 'signal-explorer-toggle-wrapper',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      flex: '0 0 auto',
      width: theme.spacing(4),
    }),
    sectionLabel: css({
      label: 'signal-explorer-section-label',
      flex: '0 0 auto',
      padding: theme.spacing(0.5, 1),
      fontSize: theme.typography.size.sm,
      fontWeight: theme.typography.fontWeightMedium,
      color: theme.colors.text.secondary,
    }),
    cards: css({
      label: 'signal-explorer-cards',
      display: 'flex',
      flexDirection: 'column',
      gap: theme.spacing(1),
      padding: theme.spacing(0, 1, 1),
    }),
    emptyText: css({
      label: 'signal-explorer-empty-text',
      color: theme.colors.text.secondary,
      fontSize: theme.typography.size.sm,
      padding: theme.spacing(0, 0.5),
    }),
  };
};
