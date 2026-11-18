import { css, cx } from '@emotion/css';
import { useDialog } from '@react-aria/dialog';
import { FocusScope } from '@react-aria/focus';
import { useOverlay } from '@react-aria/overlays';
import { KBarAnimator, KBarPortal, KBarPositioner, VisualState, useKBar, ActionImpl } from 'kbar';
import React, { useCallback, useEffect, useMemo, useRef } from 'react';

import { OpenAssistantButton, useAssistant } from '@grafana/assistant';
import { type GrafanaTheme2 } from '@grafana/data';
import { t } from '@grafana/i18n';
import { reportInteraction } from '@grafana/runtime';
import { useFlagGrafanaCmdkHybridSearch } from '@grafana/runtime/internal';
import { EmptyState, Icon, LoadingBar, getPortalContainer, useStyles2 } from '@grafana/ui';

import { AskAssistantPill } from './AskAssistantPill';
import { KBarResults } from './KBarResults';
import { KBarSearch } from './KBarSearch';
import { ResultItem } from './ResultItem';
import { useSearchResults } from './actions/dashboardActions';
import {
  useRegisterExtensionActions,
  useRegisterRecentDashboardsActions,
  useRegisterStaticActions,
} from './actions/useActions';
import { bucketQueryLength } from './bucketQueryLength';
import { resetCommandPaletteInputMode, setCommandPaletteInputMode } from './inputMode';
import { useRegisterRecentScopesActions, useRegisterScopesActions } from './scopes/scopeActions';
import { type CommandPaletteAction, getActionSectionId } from './types';
import { useMatches } from './useMatches';
import { SECTION_NOTEBOOKS } from './values';

export function CommandPalette() {
  useRegisterStaticActions();

  return (
    <KBarPortal container={getPortalContainer()}>
      <CommandPaletteContents />
    </KBarPortal>
  );
}

/**
 * Actual contents of the command palette. As KBarPortal controls the mount of this component this is split so that
 * we can run code only after command palette is opened.
 * @constructor
 */
function CommandPaletteContents() {
  const styles = useStyles2(getSearchStyles);

  const { query, searchQuery, currentRootActionId } = useKBar((state) => ({
    showing: state.visualState === VisualState.showing,
    searchQuery: state.searchQuery,
    currentRootActionId: state.currentRootActionId,
  }));

  // Even though extension links are defined in plugins at load time, they can contain a configure() method that can
  // show or hide the link based on dynamic factors. Loading it here instead of next to useStaticActions will give
  // links opportunity to run the configure() method each time we show the palette.
  useRegisterExtensionActions();
  useRegisterRecentDashboardsActions();
  useRegisterRecentScopesActions();

  const queryToggle = useCallback(() => query.toggle(), [query]);
  const { scopesRow } = useRegisterScopesActions(searchQuery, queryToggle, currentRootActionId);

  // This searches dashboards and folders it shows only if we are not in some specific category (and there is no
  // dashboards category right now, so if any category is selected, we don't show these).
  // Normally we register actions with kbar, and it knows not to show actions which are under a different parent than is
  // the currentRootActionId. Because these search results are manually added to the list later, they would show every
  // time.
  const { searchResults, isFetchingSearchResults } = useSearchResults({ searchQuery, show: !currentRootActionId });

  const hybridSearchEnabled = useFlagGrafanaCmdkHybridSearch();
  const ref = useRef<HTMLDivElement>(null);
  const { overlayProps } = useOverlay(
    { isOpen: true, onClose: () => query.setVisualState(VisualState.animatingOut) },
    ref
  );

  const { dialogProps } = useDialog({ 'aria-label': t('command-palette.dialog-label', 'Command palette') }, ref);

  // Report interaction when opened/closed
  useEffect(() => {
    resetCommandPaletteInputMode();
    reportInteraction('command_palette_opened', {
      isHybridSearchEnabled: hybridSearchEnabled,
    });
    return () => {
      reportInteraction('command_palette_closed', undefined, { silent: true });
    };
    // This could inflate the opened closed numbers, but I assume nobody is going to change these through UI that much.
  }, [hybridSearchEnabled]);

  // CUJ-only signal: debounce typing into the palette so we record one event
  // per typing burst instead of one per keystroke. Skip the initial empty render.
  const hasTypedSearchRef = useRef(false);
  useEffect(() => {
    const q = searchQuery ?? '';
    if (!hasTypedSearchRef.current && q.length === 0) {
      return;
    }
    hasTypedSearchRef.current = true;
    const handle = setTimeout(() => {
      const len = q.length;
      reportInteraction(
        'command_palette_search_query',
        { hasQuery: len > 0 ? 'true' : 'false', queryLength: bucketQueryLength(len) },
        { silent: true }
      );
    }, 500);
    return () => clearTimeout(handle);
  }, [searchQuery]);

  // Track input modality so onSelectAction (which doesn't see the originating
  // event) can report whether the activation came from keyboard or mouse.
  const onPointerDownCapture = useCallback(() => setCommandPaletteInputMode('mouse'), []);
  const onKeyDownCapture = useCallback((e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Enter' || e.key === 'ArrowDown' || e.key === 'ArrowUp' || e.key === 'Tab') {
      setCommandPaletteInputMode('keyboard');
    }
  }, []);

  return (
    <KBarPositioner className={styles.positioner}>
      <KBarAnimator className={styles.animator}>
        <FocusScope contain autoFocus restoreFocus>
          <div
            {...overlayProps}
            {...dialogProps}
            onPointerDownCapture={onPointerDownCapture}
            onKeyDownCapture={onKeyDownCapture}
          >
            <div className={styles.searchContainer}>
              <Icon name="search" size="md" className={styles.searchIcon} />
              <AncestorBreadcrumbs />
              <KBarSearch
                defaultPlaceholder={t('command-palette.search-box.placeholder', 'Search or jump to...')}
                className={styles.search}
              />
              {hybridSearchEnabled && <AskAssistantPill />}
              <div className={styles.loadingBarContainer}>
                {isFetchingSearchResults && <LoadingBar width={500} delay={0} />}
              </div>
            </div>
            {scopesRow ? <div className={styles.searchContainer}>{scopesRow}</div> : null}
            <RenderResults
              isFetchingSearchResults={isFetchingSearchResults}
              searchResults={searchResults}
              searchQuery={searchQuery}
              hybridSearchEnabled={hybridSearchEnabled}
            />
          </div>
        </FocusScope>
      </KBarAnimator>
    </KBarPositioner>
  );
}

