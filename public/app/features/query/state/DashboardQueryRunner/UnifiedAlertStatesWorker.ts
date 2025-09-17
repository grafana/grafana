import { Observable, from } from 'rxjs';
import { catchError, map } from 'rxjs/operators';

import { AlertState, AlertStateInfo } from '@grafana/data';
import { config } from '@grafana/runtime';
import { contextSrv } from 'app/core/services/context_srv';
import { alertRuleApi } from 'app/features/alerting/unified/api/alertRuleApi';
import { ungroupRulesByFileName } from 'app/features/alerting/unified/api/prometheus';
import { Annotation } from 'app/features/alerting/unified/utils/constants';
import { GRAFANA_RULES_SOURCE_NAME } from 'app/features/alerting/unified/utils/datasource';
import { prometheusRuleType } from 'app/features/alerting/unified/utils/rules';
import { promAlertStateToAlertState } from 'app/features/dashboard-scene/scene/AlertStatesDataLayer';
import { dispatch } from 'app/store/store';
import { AccessControlAction } from 'app/types/accessControl';
import { RuleNamespace } from 'app/types/unified-alerting';
import { PromRuleGroupDTO } from 'app/types/unified-alerting-dto';

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
    if (config.publicDashboardAccessToken) {
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
    const fetchData: () => Promise<RuleNamespace[]> = async () => {
      const promRules = await dispatch(
        alertRuleApi.endpoints.prometheusRuleNamespaces.initiate(
          {
            ruleSourceName: GRAFANA_RULES_SOURCE_NAME,
            dashboardUid: dashboard.uid,
          },
          { forceRefetch: true }
        )
      );
      return promRules.data;
    };

    const res: Observable<PromRuleGroupDTO[]> = from(fetchData()).pipe(
      map((namespaces: RuleNamespace[]) => ungroupRulesByFileName(namespaces))
    );

    return res.pipe(
      map((groups: PromRuleGroupDTO[]) => {
        this.hasAlertRules[dashboard.uid] = false;
        const panelIdToAlertState: Record<number, AlertStateInfo> = {};
        groups.forEach((group) =>
          group.rules.forEach((rule) => {
            if (prometheusRuleType.alertingRule(rule) && rule.annotations && rule.annotations[Annotation.panelID]) {
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
              } else if (state === AlertState.Alerting && panelIdToAlertState[panelId].state !== AlertState.Alerting) {
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
      }),
      catchError(handleDashboardQueryRunnerWorkerError)
    );
  }
}
