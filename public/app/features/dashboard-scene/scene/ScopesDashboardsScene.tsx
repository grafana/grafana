import { css } from '@emotion/css';
import React from 'react';
import { Link } from 'react-router-dom';

import { AppEvents, GrafanaTheme2, ScopeDashboard, ScopeDashboardBindingSpec } from '@grafana/data';
import { config, getAppEvents, getBackendSrv, locationService } from '@grafana/runtime';
import { SceneComponentProps, SceneObjectBase, SceneObjectState } from '@grafana/scenes';
import { CustomScrollbar, Icon, Input, useStyles2 } from '@grafana/ui';

import { ScopedResourceServer } from '../../apiserver/server';

export interface ScopesDashboardsSceneState extends SceneObjectState {
  dashboards: ScopeDashboard[];
  filteredDashboards: ScopeDashboard[];
  isLoading: boolean;
  searchQuery: string;
}

export class ScopesDashboardsScene extends SceneObjectBase<ScopesDashboardsSceneState> {
  static Component = ScopesDashboardsSceneRenderer;

  private server = new ScopedResourceServer<ScopeDashboardBindingSpec, 'ScopeDashboardBinding'>({
    group: 'scope.grafana.app',
    version: 'v0alpha1',
    resource: 'scopedashboardbindings',
  });

  constructor() {
    super({
      dashboards: [],
      filteredDashboards: [],
      isLoading: false,
      searchQuery: '',
    });

    if (config.bootData.settings.listDashboardScopesEndpoint) {
      this.server.overwriteUrl(config.bootData.settings.listDashboardScopesEndpoint);
    }
  }

  public async fetchDashboards(scope: string | undefined) {
    if (!scope) {
      return this.setState({ dashboards: [], filteredDashboards: [], isLoading: false });
    }

    this.setState({ isLoading: true });

    const dashboardUids = await this.fetchDashboardsUids(scope);
    const dashboards = await this.fetchDashboardsDetails(dashboardUids);

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

  private async fetchDashboardsUids(scope: string): Promise<string[]> {
    try {
      const response = await this.server.list({
        fieldSelector: [
          {
            key: 'spec.scope',
            operator: '=',
            value: scope,
          },
        ],
      });

      return response.items.map((item) => item.spec.dashboard).filter((dashboardUid) => !!dashboardUid) ?? [];
    } catch (err) {
      return [];
    }
  }

  private async fetchDashboardsDetails(dashboardUids: string[]): Promise<ScopeDashboard[]> {
    try {
      const dashboards = await Promise.all(
        dashboardUids.map((dashboardUid) => this.fetchDashboardDetails(dashboardUid))
      );

      return dashboards.filter((dashboard): dashboard is ScopeDashboard => !!dashboard);
    } catch (err) {
      getAppEvents().publish({
        type: AppEvents.alertError.name,
        payload: ['Failed to fetch suggested dashboards'],
      });

      return [];
    }
  }

  private async fetchDashboardDetails(dashboardUid: string): Promise<ScopeDashboard | undefined> {
    try {
      const dashboard = await getBackendSrv().get(`/api/dashboards/uid/${dashboardUid}`);

      return {
        uid: dashboard.dashboard.uid,
        title: dashboard.dashboard.title,
        url: dashboard.meta.url,
      };
    } catch (err) {
      return undefined;
    }
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
            <Link to={{ pathname: dashboard.url, search: locationService.getLocation().search }}>
              {dashboard.title}
            </Link>
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
