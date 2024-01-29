import { from, map, Unsubscribable, Observable } from 'rxjs';

import { AlertState, AlertStateInfo, DataTopic, LoadingState, toDataFrame } from '@grafana/data';
import { config, getBackendSrv } from '@grafana/runtime';
import {
  SceneDataLayerBase,
  SceneDataLayerProvider,
  SceneDataLayerProviderState,
  sceneGraph,
  SceneTimeRangeLike,
} from '@grafana/scenes';
import { notifyApp } from 'app/core/actions';
import { createErrorNotification } from 'app/core/copy/appNotification';
import { contextSrv } from 'app/core/core';
import { getMessageFromError } from 'app/core/utils/errors';
import { Annotation } from 'app/features/alerting/unified/utils/constants';
import { isAlertingRule } from 'app/features/alerting/unified/utils/rules';
import { dispatch } from 'app/store/store';
import { AccessControlAction } from 'app/types';
import { PromAlertingRuleState, PromRulesResponse } from 'app/types/unified-alerting-dto';

import { getDashboardSceneFor } from '../utils/utils';

interface AlertStatesDataLayerState extends SceneDataLayerProviderState {}

export class AlertStatesDataLayer
  extends SceneDataLayerBase<AlertStatesDataLayerState>
  implements SceneDataLayerProvider
{
  private hasAlertRules = true;
  private _timeRangeSub: Unsubscribable | undefined;
  public topic = DataTopic.AlertStates;

  public constructor(initialState: AlertStatesDataLayerState) {
    super({
      isEnabled: true,
      ...initialState,
      isHidden: true,
    });
  }

  public onEnable(): void {
    const timeRange = sceneGraph.getTimeRange(this);

    this._timeRangeSub = timeRange.subscribeToState(() => {
      this.runWithTimeRange(timeRange);
    });
  }

  public onDisable(): void {
    this._timeRangeSub?.unsubscribe();
  }

  public runLayer() {
    const timeRange = sceneGraph.getTimeRange(this);
    this.runWithTimeRange(timeRange);
  }

  private async runWithTimeRange(timeRange: SceneTimeRangeLike) {
    const dashboard = getDashboardSceneFor(this);
    const { uid, id } = dashboard.state;

    if (this.querySub) {
      this.querySub.unsubscribe();
    }

    if (!this.canWork(timeRange)) {
      return;
    }

    let alerStatesExecution: Observable<AlertStateInfo[]> | undefined;

    if (this.isUsingLegacyAlerting()) {
      alerStatesExecution = from(
        getBackendSrv().get(
          '/api/alerts/states-for-dashboard',
          {
            dashboardId: id,
          },
          `dashboard-query-runner-alert-states-${id}`
        )
      ).pipe(map((alertStates) => alertStates));
    } else {
      alerStatesExecution = from(
        getBackendSrv().get(
          '/api/prometheus/grafana/api/v1/rules',
          {
            dashboard_uid: uid!,
          },
          `dashboard-query-runner-unified-alert-states-${id}`
        )
      ).pipe(
        map((result: PromRulesResponse) => {
          if (result.status === 'success') {
            this.hasAlertRules = false;
            const panelIdToAlertState: Record<number, AlertStateInfo> = {};

            result.data.groups.forEach((group) =>
              group.rules.forEach((rule) => {
                if (isAlertingRule(rule) && rule.annotations && rule.annotations[Annotation.panelID]) {
                  this.hasAlertRules = true;
                  const panelId = Number(rule.annotations[Annotation.panelID]);
                  const state = promAlertStateToAlertState(rule.state);

                  // there can be multiple alerts per panel, so we make sure we get the most severe state:
                  // alerting > pending > ok
                  if (!panelIdToAlertState[panelId]) {
                    panelIdToAlertState[panelId] = {
                      state,
                      id: Object.keys(panelIdToAlertState).length,
                      panelId,
                      dashboardId: id!,
                    };
                  } else if (
                    state === AlertState.Alerting &&
                    panelIdToAlertState[panelId].state !== AlertState.Alerting
                  ) {
                    panelIdToAlertState[panelId].state = AlertState.Alerting;
                  } else if (
                    state === AlertState.Pending &&
                    panelIdToAlertState[panelId].state !== AlertState.Alerting &&
                    panelIdToAlertState[panelId].state !== AlertState.Pending
                  ) {
                    panelIdToAlertState[panelId].state = AlertState.Pending;
                  }
                }
              })
            );
            return Object.values(panelIdToAlertState);
          }

          throw new Error(`Unexpected alert rules response.`);
        })
      );
    }
    this.querySub = alerStatesExecution.subscribe({
      next: (stateUpdate) => {
        this.publishResults(
          {
            state: LoadingState.Done,
            series: [toDataFrame(stateUpdate)],
            timeRange: timeRange.state.value,
          },
          DataTopic.AlertStates
        );
      },
      error: (err) => {
        this.handleError(err);
        this.publishResults(
          {
            state: LoadingState.Error,
            series: [],
            errors: [
              {
                message: getMessageFromError(err),
              },
            ],
            timeRange: timeRange.state.value,
          },
          DataTopic.AlertStates
        );
      },
    });
  }

  private canWork(timeRange: SceneTimeRangeLike): boolean {
    const dashboard = getDashboardSceneFor(this);
    const { uid, id } = dashboard.state;

    if (this.isUsingLegacyAlerting()) {
      if (!id) {
        return false;
      }

      if (timeRange.state.value.raw.to !== 'now') {
        return false;
      }

      return true;
    } else {
      if (!uid) {
        return false;
      }

      // Cannot fetch rules while on a public dashboard since it's unauthenticated
      if (config.publicDashboardAccessToken) {
        return false;
      }

      if (timeRange.state.value.raw.to !== 'now') {
        return false;
      }

      if (this.hasAlertRules === false) {
        return false;
      }

      const hasRuleReadPermission =
        contextSrv.hasPermission(AccessControlAction.AlertingRuleRead) &&
        contextSrv.hasPermission(AccessControlAction.AlertingRuleExternalRead);

      if (!hasRuleReadPermission) {
        return false;
      }

      return true;
    }
  }

  private isUsingLegacyAlerting(): boolean {
    return !config.unifiedAlertingEnabled;
  }

  private handleError = (err: unknown) => {
    const notification = createErrorNotification('AlertStatesDataLayer', getMessageFromError(err));
    dispatch(notifyApp(notification));
  };
}

export function promAlertStateToAlertState(state: PromAlertingRuleState): AlertState {
  if (state === PromAlertingRuleState.Firing) {
    return AlertState.Alerting;
  } else if (state === PromAlertingRuleState.Pending) {
    return AlertState.Pending;
  }
  return AlertState.OK;
}
