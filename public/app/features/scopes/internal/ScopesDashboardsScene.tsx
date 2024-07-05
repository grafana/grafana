import { css, cx } from '@emotion/css';
import { Link } from 'react-router-dom';

import { GrafanaTheme2, urlUtil } from '@grafana/data';
import { SceneComponentProps, SceneObjectBase, SceneObjectState } from '@grafana/scenes';
import { Button, CustomScrollbar, FilterInput, LoadingPlaceholder, useStyles2 } from '@grafana/ui';
import { useQueryParams } from 'app/core/hooks/useQueryParams';
import { t, Trans } from 'app/core/internationalization';

import { fetchSuggestedDashboards } from './api';
import { SuggestedDashboard } from './types';

export interface ScopesDashboardsSceneState extends SceneObjectState {
  dashboards: SuggestedDashboard[];
  filteredDashboards: SuggestedDashboard[];
  isLoading: boolean;
  isVisible: boolean;
  scopesSelected: boolean;
  searchQuery: string;
}

export class ScopesDashboardsScene extends SceneObjectBase<ScopesDashboardsSceneState> {
  static Component = ScopesDashboardsSceneRenderer;

  constructor() {
    super({
      dashboards: [],
      filteredDashboards: [],
      isLoading: false,
      isVisible: false,
      scopesSelected: false,
      searchQuery: '',
    });
  }

  public async fetchDashboards(scopeNames: string[]) {
    if (scopeNames.length === 0) {
      return this.setState({ dashboards: [], filteredDashboards: [], isLoading: false, scopesSelected: false });
    }

    this.setState({ isLoading: true });

    const dashboards = await fetchSuggestedDashboards(scopeNames);

    this.setState({
      dashboards,
      filteredDashboards: this.filterDashboards(dashboards, this.state.searchQuery),
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

  public toggle(scopeNames: string[]) {
    if (this.state.isVisible) {
      this.hide();
    } else {
      this.show(scopeNames);
    }
  }

  public show(scopeNames: string[]) {
    this.fetchDashboards(scopeNames);
    this.setState({ isVisible: true });
  }

  public hide() {
    this.setState({ isVisible: false });
  }

  public enterViewMode() {
    this.hide();
  }

  public exitViewMode() {}

  private filterDashboards(dashboards: SuggestedDashboard[], searchQuery: string): SuggestedDashboard[] {
    const lowerCasedSearchQuery = searchQuery.toLowerCase();

    return dashboards.filter(({ dashboardTitle }) => dashboardTitle.toLowerCase().includes(lowerCasedSearchQuery));
  }
}

export function ScopesDashboardsSceneRenderer({ model }: SceneComponentProps<ScopesDashboardsScene>) {
  const { dashboards, filteredDashboards, isLoading, isVisible, searchQuery, scopesSelected } = model.useState();
  const styles = useStyles2(getStyles);

  const [queryParams] = useQueryParams();

  if (!isVisible) {
    return null;
  }

  if (!isLoading) {
    if (!scopesSelected) {
      return (
        <p className={cx(styles.container, styles.noResultsContainer)} data-testid="scopes-dashboards-notFoundNoScopes">
          <Trans i18nKey="scopes.suggestedDashboards.noResultsNoScopes">No scopes selected</Trans>
        </p>
      );
    } else if (dashboards.length === 0) {
      return (
        <p className={cx(styles.container, styles.noResultsContainer)} data-testid="scopes-dashboards-notFoundForScope">
          <Trans i18nKey="scopes.suggestedDashboards.noResultsForScopes">
            No dashboards found for the selected scopes
          </Trans>
        </p>
      );
    }
  }

  return (
    <div className={styles.container}>
      <div className={styles.searchInputContainer}>
        <FilterInput
          disabled={isLoading}
          placeholder={t('scopes.suggestedDashboards.search', 'Search')}
          value={searchQuery}
          data-testid="scopes-dashboards-search"
          onChange={(value) => model.changeSearchQuery(value)}
        />
      </div>

      {isLoading ? (
        <LoadingPlaceholder
          className={styles.loadingIndicator}
          text={t('scopes.suggestedDashboards.loading', 'Loading dashboards')}
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
          <Trans i18nKey="scopes.suggestedDashboards.noResultsForFilter">No results found for your query</Trans>

          <Button
            variant="secondary"
            onClick={() => model.changeSearchQuery('')}
            data-testid="scopes-dashboards-notFoundForFilter-clear"
          >
            <Trans i18nKey="scopes.suggestedDashboards.noResultsForFilterClear">Clear search</Trans>
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
      display: 'flex',
      flexDirection: 'column',
      padding: theme.spacing(2),
    }),
    noResultsContainer: css({
      alignItems: 'center',
      gap: theme.spacing(1),
      justifyContent: 'center',
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
