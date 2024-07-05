import { css, cx } from '@emotion/css';
import { Subject, Subscription } from 'rxjs';

import { GrafanaTheme2, Scope } from '@grafana/data';
import { SceneComponentProps, SceneObjectBase, SceneObjectState } from '@grafana/scenes';
import { IconButton, useStyles2 } from '@grafana/ui';
import { t } from 'app/core/internationalization';

import { ScopesDashboardsScene } from './ScopesDashboardsScene';
import { ScopesFiltersScene } from './ScopesFiltersScene';

export interface ScopesSceneState extends SceneObjectState {
  dashboards: ScopesDashboardsScene;
  filters: ScopesFiltersScene;
  isVisible: boolean;
}

export class ScopesScene extends SceneObjectBase<ScopesSceneState> {
  static Component = ScopesSceneRenderer;

  private selectedScopesSubject = new Subject<Scope[]>();

  constructor() {
    const dashboards = new ScopesDashboardsScene();
    const filters = new ScopesFiltersScene();

    super({
      dashboards,
      filters,
      isVisible: false,
    });

    this.addActivationHandler(() => {
      this._subs.add(
        filters.subscribeToState((newState, prevState) => {
          if (!newState.isLoadingScopes && newState.scopes !== prevState.scopes) {
            if (dashboards.state.isVisible) {
              dashboards.fetchDashboards(this.getSelectedScopesNames());
            }

            this.selectedScopesSubject.next(this.getSelectedScopes());
          }
        })
      );
    });
  }

  public show() {
    this.setState({ isVisible: true });
  }

  public hide() {
    this.setState({ isVisible: false });
  }

  public subscribeToSelectedScopes(cb: (scopes: Scope[]) => void): Subscription {
    const sub = this.selectedScopesSubject.subscribe(cb);

    this._subs.add(sub);

    return sub;
  }

  public getSelectedScopes(): Scope[] {
    return this.state.filters.getSelectedScopes();
  }

  public getSelectedScopesNames(): string[] {
    return this.state.filters.getSelectedScopesNames();
  }

  public toggleDashboards() {
    this.state.dashboards.toggle(this.getSelectedScopesNames());
  }

  public enterViewMode() {
    this.state.filters.enterViewMode();
    this.state.dashboards.enterViewMode();
  }

  public exitViewMode() {
    this.state.filters.exitViewMode();
    this.state.dashboards.exitViewMode();
  }
}

export function ScopesSceneRenderer({ model }: SceneComponentProps<ScopesScene>) {
  const styles = useStyles2(getStyles);

  const { dashboards, filters, isVisible } = model.useState();
  const { isVisible: isDashboardsVisible } = dashboards.useState();
  const { isDisabled: isFiltersDisabled } = filters.useState();

  if (!isVisible) {
    return null;
  }

  return (
    <div className={styles.container}>
      {!isFiltersDisabled && (
        <IconButton
          name="arrow-to-right"
          className={cx(!isDashboardsVisible && styles.iconNotExpanded)}
          aria-label={
            isDashboardsVisible
              ? t('scopes.suggestedDashboards.toggle.collapse', 'Collapse scope filters')
              : t('scopes.suggestedDashboards.toggle..expand', 'Expand scope filters')
          }
          data-testid="scopes-dashboards-expand"
          onClick={() => model.toggleDashboards()}
        />
      )}

      <filters.Component model={filters} />
    </div>
  );
}

const getStyles = (theme: GrafanaTheme2) => {
  return {
    container: css({
      display: 'flex',
      padding: theme.spacing(2, 2, 2, 2),
    }),
    iconNotExpanded: css({
      transform: 'scaleX(-1)',
    }),
  };
};
