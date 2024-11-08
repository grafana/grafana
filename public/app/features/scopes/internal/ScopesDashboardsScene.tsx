import { css, cx } from '@emotion/css';
import { isEqual } from 'lodash';
import { finalize, from } from 'rxjs';

import { GrafanaTheme2, InternalSuggestedDashboardsFoldersMap } from '@grafana/data';
import { ScopesDashboardsLike, ScopesDashboardsLikeState } from '@grafana/runtime';
import { SceneComponentProps } from '@grafana/scenes';
import { Button, LoadingPlaceholder, ScrollContainer, useStyles2 } from '@grafana/ui';
import { t, Trans } from 'app/core/internationalization';

import { ScopesDashboardsTree } from './ScopesDashboardsTree';
import { ScopesDashboardsTreeSearch } from './ScopesDashboardsTreeSearch';
import { fetchDashboards } from './api';
import { filterFolders, getScopeNamesFromSelectedScopes, groupDashboards } from './utils';

export const getInitialDashboardsState: () => Omit<ScopesDashboardsLikeState, 'selector'> = () => ({
  dashboards: [],
  folders: {},
  filteredFolders: {},
  forScopeNames: [],
  isLoading: false,
  isPanelOpened: false,
  isEnabled: false,
  isReadOnly: false,
  scopesSelected: false,
  searchQuery: '',
});

export class ScopesDashboardsScene extends ScopesDashboardsLike {
  static Component = ScopesDashboardsSceneRenderer;

  constructor() {
    super({
      selector: null,
      ...getInitialDashboardsState(),
    });

    this.addActivationHandler(() => {
      const resolvedSelector = this.state.selector?.resolve();

      if (resolvedSelector?.state.scopes.length ?? 0 > 0) {
        this.fetchDashboards();
        this.openPanel();
      }

      if (resolvedSelector) {
        this._subs.add(
          resolvedSelector.subscribeToState((newState, prevState) => {
            const newScopeNames = getScopeNamesFromSelectedScopes(newState.scopes ?? []);
            const oldScopeNames = getScopeNamesFromSelectedScopes(prevState.scopes ?? []);

            if (!isEqual(newScopeNames, oldScopeNames)) {
              this.fetchDashboards();

              if (newState.scopes.length > 0) {
                this.openPanel();
              } else {
                this.closePanel();
              }
            }
          })
        );
      }

      return () => {
        this.dashboardsFetchingSub?.unsubscribe();
      };
    });
  }

  public async fetchDashboards() {
    const scopeNames = getScopeNamesFromSelectedScopes(this.state.selector?.resolve().state.scopes ?? []);

    this.dashboardsFetchingSub?.unsubscribe();

    this.setState({ forScopeNames: scopeNames });

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

    this.dashboardsFetchingSub = from(fetchDashboards(scopeNames))
      .pipe(
        finalize(() => {
          this.setState({ isLoading: false });
        })
      )
      .subscribe((dashboards) => {
        const folders = groupDashboards(dashboards);
        const filteredFolders = filterFolders(folders, this.state.searchQuery);

        this.setState({
          dashboards,
          folders,
          filteredFolders,
          isLoading: false,
          scopesSelected: scopeNames.length > 0,
        });

        this.dashboardsFetchingSub?.unsubscribe();
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
    let currentLevelFolders: InternalSuggestedDashboardsFoldersMap = folders;
    let currentLevelFilteredFolders: InternalSuggestedDashboardsFoldersMap = filteredFolders;

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
    if (this.state.isPanelOpened) {
      return;
    }

    this.setState({ isPanelOpened: true });
  }

  public closePanel() {
    if (!this.state.isPanelOpened) {
      return;
    }

    this.setState({ isPanelOpened: false });
  }

  public enable() {
    this.setState({ isEnabled: true });
  }

  public disable() {
    this.setState({ isEnabled: false });
  }

  public enterReadOnly() {
    this.setState({ isReadOnly: true });
  }

  public exitReadOnly() {
    this.setState({ isReadOnly: false });
  }
}

export function ScopesDashboardsSceneRenderer({ model }: SceneComponentProps<ScopesDashboardsScene>) {
  const { dashboards, filteredFolders, isLoading, isPanelOpened, isEnabled, isReadOnly, searchQuery, scopesSelected } =
    model.useState();

  const styles = useStyles2(getStyles);

  if (!isEnabled || !isPanelOpened || isReadOnly) {
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
        <ScrollContainer>
          <ScopesDashboardsTree
            folders={filteredFolders}
            folderPath={['']}
            onFolderUpdate={(path, isExpanded) => model.updateFolder(path, isExpanded)}
          />
        </ScrollContainer>
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