/**
 * Breadcrumbs for selected actions or categories in the command palette. This has to be a separate component
 * from the one that is registering actions because we need actions prop from kbar and doing both in the same component
 * creates rerender loop.
 * @constructor
 */
function AncestorBreadcrumbs() {
  const styles = useStyles2(getSearchStyles);

  const { actions, currentRootActionId } = useKBar((state) => ({
    actions: state.actions,
    currentRootActionId: state.currentRootActionId,
  }));

  // To show breadcrumbs of actions selected if they are nested
  const ancestorActions = currentRootActionId
    ? [...actions[currentRootActionId].ancestors, actions[currentRootActionId]]
    : [];

  return (
    ancestorActions.length > 0 && (
      <span className={styles.breadcrumbs}>
        {ancestorActions.map((action, index) => (
          <React.Fragment key={action.id || index}>{action.name}&nbsp;/&nbsp;</React.Fragment>
        ))}
      </span>
    )
  );
}

interface RenderResultsProps {
  isFetchingSearchResults: boolean;
  searchResults: CommandPaletteAction[];
  searchQuery: string;
  // For event reporting
  hybridSearchEnabled: boolean;
}

const RenderResults = ({
  isFetchingSearchResults,
  searchResults,
  searchQuery,
  hybridSearchEnabled,
}: RenderResultsProps) => {
  const { results: kbarResults, rootActionId } = useMatches();
  const { query } = useKBar();
  const { isAvailable: isAssistantAvailable } = useAssistant();
  const styles = useStyles2(getSearchStyles);

  const dashboardsSectionTitle = t('command-palette.section.dashboard-search-results', 'Dashboards');
  const foldersSectionTitle = t('command-palette.section.folder-search-results', 'Folders');
  const notebooksSectionTitle = t('command-palette.section.notebook-search-results', 'Notebooks');
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
  const notebookResultItems = useMemo(
    () =>
      searchResults
        .filter((item) => item.sectionId === SECTION_NOTEBOOKS)
        .map((notebook) => new ActionImpl(notebook, { store: {} })),
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
    if (notebookResultItems.length > 0) {
      results.push(notebooksSectionTitle);
      results.push(...notebookResultItems);
    }
    return results;
  }, [
    kbarResults,
    dashboardsSectionTitle,
    dashboardResultItems,
    foldersSectionTitle,
    folderResultItems,
    notebooksSectionTitle,
    notebookResultItems,
  ]);

  const reportActionSelected = useCallback(
    (params: { actionId?: string; actionName?: string; index: number; section?: string; url?: string }) => {
      reportInteraction('command_palette_action_selected', {
        actionId: params.actionId,
        actionName: params.actionName,
        // Position of the selected item from the top of the list (excludes section headers)
        index: params.index,
        // Stable, language-agnostic section slug from the action's sectionId, e.g.
        // "recent-dashboards" / "pages"
        section: params.section,
        // Destination URL of the dashboard/page, unset for actions that don't navigate
        target: params.url,
        isHybridSearchEnabled: hybridSearchEnabled,
        // Number of selectable items in the search results
        itemsCount: items.filter((item) => typeof item !== 'string').length,
      });
    },
    [items, hybridSearchEnabled]
  );

  const hasKeywordResults = items.length > 0;
  const showEmptyState = !isFetchingSearchResults && !hasKeywordResults;
  useEffect(() => {
    showEmptyState && reportInteraction('grafana_empty_state_shown', { source: 'command_palette' });
  }, [showEmptyState]);

  if (showEmptyState) {
    return (
      <div className={styles.resultsContainer}>
        <EmptyState
          variant="not-found"
          role="alert"
          message={t('command-palette.empty-state.message', 'No results found')}
        >
          {isAssistantAvailable && (
            <OpenAssistantButton
              origin="grafana/command-palette-empty-state"
              prompt={`Search for ${searchQuery}`}
              title={t('command-palette.empty-state.button-title', 'Search with Grafana Assistant')}
              onClick={query.toggle}
            />
          )}
        </EmptyState>
      </div>
    );
  }

  return (
    <div className={styles.resultsContainer}>
      {hasKeywordResults && (
        <KBarResults
          items={items}
          maxHeight={650}
          onItemSelected={(item, rawIndex, url) =>
            reportActionSelected({
              actionId: item.id,
              actionName: item.name,
              index: items.slice(0, rawIndex).filter((entry) => typeof entry !== 'string').length,
              section: getActionSectionId(item),
              url,
            })
          }
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
      )}
    </div>
  );
};

