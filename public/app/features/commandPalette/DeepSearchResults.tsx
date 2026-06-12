import { css } from '@emotion/css';
import * as React from 'react';
import { useImperativeHandle, useRef } from 'react';

import { type GrafanaTheme2, locationUtil } from '@grafana/data';
import { t } from '@grafana/i18n';
import { LoadingBar, useStyles2 } from '@grafana/ui';

import { type DeepSearchDashboardResult } from './actions/deepSearchActions';

/**
 * Imperative handle so the palette-wide keyboard navigation (RenderResults)
 * can move focus between the cards in this column.
 */
export interface DeepSearchNavHandle {
  focusIndex: (index: number) => void;
  /** Index of the card that currently holds DOM focus, -1 when none. */
  getFocusedIndex: () => number;
  getCount: () => number;
}

interface DeepSearchResultsProps {
  results: DeepSearchDashboardResult[];
  isFetching: boolean;
  /** Called when a result navigation is triggered, so the palette can close itself. */
  onNavigate: () => void;
  navRef?: React.Ref<DeepSearchNavHandle>;
}

/**
 * The semantic search column of the command palette. Shows one card per
 * dashboard with the panel snippets that matched the query.
 */
export function DeepSearchResults({ results, isFetching, onNavigate, navRef }: DeepSearchResultsProps) {
  const styles = useStyles2(getStyles);
  const itemRefs = useRef<Array<HTMLAnchorElement | null>>([]);

  useImperativeHandle(navRef, () => ({
    focusIndex: (index: number) => itemRefs.current[index]?.focus(),
    getFocusedIndex: () =>
      itemRefs.current.findIndex((element) => element !== null && element === document.activeElement),
    getCount: () => itemRefs.current.filter((element) => element !== null).length,
  }));

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        {t('command-palette.section.deep-search', 'Deep search')}
        <div className={styles.loadingBarContainer}>{isFetching && <LoadingBar width={240} delay={0} />}</div>
      </div>
      {results.length === 0 && !isFetching ? (
        <div className={styles.emptyText}>{t('command-palette.deep-search.no-matches', 'No matches')}</div>
      ) : (
        <div className={styles.list}>
          {results.map((result, index) => (
            <DeepSearchResultItem
              key={result.dashboardUid}
              ref={(element) => {
                itemRefs.current[index] = element;
              }}
              result={result}
              onNavigate={onNavigate}
            />
          ))}
        </div>
      )}
    </div>
  );
}

interface DeepSearchResultItemProps {
  result: DeepSearchDashboardResult;
  onNavigate: () => void;
}

export const DeepSearchResultItem = React.forwardRef<HTMLAnchorElement, DeepSearchResultItemProps>(
  ({ result, onNavigate }, ref) => {
    const styles = useStyles2(getStyles);

    const onClick = (ev: React.MouseEvent) => {
      // Modifier clicks open a new tab, so the palette should stay open —
      // same behavior as the keyword results in KBarResults
      if (!(ev.ctrlKey || ev.metaKey || ev.shiftKey)) {
        onNavigate();
      }
    };

    return (
      <a ref={ref} className={styles.card} href={locationUtil.assureBaseUrl(result.url)} onClick={onClick}>
        <div className={styles.titleRow}>
          <span className={styles.title}>{result.title}</span>
          <span className={styles.matchCount}>
            {t('command-palette.deep-search.match-count', '{{count}} match', {
              count: result.matchedPanelCount,
              defaultValue_one: '{{count}} match',
              defaultValue_other: '{{count}} matches',
            })}
          </span>
        </div>
        {result.folderTitle && <div className={styles.folder}>{result.folderTitle}</div>}
        {result.snippets.map((snippet, index) => (
          <div key={index} className={styles.snippet} title={snippet}>
            {snippet}
          </div>
        ))}
      </a>
    );
  }
);

DeepSearchResultItem.displayName = 'DeepSearchResultItem';

const getStyles = (theme: GrafanaTheme2) => {
  return {
    container: css({
      display: 'flex',
      flexDirection: 'column',
      flex: 1,
      minHeight: 0,
    }),
    header: css({
      padding: theme.spacing(1.5, 2, 1, 2),
      fontSize: theme.typography.bodySmall.fontSize,
      fontWeight: theme.typography.fontWeightMedium,
      color: theme.colors.text.secondary,
      position: 'relative',
    }),
    loadingBarContainer: css({
      position: 'absolute',
      left: 0,
      right: 0,
      bottom: 0,
      overflow: 'hidden',
    }),
    list: css({
      flex: 1,
      minHeight: 0,
      overflowY: 'auto',
      paddingBottom: theme.spacing(1),
    }),
    emptyText: css({
      padding: theme.spacing(1, 2),
      color: theme.colors.text.secondary,
      fontSize: theme.typography.bodySmall.fontSize,
    }),
    card: css({
      display: 'block',
      padding: theme.spacing(1, 2),
      margin: theme.spacing(0, 1),
      borderRadius: theme.shape.radius.default,
      cursor: 'pointer',
      position: 'relative',
      color: theme.colors.text.primary,
      outline: 'none',
      '&:hover': {
        background: theme.colors.emphasize(theme.colors.background.primary, 0.03),
      },
      // Keyboard navigation mode — mirror the active style of keyword results
      '&:focus': {
        color: theme.colors.text.maxContrast,
        background: theme.colors.emphasize(theme.colors.background.primary, 0.03),
        '&:before': {
          display: 'block',
          content: '" "',
          position: 'absolute',
          left: 0,
          top: 0,
          bottom: 0,
          width: theme.spacing(0.5),
          borderRadius: theme.shape.radius.default,
          backgroundImage: theme.colors.gradients.brandVertical,
        },
      },
    }),
    titleRow: css({
      display: 'flex',
      alignItems: 'baseline',
      justifyContent: 'space-between',
      gap: theme.spacing(1),
    }),
    title: css({
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      whiteSpace: 'nowrap',
    }),
    matchCount: css({
      flexShrink: 0,
      fontSize: theme.typography.bodySmall.fontSize,
      color: theme.colors.text.secondary,
    }),
    folder: css({
      fontSize: theme.typography.bodySmall.fontSize,
      color: theme.colors.text.secondary,
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      whiteSpace: 'nowrap',
    }),
    snippet: css({
      fontSize: theme.typography.bodySmall.fontSize,
      color: theme.colors.text.secondary,
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      whiteSpace: 'nowrap',
    }),
  };
};
