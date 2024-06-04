import { css } from '@emotion/css';
import React from 'react';
import { Link } from 'react-router-dom';
import { from, Subscription } from 'rxjs';

import { GrafanaTheme2, Scope, ScopeDashboardBinding, urlUtil } from '@grafana/data';
import { SceneComponentProps, SceneObjectBase, SceneObjectState } from '@grafana/scenes';
import { CustomScrollbar, Icon, Input, LoadingPlaceholder, useStyles2 } from '@grafana/ui';
import { useQueryParams } from 'app/core/hooks/useQueryParams';

import { fetchDashboards } from './api/dashboards';

export interface ScopesDashboardsSceneState extends SceneObjectState {
  dashboards: ScopeDashboardBinding[];
  filteredDashboards: ScopeDashboardBinding[];
  isLoading: boolean;
  searchQuery: string;
}

export class ScopesDashboardsScene extends SceneObjectBase<ScopesDashboardsSceneState> {
  static Component = ScopesDashboardsSceneRenderer;

  private fetchSub: Subscription | undefined;

  constructor() {
    super({
      dashboards: [],
      filteredDashboards: [],
      isLoading: false,
      searchQuery: '',
    });

    this.addActivationHandler(() => {
      return () => {
        this.fetchSub?.unsubscribe();
      };
    });
  }

  public fetchDashboards(scopes: Scope[]) {
    this.fetchSub?.unsubscribe();

    if (scopes.length === 0) {
      return this.setState({ dashboards: [], filteredDashboards: [], isLoading: false });
    }

    this.setState({ isLoading: true });

    this.fetchSub = from(fetchDashboards(scopes)).subscribe((dashboards) => {
      this.fetchSub?.unsubscribe();

      this.setState({
        dashboards,
        filteredDashboards: this.filterDashboards(dashboards, this.state.searchQuery),
        isLoading: false,
      });
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
          disabled={isLoading}
          onChange={(evt) => model.changeSearchQuery(evt.currentTarget.value)}
        />
      </div>

      {isLoading ? (
        <LoadingPlaceholder className={styles.loadingIndicator} text="Loading dashboards" />
      ) : (
        <CustomScrollbar>
          {filteredDashboards.map(({ spec: { dashboard, dashboardTitle } }, idx) => (
            <div key={idx} className={styles.dashboardItem}>
              <Link to={urlUtil.renderUrl(`/d/${dashboard}`, queryParams)}>{dashboardTitle}</Link>
            </div>
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

      ':first-child': {
        paddingTop: 0,
      },
    }),
  };
};
