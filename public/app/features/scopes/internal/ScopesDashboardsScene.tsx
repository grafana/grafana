import { css, cx } from '@emotion/css';
import { isEqual } from 'lodash';

import { GrafanaTheme2, ScopeDashboardBinding } from '@grafana/data';
import { SceneComponentProps, SceneObjectBase, SceneObjectRef, SceneObjectState } from '@grafana/scenes';
import { Button, CustomScrollbar, LoadingPlaceholder, useStyles2 } from '@grafana/ui';
import { t, Trans } from 'app/core/internationalization';

import { ScopesDashboardsTree } from './ScopesDashboardsTree';
import { ScopesDashboardsTreeSearch } from './ScopesDashboardsTreeSearch';
import { ScopesSelectorScene } from './ScopesSelectorScene';
import { fetchDashboards } from './api';
import { DASHBOARDS_OPENED_KEY } from './const';
import { SuggestedDashboardsFoldersMap } from './types';
import { filterFolders, getScopeNamesFromSelectedScopes, groupDashboards } from './utils';

export interface ScopesDashboardsSceneState extends SceneObjectState {
  selector: SceneObjectRef<ScopesSelectorScene> | null;
  // by keeping a track of the raw response, it's much easier to check if we got any dashboards for the currently selected scopes
  dashboards: ScopeDashboardBinding[];
  // this is a grouping in folders of the `dashboards` property. it is used for filtering the dashboards and folders when the search query changes
  folders: SuggestedDashboardsFoldersMap;
  // a filtered version of the `folders` property. this prevents a lot of unnecessary parsings in React renders
  filteredFolders: SuggestedDashboardsFoldersMap;
  forScopeNames: string[];
  isLoading: boolean;
  isPanelOpened: boolean;
  isEnabled: boolean;
  scopesSelected: boolean;
  searchQuery: string;
}

export const getInitialDashboardsState: () => Omit<ScopesDashboardsSceneState, 'selector'> = () => ({
  dashboards: [],
  folders: {},
  filteredFolders: {},
  forScopeNames: [],
  isLoading: false,
  isPanelOpened: localStorage.getItem(DASHBOARDS_OPENED_KEY) === 'true',
  isEnabled: false,
  scopesSelected: false,
  searchQuery: '',
});

export class ScopesDashboardsScene extends SceneObjectBase<ScopesDashboardsSceneState> {
  static Component = ScopesDashboardsSceneRenderer;

  constructor() {
    super({
      selector: null,
      ...getInitialDashboardsState(),
    });

    this.addActivationHandler(() => {
      if (this.state.isEnabled && this.state.isPanelOpened) {
        this.fetchDashboards();
      }

      const resolvedSelector = this.state.selector?.resolve();

      if (resolvedSelector) {
        this._subs.add(
          resolvedSelector.subscribeToState((newState, prevState) => {
            if (
              this.state.isEnabled &&
              this.state.isPanelOpened &&
              !newState.isLoadingScopes &&
              (prevState.isLoadingScopes || newState.scopes !== prevState.scopes)
            ) {
              this.fetchDashboards();
            }
          })
        );
      }
    });
  }

  public async fetchDashboards() {
    const scopeNames = getScopeNamesFromSelectedScopes(this.state.selector?.resolve().state.scopes ?? []);

    if (isEqual(scopeNames, this.state.forScopeNames)) {
      return;
    }

    if (scopeNames.length === 0) {
      return this.setState({
        dashboards: [],
        folders: {},
        filteredFolders: {},
        forScopeNames: [],
        isLoading: false,
        scopesSelected: false,
      });
    }

    this.setState({ isLoading: true });

    const dashboards = await fetchDashboards(scopeNames);
    const folders = groupDashboards(dashboards);
    const filteredFolders = filterFolders(folders, this.state.searchQuery);

    this.setState({
      dashboards,
      folders,
      filteredFolders,
      forScopeNames: scopeNames,
      isLoading: false,
      scopesSelected: scopeNames.length > 0,
    });
  }

  public changeSearchQuery(searchQuery: string) {
    searchQuery = searchQuery ?? '';

    this.setState({
      filteredFolders: filterFolders(this.state.folders, searchQuery),
      searchQuery,
    });
  }