const getSearchStyles = (theme: GrafanaTheme2) => {
  const visualRefreshEnabled = theme.flags.visualDesignRefresh;
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
      maxWidth: theme.breakpoints.values.lg,
      background: theme.colors.background[visualRefreshEnabled ? 'page' : 'primary'],
      color: theme.colors.text.primary,
      borderRadius: theme.shape.radius.lg,
      border: `1px solid ${theme.colors.border.weak}`,
      overflow: 'hidden',
      boxShadow: theme.shadows.z3,
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
      padding: theme.spacing(1, 2),
      position: 'relative',
      justifyContent: 'space-between',
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
    breadcrumbs: css({
      label: 'breadcrumbs',
      fontSize: theme.typography.body.fontSize,
      fontWeight: theme.typography.fontWeightMedium,
      lineHeight: theme.typography.body.lineHeight,
      color: theme.colors.text.primary,
      display: 'flex',
      alignItems: 'center',
      whiteSpace: 'nowrap',
    }),
    scopesText: css({
      label: 'scopesText',
      fontSize: theme.typography.bodySmall.fontSize,
      fontWeight: theme.typography.fontWeightMedium,
      lineHeight: theme.typography.bodySmall.lineHeight,
      color: theme.colors.text.secondary,
    }),
    searchIcon: css({
      marginRight: theme.spacing(1),
    }),
    selectedScope: css({
      background: theme.colors.background.secondary,
      borderRadius: theme.shape.radius.default,
      padding: theme.spacing(0, 0.5),
      fontSize: theme.typography.bodySmall.fontSize,
      fontWeight: theme.typography.fontWeightMedium,
      lineHeight: theme.typography.bodySmall.lineHeight,
      color: theme.colors.text.secondary,
      display: 'inline-flex',
      alignItems: 'center',
      position: 'relative',
      border: `1px solid ${theme.colors.background.secondary}`,
      whiteSpace: 'nowrap',
      marginRight: theme.spacing(0.5),
    }),
  };
};
