import { PanelProps } from '@grafana/data';
import { Alert } from 'app/types/unified-alerting';
import { GrafanaAlertState, PromAlertingRuleState } from 'app/types/unified-alerting-dto';
import { isEmpty } from 'lodash';
import { UnifiedAlertListOptions } from './types';

export function filterAlerts(options: PanelProps<UnifiedAlertListOptions>['options'], alerts: Alert[]): Alert[] {
  if (isEmpty(options.stateFilter)) {
    return alerts;
  }

  return alerts.filter((alert) => {
    return (
      (options.stateFilter.firing &&
        (alert.state === GrafanaAlertState.Alerting || alert.state === PromAlertingRuleState.Firing)) ||
      (options.stateFilter.pending &&
        (alert.state === GrafanaAlertState.Pending || alert.state === PromAlertingRuleState.Pending)) ||
      (options.stateFilter.noData && alert.state === GrafanaAlertState.NoData) ||
      (options.stateFilter.normal && alert.state === GrafanaAlertState.Normal) ||
      (options.stateFilter.error && alert.state === GrafanaAlertState.Error) ||
      (options.stateFilter.inactive && alert.state === PromAlertingRuleState.Inactive)
    );
  });
}