  public updateFolder(path: string[], isExpanded: boolean) {
    let folders = { ...this.state.folders };
    let filteredFolders = { ...this.state.filteredFolders };
    let currentLevelFolders: SuggestedDashboardsFoldersMap = folders;
    let currentLevelFilteredFolders: SuggestedDashboardsFoldersMap = filteredFolders;

    for (let idx = 0; idx < path.length - 1; idx++) {
      currentLevelFolders = currentLevelFolders[path[idx]].folders;
      currentLevelFilteredFolders = currentLevelFilteredFolders[path[idx]].folders;
    }

    const name = path[path.length - 1];
    const currentFolder = currentLevelFolders[name];
    const currentFilteredFolder = currentLevelFilteredFolders[name];

    currentFolder.isExpanded = isExpanded;
    currentFilteredFolder.isExpanded = isExpanded;

    this.setState({ folders, filteredFolders });
  }

  public togglePanel() {
    if (this.state.isPanelOpened) {
      this.closePanel();
    } else {
      this.openPanel();
    }
  }

  public openPanel() {
    this.fetchDashboards();
    this.setState({ isPanelOpened: true });
    localStorage.setItem(DASHBOARDS_OPENED_KEY, JSON.stringify(true));
  }

  public closePanel() {
    this.setState({ isPanelOpened: false });
    localStorage.setItem(DASHBOARDS_OPENED_KEY, JSON.stringify(false));
  }

  public enable() {
    this.setState({ isEnabled: true });
  }

  public disable() {
    this.setState({ isEnabled: false });
  }
}

export function ScopesDashboardsSceneRenderer({ model }: SceneComponentProps<ScopesDashboardsScene>) {
  const { dashboards, filteredFolders, isLoading, isPanelOpened, isEnabled, searchQuery, scopesSelected } =
    model.useState();

  const styles = useStyles2(getStyles);

  if (!isEnabled || !isPanelOpened) {
    return null;
  }

  if (!isLoading) {
    if (!scopesSelected) {
      return (
        <div
          className={cx(styles.container, styles.noResultsContainer)}
          data-testid="scopes-dashboards-notFoundNoScopes"
        >
          <Trans i18nKey="scopes.dashboards.noResultsNoScopes">No scopes selected</Trans>
        </div>
      );
    } else if (dashboards.length === 0) {
      return (
        <div
          className={cx(styles.container, styles.noResultsContainer)}
          data-testid="scopes-dashboards-notFoundForScope"
        >
          <Trans i18nKey="scopes.dashboards.noResultsForScopes">No dashboards found for the selected scopes</Trans>
        </div>
      );
    }
  }

  return (
    <div className={styles.container} data-testid="scopes-dashboards-container">
      <ScopesDashboardsTreeSearch
        disabled={isLoading}
        query={searchQuery}
        onChange={(value) => model.changeSearchQuery(value)}
      />

      {isLoading ? (
        <LoadingPlaceholder
          className={styles.loadingIndicator}
          text={t('scopes.dashboards.loading', 'Loading dashboards')}
          data-testid="scopes-dashboards-loading"
        />
      ) : filteredFolders[''] ? (
        <CustomScrollbar>
          <ScopesDashboardsTree
            folders={filteredFolders}
            folderPath={['']}
            onFolderUpdate={(path, isExpanded) => model.updateFolder(path, isExpanded)}
          />
        </CustomScrollbar>
      ) : (
        <p className={styles.noResultsContainer} data-testid="scopes-dashboards-notFoundForFilter">
          <Trans i18nKey="scopes.dashboards.noResultsForFilter">No results found for your query</Trans>

          <Button
            variant="secondary"
            onClick={() => model.changeSearchQuery('')}
            data-testid="scopes-dashboards-notFoundForFilter-clear"
          >
            <Trans i18nKey="scopes.dashboards.noResultsForFilterClear">Clear search</Trans>
          </Button>
        </p>
      )}
    </div>
  );
}

const getStyles = (theme: GrafanaTheme2) => {
  return {
    container: css({
      backgroundColor: theme.colors.background.primary,
      borderRight: `1px solid ${theme.colors.border.weak}`,
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      gap: theme.spacing(1),
      padding: theme.spacing(2),
      width: theme.spacing(37.5),
    }),
    noResultsContainer: css({
      alignItems: 'center',
      display: 'flex',
      flexDirection: 'column',
      gap: theme.spacing(1),
      height: '100%',
      justifyContent: 'center',
      margin: 0,
      textAlign: 'center',
    }),
    loadingIndicator: css({
      alignSelf: 'center',
    }),
  };
};
