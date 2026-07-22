import { css, cx } from '@emotion/css';
import { useDialog } from '@react-aria/dialog';
import { FocusScope } from '@react-aria/focus';
import { useOverlay } from '@react-aria/overlays';
import { KBarAnimator, KBarPortal, KBarPositioner, VisualState, useKBar, ActionImpl, getListboxItemId } from 'kbar';
import React, { useCallback, useEffect, useMemo, useRef } from 'react';

import { OpenAssistantButton, useAssistant } from '@grafana/assistant';
import { type GrafanaTheme2 } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { t } from '@grafana/i18n';
import { reportInteraction } from '@grafana/runtime';
import { useFlagDashboardVectorSearch, useFlagGrafanaVectorSearchCmdk } from '@grafana/runtime/internal';
import { EmptyState, Icon, LoadingBar, useStyles2 } from '@grafana/ui';

import { AskAssistantPill } from './AskAssistantPill';
import { type DeepSearchNavHandle, DeepSearchResults } from './DeepSearchResults';
import { KBarResults } from './KBarResults';
import { KBarSearch } from './KBarSearch';
import { ResultItem } from './ResultItem';
import { useSearchResults } from './actions/dashboardActions';
import { type DeepSearchDashboardResult, useDeepSearchResults } from './actions/deepSearchActions';
import { useRegisterRecentDashboardsActions, useRegisterStaticActions } from './actions/useActions';
import { bucketQueryLength } from './bucketQueryLength';
import { resetCommandPaletteInputMode, setCommandPaletteInputMode } from './inputMode';
import { useRegisterRecentScopesActions, useRegisterScopesActions } from './scopes/scopeActions';
import { type CommandPaletteAction, getActionSectionId } from './types';
import { useMatches } from './useMatches';
import { SECTION_DEEP_SEARCH } from './values';

