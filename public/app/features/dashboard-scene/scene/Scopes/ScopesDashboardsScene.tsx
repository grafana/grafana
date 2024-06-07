import { css } from '@emotion/css';
import React from 'react';
import { Link } from 'react-router-dom';

import { GrafanaTheme2, Scope, ScopeDashboardBinding, urlUtil } from '@grafana/data';
import { SceneComponentProps, SceneObjectBase, SceneObjectState } from '@grafana/scenes';
import { CustomScrollbar, Icon, Input, LoadingPlaceholder, useStyles2 } from '@grafana/ui';
import { useQueryParams } from 'app/core/hooks/useQueryParams';
import { t } from 'app/core/internationalization';

import { fetchDashboards } from './api';

export interface ScopesDashboardsSceneState extends SceneObjectState {
  dashboards: ScopeDashboardBinding[];
  filteredDashboards: ScopeDashboardBinding[];
  isLoading: boolean;
  searchQuery: string;
}

export class ScopesDashboardsScene extends SceneObjectBase<ScopesDashboardsSceneState> {
  static Component = ScopesDashboardsSceneRenderer;

  constructor() {
    super({
      dashboards: [],
      filteredDashboards: [],
      isLoading: false,
      searchQuery: '',
    });
  }

  public async fetchDashboards(scopes: Scope[]) {
    if (scopes.length === 0) {
      return this.setState({ dashboards: [], filteredDashboards: [], isLoading: false });
    }

    this.setState({ isLoading: true });

    const dashboards = await fetchDashboards(scopes);

    this.setState({
      dashboards,
      filteredDashboards: this.filterDashboards(dashboards, this.state.searchQuery),
      isLoading: false,
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

  private filterDashboards(dashboards: ScopeDashboardBinding[], searchQuery: string) {
    const lowerCasedSearchQuery = searchQuery.toLowerCase();

    return dashboards.filter(({ spec: { dashboardTitle } }) =>
      dashboardTitle.toLowerCase().includes(lowerCasedSearchQuery)
    );
  }
}

export function ScopesDashboardsSceneRenderer({ model }: SceneComponentProps<ScopesDashboardsScene>) {
  const { filteredDashboards, isLoading } = model.useState();
  const styles = useStyles2(getStyles);

  const [queryParams] = useQueryParams();

  return (
    <>
      <div className={styles.searchInputContainer}>
        <Input
          prefix={<Icon name="search" />}
          placeholder={t('scopes.suggestedDashboards.search', 'Filter')}
          disabled={isLoading}
          data-testid="scopes-dashboards-search"
          onChange={(evt) => model.changeSearchQuery(evt.currentTarget.value)}
        />
      </div>

      {isLoading ? (
        <LoadingPlaceholder
          className={styles.loadingIndicator}
          text={t('scopes.suggestedDashboards.loading', 'Loading dashboards')}
          data-testid="scopes-dashboards-loading"
        />
      ) : (
        <CustomScrollbar>
          {filteredDashboards.map(({ spec: { dashboard, dashboardTitle } }) => (
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
      )}
    </>
  );
}

const getStyles = (theme: GrafanaTheme2) => {
  return {
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
