import { css, cx } from '@emotion/css';
import { useDialog } from '@react-aria/dialog';
import { FocusScope } from '@react-aria/focus';
import { useOverlay } from '@react-aria/overlays';
import { KBarAnimator, KBarPortal, KBarPositioner, VisualState, useKBar, useRegisterActions, ActionImpl } from 'kbar';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { OpenAssistantButton, useAssistant } from '@grafana/assistant';
import { GrafanaTheme2 } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { t } from '@grafana/i18n';
import { reportInteraction } from '@grafana/runtime';
import { EmptyState, IconButton, IconName, LoadingBar, useStyles2 } from '@grafana/ui';

import { CategoryPillBar } from './CategoryPillBar';
import { ContextActionStepList, ContextActionStepState } from './ContextActionStepList';
import { FacetBreadcrumbs } from './FacetBreadcrumbs';
import { FacetPillBar } from './FacetPillBar';
import { FacetValueList } from './FacetValueList';
import { KBarResults } from './KBarResults';
import { KBarSearch } from './KBarSearch';
import { KeyboardHints } from './KeyboardHints';
import { ResultItem } from './ResultItem';
import { useSearchResults } from './actions/dashboardActions';
import { useRegisterRecentScopesActions, useRegisterScopesActions } from './actions/scopeActions';
import { useRegisterRecentDashboardsActions, useRegisterStaticActions } from './actions/useActions';
import { ContextActionEntry, useContextActions } from './actions/useContextActions';
import { useDynamicExtensionResults } from './actions/useDynamicExtensionActions';
import { CommandPaletteAction } from './types';
import { useFacetState } from './useFacetState';
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
 * Actual contents of the command palette. KBarPortal controls the mount of this component,
 * so this is split to run code only after command palette is opened.
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

  // Context-aware actions (time range, filters, etc.)
  const contextActionEntries = useContextActions();
  const [contextStepState, setContextStepState] = useState<ContextActionStepState | null>(null);
  const isInContextActionMode = contextStepState !== null;

  const enterContextStepMode = useCallback(
    (entry: ContextActionEntry) => {
      if (!entry.config.steps) {
        return;
      }
      setContextStepState({
        currentStep: entry.config.steps,
        breadcrumbs: [],
        selectedOptions: [],
      });
    },
    []
  );

  const exitContextStepMode = useCallback(() => {
    setContextStepState(null);
  }, []);

  // Build kbar actions for context entries, wiring step-based ones to enterContextStepMode
  const contextActions = useMemo(
    () =>
      contextActionEntries.map((entry) => {
        if (entry.hasSteps) {
          return {
            ...entry.action,
            perform: () => enterContextStepMode(entry),
          };
        }
        return entry.action;
      }),
    [contextActionEntries, enterContextStepMode]
  );
  useRegisterActions(contextActions, [contextActions]);

  // Category selection: scopes command palette to a specific provider category
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  // Active facets state lives here to break the dependency cycle between
  // useFacetState (needs facet definitions) and useDynamicExtensionResults (needs activeFacets).
  const [activeFacetsState, setActiveFacetsState] = useState<Record<string, string>>({});

  // Fetch dynamic results from plugins with facet + category support
  const {
    results: dynamicResults,
    isLoading: isDynamicLoading,
    availableFacets,
    availableCategories,
    resultCount: dynamicResultCount,
  } = useDynamicExtensionResults(searchQuery, activeFacetsState, selectedCategory);

  // Facet state management (uses availableFacets from registry)
  const facetState = useFacetState(availableFacets, searchQuery);
  const {
    activeFacets,
    activeFacetLabels,
    selectingFacetId,
    filteredFacetValues,
    isLoadingFacetValues,
    facetSearchQuery,
    activateFacet,
    selectFacetValue,
    removeFacet,
    cancelFacetSelection,
    resetFacets,
    setFacetSearchQuery,
  } = facetState;

  // Sync facetState.activeFacets → activeFacetsState for the search provider
  useEffect(() => {
    setActiveFacetsState(activeFacets);
  }, [activeFacets]);

  const hasCategories = availableCategories.length > 0;
  const selectedCategoryIcon = useMemo(() => {
    if (!selectedCategory) {
      return undefined;
    }
    const cat = availableCategories.find((c) => c.label === selectedCategory);
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    return cat?.icon as IconName | undefined;
  }, [selectedCategory, availableCategories]);
  const hasFacets = availableFacets.length > 0;
  const isInFacetMode = selectingFacetId !== null;
  const hasActiveFacets = Object.keys(activeFacets).length > 0;
  const selectingFacet = selectingFacetId ? availableFacets.find((f) => f.id === selectingFacetId) : null;

  const handleSelectCategory = useCallback(
    (label: string) => {
      if (selectedCategory === label) {
        return;
      }
      resetFacets();
      setActiveFacetsState({});
      setSelectedCategory(label);
    },
    [selectedCategory, resetFacets]
  );

  const handleDeselectCategory = useCallback(() => {
    setSelectedCategory(null);
    resetFacets();
    setActiveFacetsState({});
  }, [resetFacets]);

  // Compute the shortcut range string for keyboard hints
  const shortcutRange = useMemo(() => {
    if (selectedCategory && hasFacets) {
      const keys = availableFacets.map((f) => f.shortcutKey).filter((k): k is string => k != null);
      if (keys.length === 0) {
        return undefined;
      }
      return keys.length === 1 ? keys[0] : `${keys[0]}-${keys[keys.length - 1]}`;
    }
    if (!selectedCategory && hasCategories) {
      const count = availableCategories.length;
      return count === 1 ? '1' : `1-${count}`;
    }
    return undefined;
  }, [selectedCategory, hasFacets, availableFacets, hasCategories, availableCategories]);

  // Unified Cmd+N keyboard shortcuts: categories (no category selected) or facets (category selected)
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (!e.metaKey && !e.ctrlKey) {
        return;
      }

      if (selectedCategory && hasFacets) {
        const facet = availableFacets.find((f) => f.shortcutKey === e.key);
        if (facet) {
          e.preventDefault();
          e.stopPropagation();
          activateFacet(facet.id);
        }
      } else if (!selectedCategory && hasCategories) {
        const index = parseInt(e.key, 10) - 1;
        if (index >= 0 && index < availableCategories.length) {
          e.preventDefault();
          e.stopPropagation();
          handleSelectCategory(availableCategories[index].label);
        }
      }
    };
    document.addEventListener('keydown', handler, true);
    return () => document.removeEventListener('keydown', handler, true);
  }, [selectedCategory, hasFacets, availableFacets, activateFacet, hasCategories, availableCategories, handleSelectCategory]);

  // Escape handler: step back through the hierarchy before closing palette.
  // Priority order: context action mode → drill-down → facet selection → category → close.
  useEffect(() => {
    const hasState = isInContextActionMode || currentRootActionId || isInFacetMode || selectedCategory;
    if (!hasState) {
      return;
    }
    const handler = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') {
        return;
      }

      // Context action mode handles its own Escape via stopImmediatePropagation
      if (isInContextActionMode) {
        return;
      }

      e.preventDefault();
      e.stopImmediatePropagation();

      if (currentRootActionId) {
        query.setCurrentRootAction(null);
        query.setSearch('');
        return;
      }
      if (isInFacetMode) {
        cancelFacetSelection();
        return;
      }
      if (selectedCategory) {
        handleDeselectCategory();
        return;
      }
    };
    document.addEventListener('keydown', handler, true);
    return () => document.removeEventListener('keydown', handler, true);
  }, [isInContextActionMode, currentRootActionId, isInFacetMode, selectedCategory, query, cancelFacetSelection, handleDeselectCategory]);

  // Dashboard/folder search: hidden when scoped to a category or in facet/drill mode
  const { searchResults: dashboardFolderResults, isFetchingSearchResults } = useSearchResults({
    searchQuery,
    show: !currentRootActionId && !isInFacetMode && !selectedCategory,
  });

  // Combine all search results. Hide flat results when drilled in, in facet mode, or irrelevant.
  const searchResults = useMemo(
    () => (currentRootActionId || isInFacetMode ? [] : [...dashboardFolderResults, ...dynamicResults]),
    [dashboardFolderResults, dynamicResults, currentRootActionId, isInFacetMode]
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

  // Section title override when scoped to a category
  const facetedSectionCategory = useMemo(() => {
    if (!selectedCategory) {
      return undefined;
    }
    if (hasActiveFacets) {
      return `${selectedCategory} (${dynamicResultCount})`;
    }
    return selectedCategory;
  }, [selectedCategory, hasActiveFacets, dynamicResultCount]);

  // Show keyboard hints when categories or facets are relevant
  const showKeyboardHints =
    (selectedCategory && hasFacets && (isInFacetMode || hasActiveFacets || dynamicResultCount > 0)) ||
    (!selectedCategory && hasCategories);

  return (
    <KBarPositioner className={styles.positioner}>
      <KBarAnimator className={cx(styles.animator, hasDetailPanel && styles.animatorWide)}>
        <FocusScope contain autoFocus restoreFocus>
          <div {...overlayProps} {...dialogProps}>
            {/* KBarSearch container — visually hidden in facet/context-action mode but stays mounted so kbar keeps its input ref */}
            <div className={cx(styles.searchContainer, (isInFacetMode || isInContextActionMode) && styles.srOnly)}>
              {selectedCategory ? (
                <FacetBreadcrumbs
                  category={selectedCategory}
                  categoryIcon={selectedCategoryIcon}
                  facets={availableFacets}
                  activeFacets={activeFacets}
                  activeFacetLabels={activeFacetLabels}
                  selectingFacetId={null}
                />
              ) : (
                <AncestorBreadcrumbs />
              )}
              <KBarSearch
                defaultPlaceholder={
                  selectedCategory
                    ? t('command-palette.search-box.placeholder-filtered', 'Search by entity name...')
                    : t('command-palette.search-box.placeholder', 'Type a command or search...')
                }
                className={styles.search}
              />
              {(searchQuery || selectedCategory) && (
                <IconButton
                  name="times"
                  size="sm"
                  variant="secondary"
                  aria-label={t('command-palette.search-box.clear', 'Clear search')}
                  className={styles.clearButton}
                  tabIndex={-1}
                  onClick={() => {
                    query.setSearch('');
                    if (selectedCategory) {
                      handleDeselectCategory();
                    }
                    query.getInput().focus();
                  }}
                />
              )}
              <div className={styles.loadingBarContainer}>
                {(isFetchingSearchResults || isDynamicLoading) && <LoadingBar width={500} delay={0} />}
              </div>
            </div>

            {/* Body — context action step mode, facet value selection, or normal results */}
            {isInContextActionMode ? (
              <ContextActionStepList
                state={contextStepState}
                onTransition={(next) => {
                  if (next === null) {
                    exitContextStepMode();
                  } else {
                    setContextStepState(next);
                  }
                }}
                onClose={() => {
                  exitContextStepMode();
                  query.setVisualState(VisualState.animatingOut);
                }}
              />
            ) : isInFacetMode && selectingFacet && selectedCategory ? (
              <>
                <FacetValueList
                  values={filteredFacetValues}
                  isLoading={isLoadingFacetValues}
                  facetLabel={selectingFacet.label}
                  onSelect={selectFacetValue}
                  searchQuery={facetSearchQuery}
                  onSearchQueryChange={setFacetSearchQuery}
                  placeholder={selectingFacet.placeholder}
                  onBack={cancelFacetSelection}
                  breadcrumbs={
                    <FacetBreadcrumbs
                      category={selectedCategory}
                      categoryIcon={selectedCategoryIcon}
                      facets={availableFacets}
                      activeFacets={activeFacets}
                      activeFacetLabels={activeFacetLabels}
                      selectingFacetId={selectingFacetId}
                    />
                  }
                />
                <KeyboardHints
                  showBack={true}
                  showFacetShortcuts={false}
                  showSelect={filteredFacetValues.length > 0}
                />
              </>
            ) : (
              <>
                {/* Category pills (when no category selected) */}
                {!selectedCategory && hasCategories && !currentRootActionId && (
                  <CategoryPillBar
                    categories={availableCategories}
                    selectedCategory={selectedCategory}
                    onSelectCategory={handleSelectCategory}
                  />
                )}
                {/* Facet pills (when scoped to a category) */}
                {selectedCategory && hasFacets && !currentRootActionId && (
                  <FacetPillBar
                    facets={availableFacets}
                    activeFacets={activeFacets}
                    activeFacetLabels={activeFacetLabels}
                    onActivateFacet={activateFacet}
                    onRemoveFacet={removeFacet}
                  />
                )}
                {scopesRow ? <div className={styles.searchContainer}>{scopesRow}</div> : null}
                <div className={styles.resultsContainer}>
                  <RenderResults
                    isFetchingSearchResults={isFetchingSearchResults || isDynamicLoading}
                    searchResults={searchResults}
                    searchQuery={searchQuery}
                    onHasDetailPanelChange={setHasDetailPanel}
                    facetedSectionCategory={facetedSectionCategory}
                    selectedCategory={selectedCategory}
                  />
                </div>
                {showKeyboardHints && (
                  <KeyboardHints
                    showBack={!!selectedCategory || hasActiveFacets || !!currentRootActionId}
                    showFacetShortcuts={!currentRootActionId}
                    facetShortcutRange={shortcutRange}
                    showSelect={true}
                  />
                )}
              </>
            )}
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
  facetedSectionCategory?: string;
  selectedCategory?: string | null;
}

interface ActionWithDetailPanel extends ActionImpl {
  detailPanel?: React.ReactNode;
}

const RenderResults = ({
  isFetchingSearchResults,
  searchResults,
  searchQuery,
  onHasDetailPanelChange,
  facetedSectionCategory,
  selectedCategory,
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
    // When scoped to a category, include only dynamic plugin results from kbar (skip static actions)
    if (selectedCategory) {
      const dynamicItems = kbarResults.filter(
        (r): r is ActionImpl => typeof r !== 'string' && r.id.startsWith('dynamic-')
      );

      const results: Array<ActionImpl | string> = [];
      if (dynamicItems.length > 0) {
        const header = facetedSectionCategory ?? `${selectedCategory}(${dynamicItems.length})`;
        results.push(header);
        results.push(...dynamicItems);
      }

      groupedSearchResults.forEach((sectionItems, section) => {
        if (section !== dashboardsSectionTitle && section !== foldersSectionTitle && sectionItems.length > 0) {
          const header = facetedSectionCategory ?? `${section}(${sectionItems.length})`;
          results.push(header);
          results.push(...sectionItems);
        }
      });

      return results;
    }

    const results: Array<ActionImpl | string> = [...kbarResults];

    const folderResults = groupedSearchResults.get(foldersSectionTitle) ?? [];
    if (folderResults.length > 0) {
      results.push(foldersSectionTitle);
      results.push(...folderResults);
    }

    // Add dynamic plugin results (any section that's not dashboard/folder)
    groupedSearchResults.forEach((sectionItems, section) => {
      if (section !== dashboardsSectionTitle && section !== foldersSectionTitle && sectionItems.length > 0) {
        results.push(facetedSectionCategory ?? section);
        results.push(...sectionItems);
      }
    });

    const dashboardResults = groupedSearchResults.get(dashboardsSectionTitle) ?? [];
    if (dashboardResults.length > 0) {
      results.push(dashboardsSectionTitle);
      results.push(...dashboardResults);
    }

    return results;
  }, [kbarResults, groupedSearchResults, dashboardsSectionTitle, foldersSectionTitle, facetedSectionCategory, selectedCategory]);

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
        background: 'rgba(0, 0, 0, 0.25)',
      },
    }),
    animator: css({
      width: '100%',
      maxWidth: 796,
      color: theme.colors.text.primary,
      borderRadius: theme.shape.radius.lg,
      border: '1px solid #535355',
      background:
        'radial-gradient(222.44% 269.03% at -37.28% -70%, rgba(42, 48, 55, 0.80) 16.94%, rgba(18, 20, 23, 0.70) 80.25%)',
      boxShadow: '0 4px 34px 0 rgba(0, 0, 0, 0.50)',
      backdropFilter: 'blur(7.5px)',
      overflow: 'hidden',
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
      background: 'transparent',
      borderBottom: `1px solid ${theme.colors.border.weak}`,
      display: 'flex',
      padding: theme.spacing(2.5, 2),
      position: 'relative',
      justifyContent: 'space-between',
    }),
    search: css({
      width: '100%',
      boxSizing: 'border-box',
      outline: 'none',
      border: 'none',
      background: 'transparent',
      color: theme.colors.text.primary,
      fontFamily: 'Inter, sans-serif',
      fontSize: '18px',
      fontWeight: 400,
      lineHeight: '24px',
      letterSpacing: '-0.045px',
      '&::placeholder': {
        color: theme.colors.text.secondary,
      },
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
      padding: theme.spacing(1.5, 2, 0.5, 2),
      fontSize: theme.typography.bodySmall.fontSize,
      fontWeight: theme.typography.fontWeightMedium,
      color: theme.colors.text.secondary,
    }),
    sectionHeaderFirst: css({
      paddingTop: theme.spacing(0.5),
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
    srOnly: css({
      position: 'absolute',
      width: '1px',
      height: '1px',
      padding: 0,
      margin: '-1px',
      overflow: 'hidden',
      clip: 'rect(0, 0, 0, 0)',
      whiteSpace: 'nowrap',
      borderWidth: 0,
    }),
    clearButton: css({
      color: theme.colors.text.secondary,
      flexShrink: 0,
      '&:hover': {
        color: theme.colors.text.primary,
      },
    }),
    selectedScope: css({
      background: 'rgba(255, 255, 255, 0.10)',
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
