import { css } from '@emotion/css';
import React from 'react';
import { NavLink } from 'react-router-dom';

import { AppEvents, GrafanaTheme2, ScopeDashboard } from '@grafana/data';
import { config, getAppEvents, getBackendSrv } from '@grafana/runtime';
import { SceneComponentProps, SceneObjectBase, SceneObjectState } from '@grafana/scenes';
import { CustomScrollbar, Icon, Input, useStyles2 } from '@grafana/ui';

export interface ScopesDashboardsSceneState extends SceneObjectState {
  dashboards: ScopeDashboard[];
  filteredDashboards: ScopeDashboard[];
  isLoading: boolean;
  searchQuery: string;
}

export class ScopesDashboardsScene extends SceneObjectBase<ScopesDashboardsSceneState> {
  static Component = ScopesDashboardsSceneRenderer;

  private _url =
    config.bootData.settings.listDashboardScopesEndpoint || '/apis/scope.grafana.app/v0alpha1/scopedashboards';

  constructor() {
    super({
      dashboards: [],
      filteredDashboards: [],
      isLoading: false,
      searchQuery: '',
    });
  }

  public async fetchDashboards(scope: string | undefined) {
    if (!scope) {
      return this.setState({ dashboards: [], filteredDashboards: [], isLoading: false });
    }

    this.setState({ isLoading: true });

    try {
      const response = await getBackendSrv().get<{
        items: Array<{ spec: { dashboardUids: null | string[]; scopeUid: string } }>;
      }>(this._url, { scope });

      const dashboardUids =
        response.items.find((item) => !!item.spec.dashboardUids && item.spec.scopeUid === scope)?.spec.dashboardUids ??
        [];
      const dashboardsRaw = await Promise.all(
        dashboardUids.map((dashboardUid) => getBackendSrv().get(`/api/dashboards/uid/${dashboardUid}`))
      );
      const dashboards = dashboardsRaw.map((dashboard) => ({
        uid: dashboard.dashboard.uid,
        title: dashboard.dashboard.title,
        url: dashboard.meta.url,
      }));

      this.setState({
        dashboards,
        filteredDashboards: this.filterDashboards(dashboards, this.state.searchQuery),
        isLoading: false,
      });
    } catch (error) {
      getAppEvents().publish({
        type: AppEvents.alertError.name,
        payload: ['Failed to fetch suggested dashboards'],
      });
    } finally {
      this.setState({ isLoading: false });
    }
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
            <NavLink to={dashboard.url}>{dashboard.title}</NavLink>
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
