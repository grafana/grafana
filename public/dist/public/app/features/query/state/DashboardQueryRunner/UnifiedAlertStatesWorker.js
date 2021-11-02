import { from } from 'rxjs';
import { getBackendSrv } from '@grafana/runtime';
import { catchError, map } from 'rxjs/operators';
import { emptyResult, handleDashboardQueryRunnerWorkerError } from './utils';
import { PromAlertingRuleState } from 'app/types/unified-alerting-dto';
import { AlertState } from '@grafana/data';
import { isAlertingRule } from 'app/features/alerting/unified/utils/rules';
import { Annotation } from 'app/features/alerting/unified/utils/constants';
var UnifiedAlertStatesWorker = /** @class */ (function () {
    function UnifiedAlertStatesWorker() {
        // maps dashboard uid to wether it has alert rules.
        // if it is determined that a dashboard does not have alert rules,
        // further attempts to get alert states for it will not be made
        this.hasAlertRules = {};
    }
    UnifiedAlertStatesWorker.prototype.canWork = function (_a) {
        var dashboard = _a.dashboard, range = _a.range;
        if (!dashboard.uid) {
            return false;
        }
        if (range.raw.to !== 'now') {
            return false;
        }
        if (this.hasAlertRules[dashboard.uid] === false) {
            return false;
        }
        return true;
    };
    UnifiedAlertStatesWorker.prototype.work = function (options) {
        var _this = this;
        if (!this.canWork(options)) {
            return emptyResult();
        }
        var dashboard = options.dashboard;
        return from(getBackendSrv().get('/api/prometheus/grafana/api/v1/rules', {
            dashboard_uid: dashboard.uid,
        }, "dashboard-query-runner-unified-alert-states-" + dashboard.id)).pipe(map(function (result) {
            if (result.status === 'success') {
                _this.hasAlertRules[dashboard.uid] = false;
                var panelIdToAlertState_1 = {};
                result.data.groups.forEach(function (group) {
                    return group.rules.forEach(function (rule) {
                        if (isAlertingRule(rule) && rule.annotations && rule.annotations[Annotation.panelID]) {
                            _this.hasAlertRules[dashboard.uid] = true;
                            var panelId = Number(rule.annotations[Annotation.panelID]);
                            var state = promAlertStateToAlertState(rule.state);
                            // there can be multiple alerts per panel, so we make sure we get the most severe state:
                            // alerting > pending > ok
                            if (!panelIdToAlertState_1[panelId]) {
                                panelIdToAlertState_1[panelId] = {
                                    state: state,
                                    id: Object.keys(panelIdToAlertState_1).length,
                                    panelId: panelId,
                                    dashboardId: dashboard.id,
                                };
                            }
                            else if (state === AlertState.Alerting &&
                                panelIdToAlertState_1[panelId].state !== AlertState.Alerting) {
                                panelIdToAlertState_1[panelId].state = AlertState.Alerting;
                            }
                            else if (state === AlertState.Pending &&
                                panelIdToAlertState_1[panelId].state !== AlertState.Alerting &&
                                panelIdToAlertState_1[panelId].state !== AlertState.Pending) {
                                panelIdToAlertState_1[panelId].state = AlertState.Pending;
                            }
                        }
                    });
                });
                return { alertStates: Object.values(panelIdToAlertState_1), annotations: [] };
            }
            throw new Error("Unexpected alert rules response.");
        }), catchError(handleDashboardQueryRunnerWorkerError));
    };
    return UnifiedAlertStatesWorker;
}());
export { UnifiedAlertStatesWorker };
function promAlertStateToAlertState(state) {
    if (state === PromAlertingRuleState.Firing) {
        return AlertState.Alerting;
    }
    else if (state === PromAlertingRuleState.Pending) {
        return AlertState.Pending;
    }
    return AlertState.OK;
}
//# sourceMappingURL=UnifiedAlertStatesWorker.js.map