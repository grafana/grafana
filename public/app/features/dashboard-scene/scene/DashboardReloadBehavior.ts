import { isEqual } from 'lodash';

import { BackendSrvRequest } from '@grafana/runtime';
import { sceneGraph, SceneObjectBase, SceneObjectState, VariableDependencyConfig } from '@grafana/scenes';
import { appEvents } from 'app/core/core';
import { getClosestScopesFacade, ScopesFacade } from 'app/features/scopes';
import { ReloadDashboardEvent } from 'app/types/events';

export interface DashboardReloadBehaviorState extends SceneObjectState {
  reloadOnParamsChange?: boolean;
  uid?: string;
}

export class DashboardReloadBehavior extends SceneObjectBase<DashboardReloadBehaviorState> {
  private _scopesFacade: ScopesFacade | null = null;

  constructor({ reloadOnParamsChange, uid }: DashboardReloadBehaviorState) {
    const shouldReload = reloadOnParamsChange && uid;

    super({});

    this.reloadDashboard = this.reloadDashboard.bind(this);

    if (shouldReload) {
      this.addActivationHandler(() => {
        this._scopesFacade = getClosestScopesFacade(this);

        this._variableDependency = new VariableDependencyConfig(this, {
          onAnyVariableChanged: this.reloadDashboard,
        });

        this._scopesFacade?.setState({
          handler: this.reloadDashboard,
        });

        this._subs.add(
          sceneGraph.getTimeRange(this).subscribeToState((newState, prevState) => {
            if (!isEqual(newState.value, prevState.value)) {
              this.reloadDashboard();
            }
          })
        );
      });
    }
  }

  private isEditing() {
    return this.parent && 'isEditing' in this.parent.state && this.parent.state.isEditing;
  }

  private isWaitingForVariables() {
    const varSet = sceneGraph.getVariables(this.parent!);

    return varSet.state.variables.some((variable) => varSet.isVariableLoadingOrWaitingToUpdate(variable));
  }

  private reloadDashboard() {
    if (!this.isEditing() && !this.isWaitingForVariables()) {
      const timeRange = sceneGraph.getTimeRange(this);

      let params: BackendSrvRequest['params'] = {
        scopes: this._scopesFacade?.value.map((scope) => scope.metadata.name),
        ...timeRange.urlSync?.getUrlState(),
      };

      params = sceneGraph.getVariables(this).state.variables.reduce<BackendSrvRequest['params']>(
        (acc, variable) => ({
          ...acc,
          ...variable.urlSync?.getUrlState(),
        }),
        params
      );

      appEvents.publish(new ReloadDashboardEvent(params));
    }
  }
}
