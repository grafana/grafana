import { css } from '@emotion/css';
import React from 'react';
import { Link } from 'react-router-dom';

import { GrafanaTheme2, Scope, urlUtil } from '@grafana/data';
import { SceneComponentProps, SceneObjectBase, SceneObjectState } from '@grafana/scenes';
import { CustomScrollbar, Icon, Input, useStyles2 } from '@grafana/ui';
import { useQueryParams } from 'app/core/hooks/useQueryParams';

import { fetchDashboards } from './api/dashboards';
import { ScopeDashboard } from './types';

export interface ScopesDashboardsSceneState extends SceneObjectState {
  dashboards: ScopeDashboard[];
  filteredDashboards: ScopeDashboard[];
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

  private filterDashboards(dashboards: ScopeDashboard[], searchQuery: string) {
    const lowerCasedSearchQuery = searchQuery.toLowerCase();

    return dashboards.filter((dashboard) => dashboard.title.toLowerCase().includes(lowerCasedSearchQuery));
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
          disabled={isLoading}
          onChange={(evt) => model.changeSearchQuery(evt.currentTarget.value)}
        />
      </div>

      <CustomScrollbar>
        {filteredDashboards.map((dashboard, idx) => (
          <div key={idx} className={styles.dashboardItem}>
            <Link to={urlUtil.renderUrl(dashboard.url, queryParams)}>{dashboard.title}</Link>
          </div>
        ))}
      </CustomScrollbar>
    </>
  );
}

const getStyles = (theme: GrafanaTheme2) => {
  return {
    searchInputContainer: css({
      flex: '0 1 auto',
    }),
    dashboardItem: css({
      padding: theme.spacing(1, 0),
      borderBottom: `1px solid ${theme.colors.border.weak}`,

      ':first-child': {
        paddingTop: 0,
      },
    }),
  };
};
