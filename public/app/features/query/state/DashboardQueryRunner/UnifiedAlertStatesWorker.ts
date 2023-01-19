import { from, Observable } from 'rxjs';
import { catchError, map } from 'rxjs/operators';

import { AlertState, AlertStateInfo } from '@grafana/data';
import { getBackendSrv } from '@grafana/runtime';
import { contextSrv } from 'app/core/services/context_srv';
import { Annotation } from 'app/features/alerting/unified/utils/constants';
import { isAlertingRule } from 'app/features/alerting/unified/utils/rules';
import { AccessControlAction } from 'app/types';
import { PromAlertingRuleState, PromRulesResponse } from 'app/types/unified-alerting-dto';

import { DashboardQueryRunnerOptions, DashboardQueryRunnerWorker, DashboardQueryRunnerWorkerResult } from './types';
import { emptyResult, handleDashboardQueryRunnerWorkerError } from './utils';

export class UnifiedAlertStatesWorker implements DashboardQueryRunnerWorker {
  // maps dashboard uid to wether it has alert rules.
  // if it is determined that a dashboard does not have alert rules,
  // further attempts to get alert states for it will not be made
  private hasAlertRules: Record<string, boolean> = {};

  canWork({ dashboard, range }: DashboardQueryRunnerOptions): boolean {
    if (!dashboard.uid) {
      return false;
    }

    // Cannot fetch rules while on a public dashboard since it's unauthenticated
    if (dashboard.meta.publicDashboardAccessToken) {
      return false;
    }

    if (range.raw.to !== 'now') {
      return false;
    }

    if (this.hasAlertRules[dashboard.uid] === false) {
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

  work(options: DashboardQueryRunnerOptions): Observable<DashboardQueryRunnerWorkerResult> {
    if (!this.canWork(options)) {
      return emptyResult();
    }

    const { dashboard } = options;
    return from(
      getBackendSrv().get(
        '/api/prometheus/grafana/api/v1/rules',
        {
          dashboard_uid: dashboard.uid,
        },
        `dashboard-query-runner-unified-alert-states-${dashboard.id}`
      )
    ).pipe(
      map((result: PromRulesResponse) => {
        if (result.status === 'success') {
          this.hasAlertRules[dashboard.uid] = false;
          const panelIdToAlertState: Record<number, AlertStateInfo> = {};
          result.data.groups.forEach((group) =>
            group.rules.forEach((rule) => {
              if (isAlertingRule(rule) && rule.annotations && rule.annotations[Annotation.panelID]) {
                this.hasAlertRules[dashboard.uid] = true;
                const panelId = Number(rule.annotations[Annotation.panelID]);
                const state = promAlertStateToAlertState(rule.state);

                // there can be multiple alerts per panel, so we make sure we get the most severe state:
                // alerting > pending > ok
                if (!panelIdToAlertState[panelId]) {
                  panelIdToAlertState[panelId] = {
                    state,
                    id: Object.keys(panelIdToAlertState).length,
                    panelId,
                    dashboardId: dashboard.id,
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
          return { alertStates: Object.values(panelIdToAlertState), annotations: [] };
        }
        throw new Error(`Unexpected alert rules response.`);
      }),
      catchError(handleDashboardQueryRunnerWorkerError)
    );
  }
}

function promAlertStateToAlertState(state: PromAlertingRuleState): AlertState {
  if (state === PromAlertingRuleState.Firing) {
    return AlertState.Alerting;
  } else if (state === PromAlertingRuleState.Pending) {
    return AlertState.Pending;
  }
  return AlertState.OK;
}
