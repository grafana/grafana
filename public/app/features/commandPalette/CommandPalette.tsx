import { css, cx } from '@emotion/css';
import { useDialog } from '@react-aria/dialog';
import { FocusScope } from '@react-aria/focus';
import { useOverlay } from '@react-aria/overlays';
import { KBarAnimator, KBarPortal, KBarPositioner, VisualState, useKBar, ActionImpl } from 'kbar';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { OpenAssistantButton, useAssistant } from '@grafana/assistant';
import { GrafanaTheme2 } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { t } from '@grafana/i18n';
import { reportInteraction } from '@grafana/runtime';
import { EmptyState, Icon, IconButton, LoadingBar, useStyles2 } from '@grafana/ui';

import { KBarResults } from './KBarResults';
import { KBarSearch } from './KBarSearch';
import { ResultItem } from './ResultItem';
import { useSearchResults } from './actions/dashboardActions';
import { useRegisterRecentScopesActions, useRegisterScopesActions } from './actions/scopeActions';
import { useRegisterRecentDashboardsActions, useRegisterStaticActions } from './actions/useActions';
import { useDynamicExtensionResults } from './actions/useDynamicExtensionActions';
import { CommandPaletteAction } from './types';
import { useMatches } from './useMatches';

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
  const [hasDetailPanel, setHasDetailPanel] = useState(false);
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

  // Fetch dynamic results from plugins - these bypass kbar's fuzzy filtering
  // since they're already filtered by the plugin's searchProvider
  const { results: dynamicResults, isLoading: isDynamicLoading } = useDynamicExtensionResults(searchQuery);

  // This searches dashboards and folders it shows only if we are not in some specific category (and there is no
  // dashboards category right now, so if any category is selected, we don't show these).
  // Normally we register actions with kbar, and it knows not to show actions which are under a different parent than is
  // the currentRootActionId. Because these search results are manually added to the list later, they would show every
  // time.
  const { searchResults: dashboardFolderResults, isFetchingSearchResults } = useSearchResults({
    searchQuery,
    show: !currentRootActionId,
  });

  // Combine all search results (dashboard/folder results + flat dynamic plugin results).
  // When drilled into a parent action, hide flat search results -- hierarchical
  // children are handled by kbar's store via useRegisterActions.
  const searchResults = useMemo(
    () => (currentRootActionId ? [] : [...dashboardFolderResults, ...dynamicResults]),
    [dashboardFolderResults, dynamicResults, currentRootActionId]
  );

  const ref = useRef<HTMLDivElement>(null);
  const { overlayProps } = useOverlay(
    { isOpen: true, onClose: () => query.setVisualState(VisualState.animatingOut) },
    ref
  );

  const { dialogProps } = useDialog({}, ref);

  // Report interaction when opened
  useEffect(() => {
    reportInteraction('command_palette_opened');
  }, []);

  return (
    <KBarPositioner className={styles.positioner}>
      <KBarAnimator className={cx(styles.animator, hasDetailPanel && styles.animatorWide)}>
        <FocusScope contain autoFocus restoreFocus>
          <div {...overlayProps} {...dialogProps}>
            <div className={styles.searchContainer}>
              <Icon name="search" size="md" className={styles.searchIcon} />
              <AncestorBreadcrumbs />
              <KBarSearch
                defaultPlaceholder={t('command-palette.search-box.placeholder', 'Search or jump to...')}
                className={styles.search}
              />
              {searchQuery && (
                <IconButton
                  name="times"
                  size="sm"
                  variant="secondary"
                  aria-label={t('command-palette.search-box.clear', 'Clear search')}
                  className={styles.clearButton}
                  tabIndex={-1}
                  onClick={() => {
                    query.setSearch('');
                    query.getInput().focus();
                  }}
                />
              )}
              <div className={styles.loadingBarContainer}>
                {(isFetchingSearchResults || isDynamicLoading) && <LoadingBar width={500} delay={0} />}
              </div>
            </div>
            {scopesRow ? <div className={styles.searchContainer}>{scopesRow}</div> : null}
            <div className={styles.resultsContainer}>
              <RenderResults
                isFetchingSearchResults={isFetchingSearchResults || isDynamicLoading}
                searchResults={searchResults}
                searchQuery={searchQuery}
                onHasDetailPanelChange={setHasDetailPanel}
              />
            </div>
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
  const currentAction = currentRootActionId ? actions[currentRootActionId] : undefined;
  const ancestorActions = currentAction ? [...currentAction.ancestors, currentAction] : [];

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
  onHasDetailPanelChange?: (hasPanel: boolean) => void;
}

interface ActionWithDetailPanel extends ActionImpl {
  detailPanel?: React.ReactNode;
}

