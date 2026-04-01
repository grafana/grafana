import { type Subscription } from 'rxjs';

import { sceneGraph, SceneObjectBase, type SceneObjectState } from '@grafana/scenes';

import { DashboardScene } from '../scene/DashboardScene';
import { loadDefaultControlsShared$, loadDefaultLinks$, loadDefaultVariables$ } from '../utils/dashboardControls';
import { getDsRefsFromScene } from '../utils/dashboardDsRefs';

export class DefaultControlsBehavior extends SceneObjectBase<SceneObjectState> {
  private _variablesSub?: Subscription;
  private _linksSub?: Subscription;

  constructor() {
    super({});
    this.addActivationHandler(() => this._onActivate());
  }

  private _onActivate() {
    const dashboard = sceneGraph.getAncestor(this, DashboardScene);
    dashboard.setState({ defaultVariablesLoading: true, defaultLinksLoading: true });

    const refs = getDsRefsFromScene(dashboard);

    if (refs.length === 0) {
      dashboard.setState({ defaultVariablesLoading: false, defaultLinksLoading: false });
      return;
    }

    this._cleanup();

    const shared$ = loadDefaultControlsShared$(refs);

    this._variablesSub = loadDefaultVariables$(shared$).subscribe({
      next: (vars) => dashboard.setDefaultVariables(vars),
      error: (err) => {
        console.warn('Failed to load default variables', err);
        dashboard.setState({ defaultVariablesLoading: false });
      },
      complete: () => dashboard.setState({ defaultVariablesLoading: false }),
    });

    this._linksSub = loadDefaultLinks$(shared$).subscribe({
      next: (links) => dashboard.setDefaultLinks(links),
      error: (err) => {
        console.warn('Failed to load default links', err);
        dashboard.setState({ defaultLinksLoading: false });
      },
      complete: () => dashboard.setState({ defaultLinksLoading: false }),
    });

    return () => {
      this._cleanup();
      dashboard.clearDefaultControls();
    };
  }

  private _cleanup() {
    this._variablesSub?.unsubscribe();
    this._linksSub?.unsubscribe();
    this._variablesSub = undefined;
    this._linksSub = undefined;
  }
}
