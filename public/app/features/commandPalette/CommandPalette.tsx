import { css, cx } from '@emotion/css';
import { useDialog } from '@react-aria/dialog';
import { FocusScope } from '@react-aria/focus';
import { useOverlay } from '@react-aria/overlays';
import {
  KBarAnimator,
  KBarPortal,
  KBarPositioner,
  KBarSearch,
  VisualState,
  useRegisterActions,
  useKBar,
  ActionImpl,
} from 'kbar';
import { useEffect, useMemo, useRef } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { reportInteraction } from '@grafana/runtime';
import { EmptyState, Icon, LoadingBar, useStyles2 } from '@grafana/ui';
import { t } from 'app/core/internationalization';

import { KBarResults } from './KBarResults';
import { ResultItem } from './ResultItem';
import { useSearchResults } from './actions/dashboardActions';
import useActions from './actions/useActions';
import { CommandPaletteAction } from './types';
import { useMatches } from './useMatches';

export function CommandPalette() {
  const lateralSpace = getCommandPalettePosition();
  const styles = useStyles2(getSearchStyles, lateralSpace);

  const { query, showing, searchQuery } = useKBar((state) => ({
    showing: state.visualState === VisualState.showing,
    searchQuery: state.searchQuery,
  }));

  const actions = useActions(searchQuery);
  useRegisterActions(actions, [actions]);
  const { searchResults, isFetchingSearchResults } = useSearchResults(searchQuery, showing);

  const ref = useRef<HTMLDivElement>(null);
  const { overlayProps } = useOverlay(
    { isOpen: showing, onClose: () => query.setVisualState(VisualState.animatingOut) },
    ref
  );

  const { dialogProps } = useDialog({}, ref);

  // Report interaction when opened
  useEffect(() => {
    showing && reportInteraction('command_palette_opened');
  }, [showing]);

  return actions.length > 0 ? (
    <KBarPortal>
      <KBarPositioner className={styles.positioner}>
        <KBarAnimator className={styles.animator}>
          <FocusScope contain autoFocus restoreFocus>
            <div {...overlayProps} {...dialogProps}>
              <div className={styles.searchContainer}>
                <Icon name="search" size="md" />
                <KBarSearch
                  defaultPlaceholder={t('command-palette.search-box.placeholder', 'Search or jump to...')}
                  className={styles.search}
                />
                <div className={styles.loadingBarContainer}>
                  {isFetchingSearchResults && <LoadingBar width={500} delay={0} />}
                </div>
              </div>
              <div className={styles.resultsContainer}>
                <RenderResults isFetchingSearchResults={isFetchingSearchResults} searchResults={searchResults} />
              </div>
            </div>
          </FocusScope>
        </KBarAnimator>
      </KBarPositioner>
    </KBarPortal>
  ) : null;
}

interface RenderResultsProps {
  isFetchingSearchResults: boolean;
  searchResults: CommandPaletteAction[];
}

