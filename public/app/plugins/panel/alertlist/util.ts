import { isEmpty } from 'lodash';

import { Labels } from '@grafana/data';
import { labelsMatchMatchers } from 'app/features/alerting/unified/utils/alertmanager';
import { parsePromQLStyleMatcherLooseSafe } from 'app/features/alerting/unified/utils/matchers';
import { Alert, hasAlertState } from 'app/types/unified-alerting';
import { GrafanaAlertState, PromAlertingRuleState } from 'app/types/unified-alerting-dto';

import { UnifiedAlertListOptions } from './types';

function hasLabelFilter(alertInstanceLabelFilter: string, labels: Labels) {
  const matchers = parsePromQLStyleMatcherLooseSafe(alertInstanceLabelFilter);
  return labelsMatchMatchers(labels, matchers);
}

export function filterAlerts(
  options: Pick<UnifiedAlertListOptions, 'stateFilter' | 'alertInstanceLabelFilter'>,
  alerts: Alert[]
): Alert[] {
  const { stateFilter, alertInstanceLabelFilter } = options;

  if (isEmpty(stateFilter)) {
    return alerts;
  }

  return alerts.filter((alert) => {
    return (
      ((stateFilter.firing &&
        (hasAlertState(alert, GrafanaAlertState.Alerting) || hasAlertState(alert, PromAlertingRuleState.Firing))) ||
        (stateFilter.pending &&
          (hasAlertState(alert, GrafanaAlertState.Pending) || hasAlertState(alert, PromAlertingRuleState.Pending))) ||
        (stateFilter.recovering &&
          (hasAlertState(alert, GrafanaAlertState.Recovering) ||
            hasAlertState(alert, PromAlertingRuleState.Recovering))) ||
        (stateFilter.noData && hasAlertState(alert, GrafanaAlertState.NoData)) ||
        (stateFilter.normal && hasAlertState(alert, GrafanaAlertState.Normal)) ||
        (stateFilter.error && hasAlertState(alert, GrafanaAlertState.Error)) ||
        (stateFilter.inactive && hasAlertState(alert, PromAlertingRuleState.Inactive))) &&
      (alertInstanceLabelFilter ? hasLabelFilter(options.alertInstanceLabelFilter, alert.labels) : true)
    );
  });
}
