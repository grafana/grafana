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
  isViewing: boolean;
}

export class ScopesScene extends SceneObjectBase<ScopesSceneState> {
  static Component = ScopesSceneRenderer;

  constructor() {
    super({
      dashboards: new ScopesDashboardsScene(),
      filters: new ScopesFiltersScene(),
      isExpanded: false,
      isViewing: false,
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

  public toggleIsExpanded() {
    this.setState({ isExpanded: !this.state.isExpanded });
  }

  public enterViewMode() {
    this.setState({ isViewing: true });
  }

  public exitViewMode() {
    this.setState({ isViewing: false });
  }
}

export function ScopesSceneRenderer({ model }: SceneComponentProps<ScopesScene>) {
  const { filters, dashboards, isExpanded, isViewing } = model.useState();
  const styles = useStyles2(getStyles);

  const isExpandedComputed = isExpanded && !isViewing;

  return (
    <div className={cx(styles.container, isExpandedComputed && styles.containerExpanded)}>
      <div className={cx(styles.filtersContainer, isExpandedComputed && styles.filtersContainerExpanded)}>
        {!isViewing && (
          <IconButton
            name="arrow-to-right"
            aria-label={isExpanded ? 'Collapse scope filters' : 'Expand scope filters'}
            className={cx(!isExpanded && styles.iconNotExpanded)}
            onClick={() => model.toggleIsExpanded()}
          />
        )}
        <filters.Component model={filters} />
      </div>

      {isExpandedComputed && <dashboards.Component model={dashboards} />}
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