export function CommandPalette() {
  useRegisterStaticActions();
  return (
    <KBarPortal>
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
  const lateralSpace = getCommandPalettePosition();
  const styles = useStyles2(getSearchStyles, lateralSpace);

  const { query, searchQuery, currentRootActionId } = useKBar((state) => ({
    showing: state.visualState === VisualState.showing,
    searchQuery: state.searchQuery,
    currentRootActionId: state.currentRootActionId,
  }));

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

  // Call both hooks unconditionally (rules-of-hooks), then require both: the backend
  // vector-search endpoint flag and the command-palette flag
  const dashboardVectorSearchEnabled = useFlagDashboardVectorSearch();
  const vectorSearchCmdkEnabled = useFlagGrafanaVectorSearchCmdk();
  const deepSearchEnabled = dashboardVectorSearchEnabled && vectorSearchCmdkEnabled;
  const { deepSearchResults, isFetchingDeepSearchResults } = useDeepSearchResults({
    searchQuery,
    show: !currentRootActionId,
    enabled: deepSearchEnabled,
  });
  const showDeepSearch = deepSearchEnabled && !currentRootActionId && searchQuery.length > 0;

  const ref = useRef<HTMLDivElement>(null);
  const { overlayProps } = useOverlay(
    { isOpen: true, onClose: () => query.setVisualState(VisualState.animatingOut) },
    ref
  );

  const { dialogProps } = useDialog({}, ref);

  // Report interaction when opened/closed
  useEffect(() => {
    resetCommandPaletteInputMode();
    reportInteraction('command_palette_opened');
    return () => {
      reportInteraction('command_palette_closed', undefined, { silent: true });
    };
  }, []);

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
              {deepSearchEnabled && <AskAssistantPill />}
              <div className={styles.loadingBarContainer}>
                {isFetchingSearchResults && <LoadingBar width={500} delay={0} />}
              </div>
            </div>
            {scopesRow ? <div className={styles.searchContainer}>{scopesRow}</div> : null}
            <RenderResults
              isFetchingSearchResults={isFetchingSearchResults}
              searchResults={searchResults}
              searchQuery={searchQuery}
              deepSearchResults={deepSearchResults}
              isFetchingDeepSearchResults={isFetchingDeepSearchResults}
              showDeepSearch={showDeepSearch}
              onNavigate={queryToggle}
              deepSearchEnabled={deepSearchEnabled}
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
  const lateralSpace = getCommandPalettePosition();
  const styles = useStyles2(getSearchStyles, lateralSpace);

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
  deepSearchResults: DeepSearchDashboardResult[];
  isFetchingDeepSearchResults: boolean;
  showDeepSearch: boolean;
  onNavigate: () => void;
  // For event reporting
  deepSearchEnabled: boolean;
}

const RenderResults = ({
  isFetchingSearchResults,
  searchResults,
  searchQuery,
  deepSearchResults,
  isFetchingDeepSearchResults,
  showDeepSearch,
  onNavigate,
  deepSearchEnabled,
}: RenderResultsProps) => {
  const { results: kbarResults, rootActionId } = useMatches();
  const { query, activeIndex } = useKBar((state) => ({ activeIndex: state.activeIndex }));
  const { isAvailable: isAssistantAvailable } = useAssistant();
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

  // Analytics: single place to assemble the command_palette_action_selected payload,
  // shared by the keyword list and the deep search column.
  const reportActionSelected = useCallback(
    (params: {
      actionId?: string;
      actionName?: string;
      index: number;
      section?: string;
      deepSearch: boolean;
      url?: string;
    }) => {
      reportInteraction('command_palette_action_selected', {
        actionId: params.actionId,
        actionName: params.actionName,
        // Position of the selected item from the top of its column (excludes section headers)
        index: params.index,
        // Stable, language-agnostic section slug from the action's sectionId, e.g.
        // "recent-dashboards" / "pages" / "deep-search"
        section: params.section,
        // Destination URL of the dashboard/page, unset for actions that don't navigate
        target: params.url,
        isDeepSearchEnabled: deepSearchEnabled,
        isDeepSearchAction: params.deepSearch,
        // Whether the deep search column had finished loading at selection time
        isDeepSearchLoaded: showDeepSearch && !isFetchingDeepSearchResults,
        deepSearchItemsCount: deepSearchResults.length,
        // Number of selectable items in the old search column
        itemsCount: items.filter((item) => typeof item !== 'string').length,
      });
    },
    [showDeepSearch, isFetchingDeepSearchResults, deepSearchResults.length, items, deepSearchEnabled]
  );

  const keywordListRef = useRef<HTMLDivElement | null>(null);
  const deepSearchNavRef = useRef<DeepSearchNavHandle>(null);
  // The handler reads items and the kbar highlight through refs so it can stay
  // registered once instead of rebinding on every keystroke
  const itemsRef = useRef(items);
  itemsRef.current = items;
  const activeIndexRef = useRef(activeIndex);
  activeIndexRef.current = activeIndex;

  // Palette-wide keyboard navigation. Focus is the source of truth and moves
  // between three zones: the search input, the keyword list (focus sits on the
  // list container, kbar's activeIndex is the highlight) and the deep search
  // cards (each card holds real DOM focus).
  //
  // Implemented as a window capture listener because several global handlers
  // would otherwise act first: kbar refocuses its input on any keystroke
  // outside it, Grafana's keybindingSrv binds a global Escape (mousetrap), and
  // the react-aria overlay closes on Escape. Capture at the window beats all
  // of them; stopImmediatePropagation keeps handled keys to ourselves.
  useEffect(() => {
    // Deep search off → the legacy keyboard model (owned by KBarResults) is used instead
    if (!deepSearchEnabled) {
      return;
    }
    const handler = (event: KeyboardEvent) => {
      const input = query.getInput();
      const keywordList = keywordListRef.current;
      const deepNav = deepSearchNavRef.current;
      const currentItems = itemsRef.current;
      const deepCount = deepNav?.getCount() ?? 0;
      const deepFocusedIndex = deepNav?.getFocusedIndex() ?? -1;

      // Ctrl+N / Ctrl+P mirror ArrowDown / ArrowUp (legacy kbar shortcuts)
      const isDown = event.key === 'ArrowDown' || (event.ctrlKey && event.key === 'n');
      const isUp = event.key === 'ArrowUp' || (event.ctrlKey && event.key === 'p');

      const focusInput = () => {
        query.setActiveIndex(-1);
        input.focus();
      };
      const focusKeywordList = () => {
        const first = currentItems.findIndex((item) => typeof item !== 'string');
        if (first === -1 || !keywordList) {
          return false;
        }
        query.setActiveIndex(first);
        keywordList.focus();
        return true;
      };
      const focusDeepSearch = () => {
        if (deepCount === 0) {
          return false;
        }
        query.setActiveIndex(-1);
        deepNav?.focusIndex(0);
        return true;
      };

      let zone: 'input' | 'keyword' | 'deep';
      if (document.activeElement === input) {
        zone = 'input';
      } else if (keywordList !== null && document.activeElement === keywordList) {
        zone = 'keyword';
      } else if (deepFocusedIndex !== -1) {
        zone = 'deep';
      } else {
        return;
      }

      // A lone modifier keydown (Ctrl/Shift/Alt/Meta) while focus is in a results
      // zone must not reach kbar's focus guard, which refocuses the input. Otherwise
      // a chord like Ctrl+N breaks: the Control keydown bounces focus to the input,
      // then the following N is read in the input zone and re-enters the list at the
      // top instead of moving down. Swallow it; the chord's letter is handled next.
      if (
        zone !== 'input' &&
        (event.key === 'Control' || event.key === 'Shift' || event.key === 'Alt' || event.key === 'Meta')
      ) {
        event.stopImmediatePropagation();
        return;
      }

      let handled = false;
      if (zone === 'input') {
        if (isDown) {
          handled = focusKeywordList() || focusDeepSearch();
        }
      } else if (zone === 'keyword') {
        const current = activeIndexRef.current;
        if (isDown) {
          let next = current + 1;
          while (next < currentItems.length && typeof currentItems[next] === 'string') {
            next++;
          }
          if (next < currentItems.length) {
            query.setActiveIndex(next);
          }
          handled = true;
        } else if (isUp) {
          let previous = current - 1;
          while (previous >= 0 && typeof currentItems[previous] === 'string') {
            previous--;
          }
          if (previous >= 0) {
            query.setActiveIndex(previous);
          } else {
            focusInput();
          }
          handled = true;
        } else if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') {
          // Swallow horizontal arrows even when there is nowhere to go —
          // letting them through would hit kbar's focus guard, which yanks
          // focus back to the input while the list highlight remains
          if (event.key === 'ArrowRight') {
            focusDeepSearch();
          }
          handled = true;
        } else if (event.key === 'Enter' && !event.shiftKey) {
          // Shift+Enter is the ask-assistant shortcut owned by CommandPaletteContents
          // The active row is always scrolled into view, so its element exists
          document.getElementById(getListboxItemId(current))?.click();
          handled = true;
        } else if (event.key === 'Escape') {
          focusInput();
          handled = true;
        }
      } else {
        if (isDown) {
          if (deepFocusedIndex < deepCount - 1) {
            deepNav?.focusIndex(deepFocusedIndex + 1);
          }
          handled = true;
        } else if (isUp) {
          if (deepFocusedIndex === 0) {
            focusInput();
          } else {
            deepNav?.focusIndex(deepFocusedIndex - 1);
          }
          handled = true;
        } else if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
          // Swallow horizontal arrows even when there is nowhere to go (see
          // the keyword-zone comment)
          if (event.key === 'ArrowLeft') {
            focusKeywordList();
          }
          handled = true;
        } else if (event.key === 'Enter' && !event.shiftKey) {
          // Keep global handlers away but let the anchor's native activation run.
          // Shift+Enter falls through to the ask-assistant shortcut instead.
          event.stopImmediatePropagation();
          return;
        } else if (event.key === 'Escape') {
          focusInput();
          handled = true;
        }
      }

      if (handled) {
        event.preventDefault();
        event.stopImmediatePropagation();
      }
    };

    window.addEventListener('keydown', handler, { capture: true });
    return () => window.removeEventListener('keydown', handler, { capture: true });
  }, [query, deepSearchEnabled]);

  const hasKeywordResults = items.length > 0;
  const hasDeepSearchResults = deepSearchResults.length > 0;
  // The empty state shows only when neither the keyword list nor the deep
  // search column has (or is still fetching) anything to show
  const showEmptyState =
    !isFetchingSearchResults && !isFetchingDeepSearchResults && !hasKeywordResults && !hasDeepSearchResults;
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
    <div className={styles.columnsContainer}>
      {hasKeywordResults && (
        <div className={styles.resultsContainer}>
          <KBarResults
            items={items}
            maxHeight={650}
            scrollRef={keywordListRef}
            legacyKeyboard={!deepSearchEnabled}
            onItemSelected={(item, rawIndex, url) =>
              reportActionSelected({
                actionId: item.id,
                actionName: item.name,
                index: items.slice(0, rawIndex).filter((entry) => typeof entry !== 'string').length,
                section: getActionSectionId(item),
                deepSearch: false,
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
        </div>
      )}
      {showDeepSearch && (
        <div className={cx(styles.deepSearchColumn, !hasKeywordResults && styles.deepSearchColumnFull)}>
          <DeepSearchResults
            results={deepSearchResults}
            isFetching={isFetchingDeepSearchResults}
            onNavigate={onNavigate}
            onResultSelected={(index) =>
              reportActionSelected({
                actionId: deepSearchResults[index]?.dashboardUid,
                actionName: deepSearchResults[index]?.title,
                index,
                section: SECTION_DEEP_SEARCH,
                deepSearch: true,
                url: deepSearchResults[index]?.url,
              })
            }
            navRef={deepSearchNavRef}
          />
        </div>
      )}
    </div>
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
      borderRadius: theme.shape.radius.lg,
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
    columnsContainer: css({
      display: 'flex',
      alignItems: 'stretch',
    }),
    resultsContainer: css({
      paddingBottom: theme.spacing(1),
      flexGrow: 1,
      minWidth: 0,
    }),
    deepSearchColumn: css({
      flex: '0 0 50%',
      minWidth: 0,
      display: 'flex',
      flexDirection: 'column',
      // Match the maxHeight of the keyword results list (KBarResults)
      maxHeight: 650,
      borderLeft: `1px solid ${theme.colors.border.weak}`,
      // The palette is capped at the md breakpoint width below lg — too narrow
      // for a second column
      [theme.breakpoints.down('lg')]: {
        display: 'none',
      },
    }),
    // When there are no keyword results the deep column is the only content,
    // so it takes the full width and fits on narrow screens again
    deepSearchColumnFull: css({
      flex: '1 1 auto',
      borderLeft: 'none',
      [theme.breakpoints.down('lg')]: {
        display: 'flex',
      },
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
