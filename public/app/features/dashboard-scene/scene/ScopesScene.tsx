import { css, cx } from '@emotion/css';
import React from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { SceneComponentProps, sceneGraph, SceneObjectBase, SceneObjectState } from '@grafana/scenes';
import { IconButton, useStyles2 } from '@grafana/ui';

import { ScopesDashboardsScene } from './ScopesDashboardsScene';
import { ScopesFiltersScene } from './ScopesFiltersScene';

export interface ScopesSceneState extends SceneObjectState {
  dashboards: ScopesDashboardsScene;
  filters: ScopesFiltersScene;
  isExpanded: boolean;
}

export class ScopesScene extends SceneObjectBase<ScopesSceneState> {
  static Component = ScopesSceneRenderer;

  constructor() {
    super({
      dashboards: new ScopesDashboardsScene(),
      filters: new ScopesFiltersScene(),
      isExpanded: false,
    });

    this.addActivationHandler(() => {
      this.state.filters.fetchScopes();

      const filtersValueSubscription = this.state.filters.subscribeToState((newState, prevState) => {
        if (newState.value !== prevState.value) {
          this.state.dashboards.fetchDashboards(newState.value);
          sceneGraph.getTimeRange(this.parent!).onRefresh();
        }
      });

      return () => {
        filtersValueSubscription.unsubscribe();
      };
    });
  }

  public setIsExpanded(isExpanded: boolean) {
    this.setState({ isExpanded });
  }

  public fetchScopes() {
    this.state.filters.fetchScopes();
  }

  public getSelectedScope() {
    return this.state.filters.getSelectedScope();
  }
}

export function ScopesSceneRenderer({ model }: SceneComponentProps<ScopesScene>) {
  const { filters, dashboards, isExpanded } = model.useState();
  const styles = useStyles2(getStyles);

  return (
    <div className={cx(styles.container, isExpanded && styles.containerExpanded)}>
      <div className={cx(styles.filtersContainer, isExpanded && styles.filtersContainerExpanded)}>
        <IconButton
          name="arrow-to-right"
          aria-label={isExpanded ? 'Collapse scope filters' : 'Expand scope filters'}
          className={cx(!isExpanded && styles.iconNotExpanded)}
          onClick={() => model.setIsExpanded(!isExpanded)}
        />
        <filters.Component model={filters} />
      </div>

      {isExpanded && <dashboards.Component model={dashboards} />}
    </div>
  );
}

const getStyles = (theme: GrafanaTheme2) => {
  return {
    container: css({
      alignItems: 'baseline',
      gap: theme.spacing(1),
      gridArea: 'scopes',
    }),
    containerExpanded: css({
      backgroundColor: theme.colors.background.primary,
    }),
    filtersContainer: css({
      display: 'flex',
      flexDirection: 'row',
      padding: theme.spacing(2, 0, 2, 2),
    }),
    filtersContainerExpanded: css({
      borderBottom: `1px solid ${theme.colors.border.weak}`,
      padding: theme.spacing(2),
    }),
    iconNotExpanded: css({
      transform: 'scaleX(-1)',
    }),
  };
};