const RenderResults = ({ isFetchingSearchResults, searchResults }: RenderResultsProps) => {
  const { results: kbarResults, rootActionId } = useMatches();
  const lateralSpace = getCommandPalettePosition();
  const styles = useStyles2(getSearchStyles, lateralSpace);
  const dashboardsSectionTitle = t('command-palette.section.dashboard-search-results', 'Dashboards');
  const foldersSectionTitle = t('command-palette.section.folder-search-results', 'Folders');
  // because dashboard search results aren't registered as actions, we need to manually
  // convert them to ActionImpls before passing them as items to KBarResults
  const dashboardResultItems = useMemo(
    () =>
      searchResults
        .filter((item) => item.id.startsWith('go/dashboard'))
        .map((dashboard) => new ActionImpl(dashboard, { store: {} })),
    [searchResults]
  );
  const folderResultItems = useMemo(
    () =>
      searchResults
        .filter((item) => item.id.startsWith('go/folder'))
        .map((folder) => new ActionImpl(folder, { store: {} })),
    [searchResults]
  );

  const items = useMemo(() => {
    const results = [...kbarResults];
    if (folderResultItems.length > 0) {
      results.push(foldersSectionTitle);
      results.push(...folderResultItems);
    }
    if (dashboardResultItems.length > 0) {
      results.push(dashboardsSectionTitle);
      results.push(...dashboardResultItems);
    }
    return results;
  }, [kbarResults, dashboardsSectionTitle, dashboardResultItems, foldersSectionTitle, folderResultItems]);

  const showEmptyState = !isFetchingSearchResults && items.length === 0;
  useEffect(() => {
    showEmptyState && reportInteraction('grafana_empty_state_shown', { source: 'command_palette' });
  }, [showEmptyState]);

  return showEmptyState ? (
    <EmptyState
      variant="not-found"
      role="alert"
      message={t('command-palette.empty-state.message', 'No results found')}
    />
  ) : (
    <KBarResults
      items={items}
      maxHeight={650}
      onRender={({ item, active }) => {
        const isFirst = items[0] === item;

        const renderedItem =
          typeof item === 'string' ? (
            <div className={cx(styles.sectionHeader, isFirst && styles.sectionHeaderFirst)}>{item}</div>
          ) : (
            <ResultItem action={item} active={active} currentRootActionId={rootActionId!} />
          );

        return renderedItem;
      }}
    />
  );
};

const getCommandPalettePosition = () => {
  const input = document.querySelector(`[data-testid="${selectors.components.NavToolbar.commandPaletteTrigger}"]`);
  const inputRightPosition = input?.getBoundingClientRect().right ?? 0;
  const screenWidth = document.body.clientWidth;
  const lateralSpace = screenWidth - inputRightPosition;
  return lateralSpace;
};

const getSearchStyles = (theme: GrafanaTheme2, lateralSpace: number) => {
  return {
    positioner: css({
      zIndex: theme.zIndex.portal,
      marginTop: '0px',
      paddingTop: '4px !important',
      '&::before': {
        content: '""',
        position: 'fixed',
        top: 0,
        right: 0,
        bottom: 0,
        left: 0,
        background: theme.components.overlay.background,
      },
    }),
    animator: css({
      width: '100%',
      maxWidth: theme.breakpoints.values.md,
      background: theme.colors.background.primary,
      color: theme.colors.text.primary,
      borderRadius: theme.shape.radius.default,
      border: `1px solid ${theme.colors.border.weak}`,
      overflow: 'hidden',
      boxShadow: theme.shadows.z3,
      [theme.breakpoints.up('lg')]: {
        position: 'fixed',
        right: lateralSpace,
        left: lateralSpace,
        maxWidth: 'unset',
        width: 'unset',
      },
    }),
    loadingBarContainer: css({
      position: 'absolute',
      left: 0,
      right: 0,
      bottom: 0,
    }),
    searchContainer: css({
      alignItems: 'center',
      background: theme.components.input.background,
      borderBottom: `1px solid ${theme.colors.border.weak}`,
      display: 'flex',
      gap: theme.spacing(1),
      padding: theme.spacing(1, 2),
      position: 'relative',
    }),
    search: css({
      fontSize: theme.typography.fontSize,
      width: '100%',
      boxSizing: 'border-box',
      outline: 'none',
      border: 'none',
      color: theme.components.input.text,
    }),
    spinner: css({
      height: '22px',
    }),
    resultsContainer: css({
      paddingBottom: theme.spacing(1),
    }),
    sectionHeader: css({
      padding: theme.spacing(1.5, 2, 2, 2),
      fontSize: theme.typography.bodySmall.fontSize,
      fontWeight: theme.typography.fontWeightMedium,
      color: theme.colors.text.secondary,
      borderTop: `1px solid ${theme.colors.border.weak}`,
      marginTop: theme.spacing(1),
    }),
    sectionHeaderFirst: css({
      paddingBottom: theme.spacing(1),
      borderTop: 'none',
      marginTop: 0,
    }),
  };
};
