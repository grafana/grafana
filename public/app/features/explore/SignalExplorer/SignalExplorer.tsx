import { css } from '@emotion/css';
import { type ReactNode, useEffect, useMemo, useState } from 'react';

import { type DataSourceApi, type GrafanaTheme2, type TimeRange } from '@grafana/data';
import { t } from '@grafana/i18n';
import { getDataSourceSrv } from '@grafana/runtime';
import { type DataQuery } from '@grafana/schema';
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

  const cards: CardDescriptor[] = useMemo(() => {
    const paneRef = paneDatasource?.uid ? { uid: paneDatasource.uid, type: paneDatasource.type } : undefined;

    return queries.map((query) => {
      const ref = query.datasource ?? paneRef;
      const settings = ref ? getDataSourceSrv().getInstanceSettings(ref) : undefined;
      const type = settings?.type ?? ref?.type;

      return {
        refId: query.refId,
        datasourceName: settings?.name ?? type ?? t('explore.signal-explorer.unknown-datasource', 'Unknown datasource'),
        datasourceLogo: settings?.meta.info.logos.small,
        // Prometheus is currently the only datasource with an explorer to open.
        isExpandable: isPrometheusType(type),
        // The settings uid rather than the ref's: a ref naming a datasource by name resolves to the
        // uid here, and the uid is what the metric cache keys its entries on.
        dsUid: settings?.uid ?? ref?.uid,
        dsType: type,
      };
    });
  }, [queries, paneDatasource]);

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
