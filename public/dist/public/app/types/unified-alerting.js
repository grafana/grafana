/* Prometheus internal models */
import { mapStateWithReasonToBaseState, } from './unified-alerting-dto';
export function hasAlertState(alert, state) {
    return mapStateWithReasonToBaseState(alert.state) === state;
}
var FiringTotal;
(function (FiringTotal) {
    FiringTotal["Firing"] = "firing";
})(FiringTotal || (FiringTotal = {}));
// export type AlertInstanceState = PromAlertingRuleState | 'nodata' | 'error';
export var AlertInstanceTotalState;
(function (AlertInstanceTotalState) {
    AlertInstanceTotalState["Alerting"] = "alerting";
    AlertInstanceTotalState["Pending"] = "pending";
    AlertInstanceTotalState["Normal"] = "inactive";
    AlertInstanceTotalState["NoData"] = "nodata";
    AlertInstanceTotalState["Error"] = "error";
})(AlertInstanceTotalState || (AlertInstanceTotalState = {}));
//# sourceMappingURL=unified-alerting.js.map