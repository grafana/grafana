import { debounce, isEqual } from 'lodash';
import { type Unsubscribable } from 'rxjs';

import {
  SceneObjectBase,
  type SceneObjectState,
  SceneObjectStateChangedEvent,
  SceneQueryRunner,
  SceneVariableSet,
  VizPanel,
} from '@grafana/scenes';

import { type DashboardScene } from '../scene/DashboardScene';
import { type DashboardSceneState } from '../scene/types/dashboard';
import { isSceneVariableInstance } from '../settings/variables/utils';
import { collectDashboardQueryPolicyInputs, loadDashboardQueryPolicies } from '../utils/dashboardQueryPolicies';
import { getDashboardSceneFor } from '../utils/utils';

const RECOMPUTE_DEBOUNCE_MS = 250;

/** State keys whose change can add or remove panels, and with them data source references. */
const LAYOUT_KEYS = new Set(['body', 'children', 'rows', 'tabs', 'layout', 'grid']);

/**
 * Keeps `DashboardScene.state.queryPolicies` in sync with the data source instances the dashboard
 * references. Computes on activation and recomputes, debounced, when the variables or the data
 * source references change; a reload is skipped when neither the dashboard UID, the referenced
 * instances nor the variables handed to the hook changed. `queryPoliciesLoading` is set while a load
 * is in flight. Does nothing visible when no referenced data source implements
 * `getDashboardQueryPolicy`.
 */
export class DashboardQueryPoliciesBehavior extends SceneObjectBase<SceneObjectState> {
  private _sub?: Unsubscribable;
  private _generation = 0;
  /** Signature of the inputs the published policies were computed from. */
  private _publishedSignature?: string;

  constructor() {
    super({});
    this.addActivationHandler(() => this._onActivate());
  }

  private _onActivate() {
    const dashboard = getDashboardSceneFor(this);
    const recompute = debounce(() => this._recompute(dashboard), RECOMPUTE_DEBOUNCE_MS);

    this._sub = dashboard.subscribeToEvent(SceneObjectStateChangedEvent, (event) => {
      if (affectsQueryPolicies(dashboard, event)) {
        // Invalidate a load in flight as soon as the change arrives; the debounce only delays the reload.
        this._generation++;
        recompute();
      }
    });

    this._publishedSignature = undefined;
    this._recompute(dashboard);

    return () => {
      recompute.cancel();
      this._sub?.unsubscribe();
      this._sub = undefined;
      // Invalidate any load still in flight so it cannot write to a deactivated dashboard.
      this._generation++;
      setLoading(dashboard, false);
    };
  }

  private async _recompute(dashboard: DashboardScene) {
    const generation = this._generation;

    let inputs;
    let policies;
    try {
      // Collecting can throw too (for example on a variable type the serializer does not know);
      // nothing awaits this method, so the try keeps that a warning rather than an unhandled rejection.
      inputs = await collectDashboardQueryPolicyInputs(dashboard);

      if (inputs.signature === this._publishedSignature) {
        // The published policies already match these inputs; a superseded load may still be in flight.
        setLoading(dashboard, false);
        return;
      }

      setLoading(dashboard, true);
      policies = await loadDashboardQueryPolicies(dashboard, inputs);
    } catch (e) {
      console.warn('Failed to load dashboard query policies', e);
      if (generation === this._generation) {
        setLoading(dashboard, false);
      }
      return;
    }

    if (generation !== this._generation) {
      return;
    }

    this._publishedSignature = inputs.signature;

    const update: Partial<DashboardSceneState> = {};
    if (!isEqual(policies, dashboard.state.queryPolicies)) {
      update.queryPolicies = policies;
    }
    if (dashboard.state.queryPoliciesLoading) {
      update.queryPoliciesLoading = false;
    }
    if (Object.keys(update).length > 0) {
      dashboard.setState(update);
    }
  }
}

function setLoading(dashboard: DashboardScene, loading: boolean) {
  if (Boolean(dashboard.state.queryPoliciesLoading) !== loading) {
    dashboard.setState({ queryPoliciesLoading: loading });
  }
}

export function affectsQueryPolicies(dashboard: DashboardScene, { payload }: SceneObjectStateChangedEvent): boolean {
  const { changedObject, partialUpdate } = payload;
  const keys = Object.keys(partialUpdate);

  if (keys.length === 0) {
    return false;
  }

  if (changedObject === dashboard) {
    return keys.includes('body') || keys.includes('uid');
  }

  if (changedObject instanceof SceneVariableSet) {
    return keys.includes('variables');
  }

  if (isSceneVariableInstance(changedObject)) {
    // Any serialised variable field (filters, baseFilters, ...) may matter to a data source; the
    // signature comparison skips the hook when the serialised variables did not change.
    return true;
  }

  if (changedObject instanceof SceneQueryRunner) {
    return keys.includes('datasource') || keys.includes('queries');
  }

  if (changedObject instanceof VizPanel) {
    return keys.includes('$data');
  }

  return keys.some((key) => LAYOUT_KEYS.has(key));
}
