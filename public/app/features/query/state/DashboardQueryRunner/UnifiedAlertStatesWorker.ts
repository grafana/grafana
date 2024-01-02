import { Observable, combineLatest } from 'rxjs';
import { catchError, map } from 'rxjs/operators';

import { AlertState, AlertStateInfo } from '@grafana/data';
import { config, getBackendSrv } from '@grafana/runtime';
import { contextSrv } from 'app/core/services/context_srv';
import {
  getThresholdsForQueries,
  ThresholdDefinition,
  ThresholdDefinitions,
} from 'app/features/alerting/unified/components/rule-editor/util';
import { Annotation } from 'app/features/alerting/unified/utils/constants';
import { isAlertingRule } from 'app/features/alerting/unified/utils/rules';
import { DashboardModel } from 'app/features/dashboard/state';
import { promAlertStateToAlertState } from 'app/features/dashboard-scene/scene/AlertStatesDataLayer';
import { AccessControlAction } from 'app/types';
import {
  PromRuleGroupDTO,
  PromRulesResponse,
  RulerGrafanaRuleDTO,
  RulerRulesConfigDTO,
} from 'app/types/unified-alerting-dto';

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
    const fetchPromRules = getBackendSrv().get<PromRulesResponse>(
      '/api/prometheus/grafana/api/v1/rules',
      {
        dashboard_uid: dashboard.uid,
      },
      `dashboard-query-runner-unified-alert-states-${dashboard.id}`
    );

    const fetchRulerRules = getBackendSrv().get<RulerRulesConfigDTO<RulerGrafanaRuleDTO>>(
      '/api/ruler/grafana/api/v1/rules',
      {
        dashboard_uid: dashboard.uid,
      },
      `dashboard-query-runner-unified-alert-definition-${dashboard.id}`
    );

    // combineLatest will allow partial results depending on which API call resolves first
    return combineLatest([fetchPromRules, fetchRulerRules]).pipe(
      map(([fetchPromRulesResult, fetchRulerRulesResult]) => {
        const result: DashboardQueryRunnerWorkerResult = {
          alertStates: [],
          annotations: [],
        };

        // extract the alert state and annotations from the prometheus rule results
        if (fetchPromRulesResult.status === 'success') {
          const { alertStates, annotations } = this.extractStateAndAnnotations(
            fetchPromRulesResult.data.groups,
            dashboard
          );

          result.alertStates = alertStates;
          result.annotations = annotations;
        }

        // extract the thresholds from the ruler API
        if (fetchRulerRulesResult) {
          result.thresholdsByRefId = this.extractThresholds(fetchRulerRulesResult);
        }

        return result;
      }),
      catchError(handleDashboardQueryRunnerWorkerError)
    );
  }

  // this function will extract the alert state and annotations from linked alert rules
  extractStateAndAnnotations(
    groups: PromRuleGroupDTO[],
    dashboard: DashboardModel
  ): Pick<DashboardQueryRunnerWorkerResult, 'alertStates' | 'annotations'> {
    this.hasAlertRules[dashboard.uid] = false;
    const panelIdToAlertState: Record<number, AlertStateInfo> = {};

    groups.forEach((group) => {
      return group.rules.forEach((rule) => {
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
      });
    });

    return { alertStates: Object.values(panelIdToAlertState), annotations: [] };
  }

  // we'll extract the thresholds from linked alert rules.
  // we will _only_ use the first alert rule definition for this since we don't support merging thresholds from multiple alert rules
  extractThresholds(rulerRules: RulerRulesConfigDTO<RulerGrafanaRuleDTO>): ThresholdDefinitions {
    const firstRule = Object.values(rulerRules).at(0)?.at(0)?.rules.at(0);
    if (!firstRule) {
      return {};
    }

    return getThresholdsForQueries(firstRule.grafana_alert.data);
  }
}
