import { css, cx } from '@emotion/css';

import { GrafanaTheme2 } from '@grafana/data';
import { SceneComponentProps, sceneGraph, SceneObjectBase, SceneObjectState } from '@grafana/scenes';
import { IconButton, useStyles2 } from '@grafana/ui';
import { t } from 'app/core/internationalization';

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
      this._subs.add(
        this.state.filters.subscribeToState((newState, prevState) => {
          if (!newState.isLoadingScopes && newState.scopes !== prevState.scopes) {
            if (this.state.isExpanded) {
              this.state.dashboards.fetchDashboards(this.state.filters.getSelectedScopes());
            }

            sceneGraph.getTimeRange(this.parent!).onRefresh();
          }
        })
      );

      this._subs.add(
        this.parent?.subscribeToState((newState) => {
          const isEditing = 'isEditing' in newState ? !!newState.isEditing : false;

          if (isEditing !== this.state.isViewing) {
            if (isEditing) {
              this.enterViewMode();
            } else {
              this.exitViewMode();
            }
          }
        })
      );
    });
  }

  public getSelectedScopes() {
    return this.state.filters.getSelectedScopes();
  }

  public toggleIsExpanded() {
    const isExpanded = !this.state.isExpanded;

    if (isExpanded) {
      this.state.dashboards.fetchDashboards(this.getSelectedScopes());
    }

    this.setState({ isExpanded });
  }

  private enterViewMode() {
    this.setState({ isExpanded: false, isViewing: true });

    this.state.filters.enterViewMode();
  }

  private exitViewMode() {
    this.setState({ isViewing: false });
  }
}

export function ScopesSceneRenderer({ model }: SceneComponentProps<ScopesScene>) {
  const { filters, dashboards, isExpanded, isViewing } = model.useState();
  const styles = useStyles2(getStyles);

  return (
    <div className={cx(styles.container, isExpanded && styles.containerExpanded)}>
      <div className={cx(styles.filtersContainer, isExpanded && styles.filtersContainerExpanded)}>
        {!isViewing && (
          <IconButton
            name="arrow-to-right"
            className={cx(!isExpanded && styles.iconNotExpanded)}
            aria-label={
              isExpanded
                ? t('scopes.suggestedDashboards.toggle.collapse', 'Collapse scope filters')
                : t('scopes.suggestedDashboards.toggle..expand', 'Expand scope filters')
            }
            data-testid="scopes-dashboards-expand"
            onClick={() => model.toggleIsExpanded()}
          />
        )}
        <filters.Component model={filters} />
      </div>

      {isExpanded && !isViewing && (
        <div className={styles.dashboardsContainer} data-testid="scopes-dashboards-container">
          <dashboards.Component model={dashboards} />
        </div>
      )}
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