const RenderResults = ({
  isFetchingSearchResults,
  searchResults,
  searchQuery,
  onHasDetailPanelChange,
}: RenderResultsProps) => {
  const { results: kbarResults, rootActionId } = useMatches();
  const { query, actions, activeIndex, currentRootActionId } = useKBar((state) => ({
    actions: state.actions,
    activeIndex: state.activeIndex,
    currentRootActionId: state.currentRootActionId,
  }));
  const { isAvailable: isAssistantAvailable } = useAssistant();
  const lateralSpace = getCommandPalettePosition();
  const styles = useStyles2(getSearchStyles, lateralSpace);

  const dashboardsSectionTitle = t('command-palette.section.dashboard-search-results', 'Dashboards');
  const foldersSectionTitle = t('command-palette.section.folder-search-results', 'Folders');

  // Group search results by section (dashboard, folder, or dynamic plugin sections)
  const groupedSearchResults = useMemo(() => {
    const groups = new Map<string, ActionImpl[]>();

    searchResults.forEach((item) => {
      let section: string;
      if (item.id.startsWith('go/dashboard')) {
        section = dashboardsSectionTitle;
      } else if (item.id.startsWith('go/folder')) {
        section = foldersSectionTitle;
      } else {
        // Dynamic results have their section set
        // Section can be a string or { name: string; priority: number; }
        const itemSection = item.section;
        section =
          typeof itemSection === 'string'
            ? itemSection
            : typeof itemSection === 'object' && itemSection !== null
              ? itemSection.name
              : 'Dynamic Results';
      }

      if (!groups.has(section)) {
        groups.set(section, []);
      }
      groups.get(section)!.push(new ActionImpl(item, { store: {} }));
    });

    return groups;
  }, [searchResults, dashboardsSectionTitle, foldersSectionTitle]);

  const items = useMemo(() => {
    const results = [...kbarResults];

    // Add all grouped search results (folders, dashboards, and dynamic results)
    // Folders first, then dynamic results, then dashboards
    const folderResults = groupedSearchResults.get(foldersSectionTitle) ?? [];
    if (folderResults.length > 0) {
      results.push(foldersSectionTitle);
      results.push(...folderResults);
    }

    // Add dynamic plugin results (any section that's not dashboard/folder)
    groupedSearchResults.forEach((items, section) => {
      if (section !== dashboardsSectionTitle && section !== foldersSectionTitle && items.length > 0) {
        results.push(section);
        results.push(...items);
      }
    });

    const dashboardResults = groupedSearchResults.get(dashboardsSectionTitle) ?? [];
    if (dashboardResults.length > 0) {
      results.push(dashboardsSectionTitle);
      results.push(...dashboardResults);
    }

    return results;
  }, [kbarResults, groupedSearchResults, dashboardsSectionTitle, foldersSectionTitle]);

  // Resolve the detail panel for the currently active item.
  // When drilled into children, use the parent action's panel.
  const activeDetailPanel = useMemo(() => {
    if (currentRootActionId) {
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
      const parent = actions[currentRootActionId] as ActionWithDetailPanel | undefined;
      return parent?.detailPanel ?? null;
    }
    const activeItem = items[activeIndex];
    if (activeItem && typeof activeItem !== 'string') {
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
      return (activeItem as ActionWithDetailPanel).detailPanel ?? null;
    }
    return null;
  }, [currentRootActionId, actions, items, activeIndex]);

  useEffect(() => {
    onHasDetailPanelChange?.(activeDetailPanel != null);
  }, [activeDetailPanel, onHasDetailPanelChange]);

  const showEmptyState = !isFetchingSearchResults && items.length === 0;
  useEffect(() => {
    showEmptyState && reportInteraction('grafana_empty_state_shown', { source: 'command_palette' });
  }, [showEmptyState]);

  if (showEmptyState) {
    return (
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
    );
  }

  const resultsList = (
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

  if (!activeDetailPanel) {
    return resultsList;
  }

  return (
    <div className={styles.splitPane}>
      <div className={styles.splitPaneLeft}>{resultsList}</div>
      <div className={styles.splitPaneRight}>{activeDetailPanel}</div>
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
      paddingTop: '5vh !important',
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
      maxWidth: 640,
      background: theme.colors.background.primary,
      color: theme.colors.text.primary,
      borderRadius: theme.shape.radius.lg,
      border: `1px solid ${theme.colors.border.weak}`,
      overflow: 'hidden',
      boxShadow: theme.shadows.z3,
      [theme.transitions.handleMotion('no-preference')]: {
        transition: theme.transitions.create('max-width', { duration: theme.transitions.duration.short }),
      },
    }),
    animatorWide: css({
      maxWidth: 960,
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
    splitPane: css({
      display: 'flex',
      flexDirection: 'row',
    }),
    splitPaneLeft: css({
      flex: '1 1 55%',
      minWidth: 0,
      overflow: 'hidden',
    }),
    splitPaneRight: css({
      flex: '1 1 45%',
      minWidth: 0,
      borderLeft: `1px solid ${theme.colors.border.weak}`,
      maxHeight: 650,
      overflowY: 'auto',
      overflowX: 'hidden',
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
    clearButton: css({
      color: theme.colors.text.secondary,
      flexShrink: 0,
      '&:hover': {
        color: theme.colors.text.primary,
      },
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
