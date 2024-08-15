import { css, cx } from '@emotion/css';
import { isEqual } from 'lodash';
import { Link } from 'react-router-dom';

import { GrafanaTheme2, urlUtil } from '@grafana/data';
import { SceneComponentProps, SceneObjectBase, SceneObjectRef, SceneObjectState } from '@grafana/scenes';
import { Button, CustomScrollbar, FilterInput, LoadingPlaceholder, useStyles2 } from '@grafana/ui';
import { useQueryParams } from 'app/core/hooks/useQueryParams';
import { t, Trans } from 'app/core/internationalization';

import { ScopesSelectorScene } from './ScopesSelectorScene';
import { fetchSuggestedDashboards } from './api';
import { DASHBOARDS_OPENED_KEY } from './const';
import { SuggestedDashboard } from './types';
import { getScopeNamesFromSelectedScopes } from './utils';

export interface ScopesDashboardsSceneState extends SceneObjectState {
  selector: SceneObjectRef<ScopesSelectorScene> | null;
  dashboards: SuggestedDashboard[];
  filteredDashboards: SuggestedDashboard[];
  forScopeNames: string[];
  isLoading: boolean;
  isPanelOpened: boolean;
  isEnabled: boolean;
  scopesSelected: boolean;
  searchQuery: string;
}

export const getInitialDashboardsState: () => Omit<ScopesDashboardsSceneState, 'selector'> = () => ({
  dashboards: [],
  filteredDashboards: [],
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
        filteredDashboards: [],
        forScopeNames: [],
        isLoading: false,
        scopesSelected: false,
      });
    }

    this.setState({ isLoading: true });

    const dashboards = await fetchSuggestedDashboards(scopeNames);

    this.setState({
      dashboards,
      filteredDashboards: this.filterDashboards(dashboards, this.state.searchQuery),
      forScopeNames: scopeNames,
      isLoading: false,
      scopesSelected: scopeNames.length > 0,
    });
  }

  public changeSearchQuery(searchQuery: string) {
    this.setState({
      filteredDashboards: searchQuery
        ? this.filterDashboards(this.state.dashboards, searchQuery)
        : this.state.dashboards,
      searchQuery: searchQuery ?? '',
    });
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

  private filterDashboards(dashboards: SuggestedDashboard[], searchQuery: string): SuggestedDashboard[] {
    const lowerCasedSearchQuery = searchQuery.toLowerCase();

    return dashboards.filter(({ dashboardTitle }) => dashboardTitle.toLowerCase().includes(lowerCasedSearchQuery));
  }
}

export function ScopesDashboardsSceneRenderer({ model }: SceneComponentProps<ScopesDashboardsScene>) {
  const { dashboards, filteredDashboards, isLoading, isPanelOpened, isEnabled, searchQuery, scopesSelected } =
    model.useState();
  const styles = useStyles2(getStyles);

  const [queryParams] = useQueryParams();

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
      <div className={styles.searchInputContainer}>
        <FilterInput
          disabled={isLoading}
          placeholder={t('scopes.dashboards.search', 'Search')}
          value={searchQuery}
          data-testid="scopes-dashboards-search"
          onChange={(value) => model.changeSearchQuery(value)}
        />
      </div>

      {isLoading ? (
        <LoadingPlaceholder
          className={styles.loadingIndicator}
          text={t('scopes.dashboards.loading', 'Loading dashboards')}
          data-testid="scopes-dashboards-loading"
        />
      ) : filteredDashboards.length > 0 ? (
        <CustomScrollbar>
          {filteredDashboards.map(({ dashboard, dashboardTitle }) => (
            <Link
              key={dashboard}
              to={urlUtil.renderUrl(`/d/${dashboard}/`, queryParams)}
              className={styles.dashboardItem}
              data-testid={`scopes-dashboards-${dashboard}`}
            >
              {dashboardTitle}
            </Link>
          ))}
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
    searchInputContainer: css({
      flex: '0 1 auto',
    }),
    loadingIndicator: css({
      alignSelf: 'center',
    }),
    dashboardItem: css({
      padding: theme.spacing(1, 0),
      borderBottom: `1px solid ${theme.colors.border.weak}`,

      '& :is(:first-child)': {
        paddingTop: 0,
      },
    }),
  };
};
