import { isEmpty } from 'lodash';
import { labelsMatchMatchers, parseMatchers } from 'app/features/alerting/unified/utils/alertmanager';
import { hasAlertState } from 'app/types/unified-alerting';
import { GrafanaAlertState, PromAlertingRuleState } from 'app/types/unified-alerting-dto';
function hasLabelFilter(alertInstanceLabelFilter, labels) {
    const matchers = parseMatchers(alertInstanceLabelFilter);
    return labelsMatchMatchers(labels, matchers);
}
export function filterAlerts(options, alerts) {
    const { stateFilter, alertInstanceLabelFilter } = options;
    if (isEmpty(stateFilter)) {
        return alerts;
    }
    return alerts.filter((alert) => {
        return (((stateFilter.firing &&
            (hasAlertState(alert, GrafanaAlertState.Alerting) || hasAlertState(alert, PromAlertingRuleState.Firing))) ||
            (stateFilter.pending &&
                (hasAlertState(alert, GrafanaAlertState.Pending) || hasAlertState(alert, PromAlertingRuleState.Pending))) ||
            (stateFilter.noData && hasAlertState(alert, GrafanaAlertState.NoData)) ||
            (stateFilter.normal && hasAlertState(alert, GrafanaAlertState.Normal)) ||
            (stateFilter.error && hasAlertState(alert, GrafanaAlertState.Error)) ||
            (stateFilter.inactive && hasAlertState(alert, PromAlertingRuleState.Inactive))) &&
            (alertInstanceLabelFilter ? hasLabelFilter(options.alertInstanceLabelFilter, alert.labels) : true));
    });
}
export function isPrivateLabel(label) {
    return !(label.startsWith('__') && label.endsWith('__'));
}
//# sourceMappingURL=util.js.map