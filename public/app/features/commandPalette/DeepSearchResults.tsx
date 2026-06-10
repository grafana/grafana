import { css } from '@emotion/css';
import * as React from 'react';
import { useEffect, useImperativeHandle, useRef } from 'react';

import { type GrafanaTheme2, locationUtil } from '@grafana/data';
import { t } from '@grafana/i18n';
import { LoadingBar, useStyles2 } from '@grafana/ui';

import { type DeepSearchDashboardResult } from './actions/deepSearchActions';

/** Imperative handle so the palette can move keyboard focus into the column. */
export interface DeepSearchNavHandle {
  focusFirst: () => void;
}

interface DeepSearchResultsProps {
  results: DeepSearchDashboardResult[];
  isFetching: boolean;
  /** Called when a result navigation is triggered, so the palette can close itself. */
  onNavigate: () => void;
  /**
   * Called to leave keyboard navigation mode — Up on the first item (resetSelection
   * false) or Escape (resetSelection true, highlight returns to the first item).
   */
  onReturnToInput: (resetSelection: boolean) => void;
  navRef?: React.Ref<DeepSearchNavHandle>;
}

/**
 * The semantic search column of the command palette. Shows one card per
 * dashboard with the panel snippets that matched the query.
 */
export function DeepSearchResults({ results, isFetching, onNavigate, onReturnToInput, navRef }: DeepSearchResultsProps) {
  const styles = useStyles2(getStyles);
  const itemRefs = useRef<Array<HTMLAnchorElement | null>>([]);

  useImperativeHandle(navRef, () => ({
    focusFirst: () => itemRefs.current[0]?.focus(),
  }));

  // Navigation-mode keys are handled with a window capture listener because
  // several global handlers would otherwise act on them first: kbar refocuses
  // its input on any keystroke outside it, Grafana's keybindingSrv binds a
  // global Escape (mousetrap), and the overlay closes on Escape. Capture at
  // the window runs before all of them; stopImmediatePropagation keeps the
  // event to ourselves. Only active while focus is on one of the cards.
  const onReturnToInputRef = useRef(onReturnToInput);
  onReturnToInputRef.current = onReturnToInput;
  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      const index = itemRefs.current.findIndex((element) => element !== null && element === document.activeElement);
      if (index === -1) {
        return;
      }

      if (event.key === 'ArrowDown') {
        itemRefs.current[index + 1]?.focus();
      } else if (event.key === 'ArrowUp') {
        if (index === 0) {
          onReturnToInputRef.current(false);
        } else {
          itemRefs.current[index - 1]?.focus();
        }
      } else if (event.key === 'Escape') {
        onReturnToInputRef.current(true);
      } else if (event.key === 'Enter') {
        // Keep global handlers away but let the anchor's native activation run
        event.stopImmediatePropagation();
        return;
      } else {
        return;
      }

      event.preventDefault();
      event.stopImmediatePropagation();
    };

    window.addEventListener('keydown', handler, { capture: true });
    return () => window.removeEventListener('keydown', handler, { capture: true });
  }, []);

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
