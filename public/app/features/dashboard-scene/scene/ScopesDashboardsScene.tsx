import { css } from '@emotion/css';
import React from 'react';

import { GrafanaTheme2, ScopeDashboard } from '@grafana/data';
import { SceneComponentProps, SceneObjectBase, SceneObjectState } from '@grafana/scenes';
import { useStyles2 } from '@grafana/ui';

export interface ScopesDashboardsSceneState extends SceneObjectState {
  dashboards: ScopeDashboard[];
  isLoading: boolean;
}

export class ScopesDashboardsScene extends SceneObjectBase<ScopesDashboardsSceneState> {
  static Component = ScopesDashboardsSceneRenderer;

  constructor() {
    super({
      dashboards: [],
      isLoading: false,
    });
  }

  public async fetchDashboards(scope: string | undefined) {
    if (!scope) {
      return this.setState({ dashboards: [], isLoading: false });
    }

    this.setState({ isLoading: true });

    setTimeout(() => {
      this.setState({
        dashboards: [
          {
            uid: '20a5aec7-8381-4c91-94b7-4e8d17c75672',
            title: 'My Dashboard 1',
          },
          {
            uid: 'c677f72a-ab93-4442-b50f-367f4a2849c7',
            title: 'My Dashboard 2',
          },
        ],
        isLoading: false,
      });
    }, 500);
  }
}

export function ScopesDashboardsSceneRenderer({ model }: SceneComponentProps<ScopesDashboardsScene>) {
  const { dashboards, isLoading } = model.useState();
  const styles = useStyles2(getStyles);

  return (
    <div className={styles.container}>
      <pre>{JSON.stringify(dashboards)}</pre>
      <pre>{JSON.stringify(isLoading)}</pre>
    </div>
  );
}

const getStyles = (theme: GrafanaTheme2) => {
  return {
    container: css({
      padding: theme.spacing(2),
    }),
  };
};
