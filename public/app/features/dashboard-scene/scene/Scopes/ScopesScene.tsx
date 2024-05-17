import { css, cx } from '@emotion/css';
import React from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { SceneComponentProps, sceneGraph, SceneObjectBase, SceneObjectState } from '@grafana/scenes';
import { IconButton, useStyles2 } from '@grafana/ui';

import { ScopesDashboardsScene } from './ScopesDashboardsScene';
import { ScopesFiltersScene, ScopesFiltersSceneState } from './ScopesFiltersScene';

export interface ScopesSceneState extends SceneObjectState {
  dashboards: ScopesDashboardsScene;
  filters: ScopesFiltersScene;
  advancedFilters: ScopesFiltersScene | undefined;
  isExpanded: boolean;
  isViewing: boolean;
}

export class ScopesScene extends SceneObjectBase<ScopesSceneState> {
  static Component = ScopesSceneRenderer;

  constructor() {
    super({
      dashboards: new ScopesDashboardsScene(),
      filters: new ScopesFiltersScene(),
      advancedFilters: undefined,
      isExpanded: false,
      isViewing: false,
    });

    this.addActivationHandler(() => {
      this.state.filters.fetchBaseNodes();

      const filtersValueSubscription = this.state.filters.subscribeToState((newState, prevState) => {
        if (newState.scopes !== prevState.scopes) {
          this.state.dashboards.fetchDashboards(newState.scopes);
          sceneGraph.getTimeRange(this.parent!).onRefresh();
        }
      });

      const dashboardEditModeSubscription = this.parent?.subscribeToState((newState) => {
        const isEditing = 'isEditing' in newState ? !!newState.isEditing : false;

        if (isEditing !== this.state.isViewing) {
          if (isEditing) {
            this.enterViewMode();
          } else {
            this.exitViewMode();
          }
        }
      });

      return () => {
        filtersValueSubscription.unsubscribe();
        dashboardEditModeSubscription?.unsubscribe();
      };
    });
  }

  public getSelectedScopes() {
    return this.state.filters.state.scopes;
  }

  public toggleIsExpanded() {
    this.setState({ isExpanded: !this.state.isExpanded });
  }

  public openAdvancedSelector() {
    this.state.filters.closeBasicSelector();

    const advancedFilters = this.state.filters.clone();

    advancedFilters.setState({ ...this.state.filters.state, isAdvanced: true });

    this.setState({ advancedFilters });
  }

  public closeAdvancedSelector(newState: ScopesFiltersSceneState | undefined) {
    this.setState({ advancedFilters: undefined });

    if (newState) {
      this.state.filters.setState({
        ...newState,
        isAdvanced: false,
      });
    }
  }

  private enterViewMode() {
    this.setState({ isExpanded: false, isViewing: true });
  }

  private exitViewMode() {
    this.setState({ isViewing: false });
  }
}

export function ScopesSceneRenderer({ model }: SceneComponentProps<ScopesScene>) {
  const { filters, advancedFilters, dashboards, isExpanded, isViewing } = model.useState();
  const styles = useStyles2(getStyles);

  return (
    <div className={cx(styles.container, isExpanded && styles.containerExpanded)}>
      <div className={cx(styles.filtersContainer, isExpanded && styles.filtersContainerExpanded)}>
        {!isViewing && (
          <IconButton
            name="arrow-to-right"
            aria-label={isExpanded ? 'Collapse scope filters' : 'Expand scope filters'}
            className={cx(!isExpanded && styles.iconNotExpanded)}
            data-testid="scopes-scene-toggle-expand-button"
            onClick={() => model.toggleIsExpanded()}
          />
        )}
        <filters.Component model={filters} />
      </div>

      {isExpanded && (
        <div className={styles.dashboardsContainer} data-testid="scopes-scene-dashboards-container">
          <dashboards.Component model={dashboards} />
        </div>
      )}

      {advancedFilters && <advancedFilters.Component model={advancedFilters} />}
    </div>
  );
}

const getStyles = (theme: GrafanaTheme2) => {
  return {
    container: css({
      display: 'flex',
      flexDirection: 'column',
      gridArea: 'scopes',
    }),
    containerExpanded: css({
      backgroundColor: theme.colors.background.primary,
      height: '100%',
    }),
    filtersContainer: css({
      display: 'flex',
      flex: '0 1 auto',
      flexDirection: 'row',
      padding: theme.spacing(2, 2, 2, 2),
    }),
    filtersContainerExpanded: css({
      borderBottom: `1px solid ${theme.colors.border.weak}`,
      padding: theme.spacing(2),
    }),
    iconNotExpanded: css({
      transform: 'scaleX(-1)',
    }),
    dashboardsContainer: css({
      display: 'flex',
      flex: '1 1 auto',
      flexDirection: 'column',
      gap: theme.spacing(3),
      overflow: 'hidden',
      padding: theme.spacing(2),
    }),
  };
};
