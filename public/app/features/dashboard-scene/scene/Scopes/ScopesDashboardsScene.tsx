import { css } from '@emotion/css';
import { Link } from 'react-router-dom';

import { GrafanaTheme2, Scope, urlUtil } from '@grafana/data';
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
      scopesSelected: false,
      searchQuery: '',
    });
  }

  public async fetchDashboards(scopes: Scope[]) {
    if (scopes.length === 0) {
      return this.setState({ dashboards: [], filteredDashboards: [], isLoading: false, scopesSelected: false });
    }

    this.setState({ isLoading: true });

    const dashboards = await fetchSuggestedDashboards(scopes);

    this.setState({
      dashboards,
      filteredDashboards: this.filterDashboards(dashboards, this.state.searchQuery),
      isLoading: false,
      scopesSelected: scopes.length > 0,
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

  private filterDashboards(dashboards: SuggestedDashboard[], searchQuery: string): SuggestedDashboard[] {
    const lowerCasedSearchQuery = searchQuery.toLowerCase();

    return dashboards.filter(({ dashboardTitle }) => dashboardTitle.toLowerCase().includes(lowerCasedSearchQuery));
  }
}

export function ScopesDashboardsSceneRenderer({ model }: SceneComponentProps<ScopesDashboardsScene>) {
  const { dashboards, filteredDashboards, isLoading, searchQuery, scopesSelected } = model.useState();
  const styles = useStyles2(getStyles);

  const [queryParams] = useQueryParams();

  if (!isLoading) {
    if (!scopesSelected) {
      return (
        <p className={styles.noResultsContainer} data-testid="scopes-dashboards-notFoundNoScopes">
          <Trans i18nKey="scopes.suggestedDashboards.noResultsNoScopes">No scopes selected</Trans>
        </p>
      );
    } else if (dashboards.length === 0) {
      return (
        <p className={styles.noResultsContainer} data-testid="scopes-dashboards-notFoundForScope">
          <Trans i18nKey="scopes.suggestedDashboards.noResultsForScopes">
            No dashboards found for the selected scopes
          </Trans>
        </p>
      );
    }
  }

  return (
    <>
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
    </>
  );
}

const getStyles = (theme: GrafanaTheme2) => {
  return {
    noResultsContainer: css({
      alignItems: 'center',
      display: 'flex',
      flexDirection: 'column',
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
