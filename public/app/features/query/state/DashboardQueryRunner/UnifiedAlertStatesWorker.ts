import { type Observable, from } from 'rxjs';
import { catchError, map } from 'rxjs/operators';

import { type AlertStateInfo } from '@grafana/data';
import { config } from '@grafana/runtime';
import { contextSrv } from 'app/core/services/context_srv';
import { promAlertStateToAlertState } from 'app/features/dashboard-scene/scene/AlertStatesDataLayer';
import {
  loadPanelAlertStateCandidates,
  selectMostSevereAlertCandidatePerPanel,
} from 'app/features/dashboard-scene/scene/loadPanelAlertStateCandidates';
import { AccessControlAction } from 'app/types/accessControl';

import {
  type DashboardQueryRunnerOptions,
  type DashboardQueryRunnerWorker,
  type DashboardQueryRunnerWorkerResult,
} from './types';
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
    const candidates = from(loadPanelAlertStateCandidates(dashboard.uid));

    return candidates.pipe(
      map((candidates) => {
        this.hasAlertRules[dashboard.uid] = candidates.length > 0;
        const alertStates = selectMostSevereAlertCandidatePerPanel(candidates).map(
          ({ panelId, state }, id): AlertStateInfo => ({
            state: promAlertStateToAlertState(state),
            id,
            panelId,
            dashboardUID: dashboard.uid,
          })
        );

        return { alertStates, annotations: [] };
      }),
      catchError(handleDashboardQueryRunnerWorkerError)
    );
  }
}
