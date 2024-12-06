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
import { ComponentProps, useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { config, reportInteraction } from '@grafana/runtime';
import { EmptyState, Icon, LoadingBar, Tab, TabContent, TabsBar, useStyles2 } from '@grafana/ui';
import { t } from 'app/core/internationalization';

import { KBarResults } from './KBarResults';
import { ResultItem } from './ResultItem';
import { useDashboardsAndFoldersSearchResults } from './actions/dashboardActions';
import useActions from './actions/useActions';
import { COMMAND_PALETTE_TABS, CommandPaletteAction, CommandPaletteActiveTab } from './types';
import { useMatches } from './useMatches';
import { getCommandPalettePosition, getFilteredKbarResultsBasedOnCommandPaletteActions } from './utils';

export function CommandPalette() {
  const [activeTab, setActiveTab] = useState<CommandPaletteActiveTab>('recent');
  const lateralSpace = getCommandPalettePosition();
  const styles = useStyles2(getSearchStyles, lateralSpace);

  const { query, showing, searchQuery } = useKBar((state) => ({
    showing: state.visualState === VisualState.showing,
    searchQuery: state.searchQuery,
  }));

  const { allSearchableActions, userDefinedActions, recentActions, setNewRecentAction, isFechingUserDefinedActions } =
    useActions(searchQuery, showing);

  useRegisterActions(allSearchableActions, [allSearchableActions]);
  const { searchResults, isFetchingSearchResults } = useDashboardsAndFoldersSearchResults(searchQuery, showing);

  const ref = useRef<HTMLDivElement>(null);
  const { overlayProps } = useOverlay(
    { isOpen: showing, onClose: () => query.setVisualState(VisualState.animatingOut) },
    ref
  );

  const { dialogProps } = useDialog({}, ref);

  // Report interaction when opened
  useEffect(() => {
    if (showing) {
      reportInteraction('command_palette_opened');
    }
  }, [showing]);

  return allSearchableActions.length > 0 ? (
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
                  onChange={() => setActiveTab('all')}
                />
                <div className={styles.loadingBarContainer}>
                  {isFetchingSearchResults && <LoadingBar width={500} delay={0} />}
                </div>
              </div>
              <div className={styles.resultsContainer}>
                <TabsBar>
                  {COMMAND_PALETTE_TABS.map((tab) => (
                    <Tab
                      key={tab.key}
                      label={tab.label}
                      active={activeTab === tab.key}
                      onChangeTab={() => {
                        setActiveTab(tab.key);
                      }}
                    />
                  ))}
                </TabsBar>
                <TabContent>
                  {activeTab === 'recent' && (
                    <FlatKbarResults
                      commandPaletteActions={['Actions', ...recentActions]}
                      isLoading={isFechingUserDefinedActions}
                      setRecentAction={setNewRecentAction}
                    />
                  )}
                  {activeTab === 'mine' && (
                    <FlatKbarResults
                      commandPaletteActions={['Actions', ...userDefinedActions]}
                      isLoading={isFechingUserDefinedActions}
                      setRecentAction={setNewRecentAction}
                    />
                  )}
                  {activeTab === 'all' && (
                    <KbarResults
                      isLoading={isFetchingSearchResults || isFechingUserDefinedActions}
                      commandPaletteActions={[...allSearchableActions, ...searchResults]}
                      setRecentAction={setNewRecentAction}
                    />
                  )}
                </TabContent>
              </div>
            </div>
          </FocusScope>
        </KBarAnimator>
      </KBarPositioner>
    </KBarPortal>
  ) : null;
}

interface RenderResultsProps {
  isLoading: boolean;
  commandPaletteActions: Array<CommandPaletteAction | string>;
  setRecentAction?: (id: string) => void;
}

const KbarResults = ({ isLoading, commandPaletteActions, setRecentAction }: RenderResultsProps) => {
  const { results: kbarResults } = useMatches();
  const dashboardsSectionTitle = t('command-palette.section.dashboard-search-results', 'Dashboards');
  const foldersSectionTitle = t('command-palette.section.folder-search-results', 'Folders');

  // because dashboard search results aren't registered as actions, we need to manually
  // convert them to ActionImpls before passing them as items to KBarResults
  const getResultItems = useCallback(
    (name: 'dashboard' | 'folder') =>
      commandPaletteActions
        .filter((item) => typeof item !== 'string' && item.id.startsWith(`go/${name}`))
        .map((d) => (typeof d === 'string' ? d : new ActionImpl(d, { store: {} }))),
    [commandPaletteActions]
  );
  const dashboardResultItems = useMemo(() => getResultItems('dashboard'), [getResultItems]);
  const folderResultItems = useMemo(() => getResultItems('folder'), [getResultItems]);

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

  return <Results items={items} isLoading={isLoading} onResultClick={setRecentAction} />;
};

const FlatKbarResults = ({ isLoading, commandPaletteActions, setRecentAction }: RenderResultsProps) => {
  const { results: kbarResults } = useMatches();
  const filteredResults = getFilteredKbarResultsBasedOnCommandPaletteActions(kbarResults, commandPaletteActions);

  return <Results items={filteredResults} isLoading={isLoading} onResultClick={setRecentAction} />;
};

const Results = ({
  items,
  isLoading,
  onResultClick,
}: {
  items: ComponentProps<typeof KBarResults>['items'];
  isLoading?: boolean;
  onResultClick?: (id: string) => void;
}) => {
  const { rootActionId } = useMatches();
  const lateralSpace = getCommandPalettePosition();
  const styles = useStyles2(getSearchStyles, lateralSpace);

  const showEmptyState = !isLoading && items.length === 0;

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
      onClick={onResultClick}
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

const getSearchStyles = (theme: GrafanaTheme2, lateralSpace: number) => {
  const isSingleTopNav = config.featureToggles.singleTopNav;

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
        backdropFilter: 'blur(1px)',
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
      ...(isSingleTopNav && {
        [theme.breakpoints.up('lg')]: {
          position: 'fixed',
          right: lateralSpace,
          left: lateralSpace,
          maxWidth: 'unset',
          width: 'unset',
        },
      }),
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
