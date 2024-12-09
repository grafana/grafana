import { css, cx } from '@emotion/css';
import { isEqual } from 'lodash';
import { finalize, from, Subscription } from 'rxjs';

import { GrafanaTheme2, ScopeDashboardBinding } from '@grafana/data';
import { SceneComponentProps, SceneObjectBase, SceneObjectRef, SceneObjectState } from '@grafana/scenes';
import { Button, LoadingPlaceholder, ScrollContainer, useStyles2 } from '@grafana/ui';
import { t, Trans } from 'app/core/internationalization';

import { ScopesDashboardsTree } from './ScopesDashboardsTree';
import { ScopesDashboardsTreeSearch } from './ScopesDashboardsTreeSearch';
import { ScopesSelectorScene } from './ScopesSelectorScene';
import { fetchDashboards } from './api';
import { SuggestedDashboardsFoldersMap } from './types';
import { filterFolders, groupDashboards } from './utils';

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
  isReadOnly: boolean;
  searchQuery: string;
}

export const getInitialDashboardsState: () => Omit<ScopesDashboardsSceneState, 'selector'> = () => ({
  dashboards: [],
  folders: {},
  filteredFolders: {},
  forScopeNames: [],
  isLoading: false,
  isPanelOpened: false,
  isEnabled: false,
  isReadOnly: false,
  searchQuery: '',
});

export class ScopesDashboardsScene extends SceneObjectBase<ScopesDashboardsSceneState> {
  static Component = ScopesDashboardsSceneRenderer;

  private dashboardsFetchingSub: Subscription | undefined;

  constructor() {
    super({
      selector: null,
      ...getInitialDashboardsState(),
    });

    this.addActivationHandler(() => {
      return () => {
        this.dashboardsFetchingSub?.unsubscribe();
      };
    });
  }

  public async fetchDashboards(scopeNames: string[]) {
    if (isEqual(this.state.forScopeNames, scopeNames)) {
      return;
    }

    this.dashboardsFetchingSub?.unsubscribe();

    this.setState({ forScopeNames: scopeNames });

    if (scopeNames.length === 0) {
      return this.setState({
        dashboards: [],
        folders: {},
        filteredFolders: {},
        forScopeNames: [],
        isLoading: false,
        isPanelOpened: false,
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
          isPanelOpened: scopeNames.length > 0,
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
  const { dashboards, filteredFolders, forScopeNames, isLoading, isPanelOpened, isEnabled, isReadOnly, searchQuery } =
    model.useState();

  const styles = useStyles2(getStyles);

  if (!isEnabled || !isPanelOpened || isReadOnly) {
    return null;
  }

  if (!isLoading) {
    if (forScopeNames.length === 0) {
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
