import { DashboardQueryRunnerOptions, DashboardQueryRunnerWorker, DashboardQueryRunnerWorkerResult } from './types';
import { from, Observable } from 'rxjs';
import { getBackendSrv } from '@grafana/runtime';
import { catchError, map } from 'rxjs/operators';
import { emptyResult, handleDashboardQueryRunnerWorkerError } from './utils';
import { PromAlertingRuleState, PromRulesResponse } from 'app/types/unified-alerting-dto';
import { AlertState, AlertStateInfo } from '@grafana/data';
import { isAlertingRule } from 'app/features/alerting/unified/utils/rules';
import { Annotation } from 'app/features/alerting/unified/utils/constants';

export class UnifiedAlertStatesWorker implements DashboardQueryRunnerWorker {
  canWork({ dashboard, range }: DashboardQueryRunnerOptions): boolean {
    if (!dashboard.uid) {
      return false;
    }

    if (range.raw.to !== 'now') {
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
        {},
        `dashboard-query-runner-unified-alert-states-${dashboard.id}`
      )
    ).pipe(
      map((result: PromRulesResponse) => {
        if (result.status === 'success') {
          const panelIdToAlertState: Record<number, AlertStateInfo> = {};
          result.data.groups.forEach((group) =>
            group.rules.forEach((rule) => {
              if (
                isAlertingRule(rule) &&
                rule.annotations &&
                rule.annotations[Annotation.dashboardUID] === dashboard.uid &&
                rule.annotations[Annotation.panelID]
              ) {
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
