import { css } from '@emotion/css';
import { type ReactNode, useEffect, useMemo, useState } from 'react';

import { type DataSourceApi, type GrafanaTheme2 } from '@grafana/data';
import { t } from '@grafana/i18n';
import { getDataSourceSrv } from '@grafana/runtime';
import { type DataQuery } from '@grafana/schema';
import { ScrollContainer, useStyles2 } from '@grafana/ui';

import { isPrometheusType } from '../../utils/prometheus';
import { useContentOutlineContext } from '../ContentOutlineContext';
import { scrollOutlineItemIntoView } from '../scrollIntoView';

import { MetricsList } from './MetricsList';
import { SignalCard } from './SignalCard';

/**
 * Panel id that query rows register themselves under in the content outline.
 * @see QueryRows
 */
const QUERIES_PANEL_ID = 'Queries';

interface CardDescriptor {
  refId: string;
  datasourceName: string;
  datasourceLogo?: string;
  isExpandable: boolean;
}

interface Props {
  queries: DataQuery[];
  /**
   * Pane-level datasource, used for queries that don't carry their own ref so that
   * single-datasource panes render the same cards as Mixed panes.
   */
  paneDatasource: DataSourceApi | null | undefined;
  scroller: HTMLElement | undefined;
  /** Owned by ContentOutline, which holds the collapse state for the whole sidebar. */
  toggleButton: ReactNode;
}

/**
 * Datasource explorer sidebar: one card per query, so Mixed mode makes it clear
 * which query and datasource the user is interacting with.
 */
export function SignalExplorer({ queries, paneDatasource, scroller, toggleButton }: Props) {
  const styles = useStyles2(getStyles);
  const { outlineItems } = useContentOutlineContext() ?? { outlineItems: [] };
  const [expandedRefIds, setExpandedRefIds] = useState<Set<string>>(new Set());

  // The `queries` array is replaced on every keystroke in a query editor, but the cards
  // only depend on refIds and datasource refs. Key the memo on just those so typing an
  // expression doesn't rebuild the cards and re-resolve datasource settings per character.
  const cardsKey = JSON.stringify(queries.map((query) => [query.refId, query.datasource?.uid, query.datasource?.type]));

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
      };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- cardsKey covers the parts of `queries` the cards read.
  }, [cardsKey, paneDatasource]);

  // Deleting a query has to drop its expanded state, because Explore hands out the
  // lowest unused refId when a query is added: keeping it would make the next query in
  // that slot render already expanded.
  useEffect(() => {
    setExpandedRefIds((prev) => {
      if (prev.size === 0) {
        return prev;
      }

      const live = new Set(cards.map((card) => card.refId));
      const next = new Set([...prev].filter((refId) => live.has(refId)));

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
                <MetricsList />
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
