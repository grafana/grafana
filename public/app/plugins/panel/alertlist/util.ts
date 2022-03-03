import { PanelProps } from '@grafana/data';
import { Alert } from 'app/types/unified-alerting';
import { GrafanaAlertState, PromAlertingRuleState } from 'app/types/unified-alerting-dto';
import { isEmpty } from 'lodash';
import { UnifiedAlertListOptions } from './types';

export function filterAlerts(options: PanelProps<UnifiedAlertListOptions>['options'], alerts: Alert[]): Alert[] {
  const { stateFilter } = options;

  if (isEmpty(stateFilter)) {
    return alerts;
  }

  return alerts.filter((alert) => {
    return (
      (stateFilter.firing &&
        (alert.state === GrafanaAlertState.Alerting || alert.state === PromAlertingRuleState.Firing)) ||
      (stateFilter.pending &&
        (alert.state === GrafanaAlertState.Pending || alert.state === PromAlertingRuleState.Pending)) ||
      (stateFilter.noData && alert.state === GrafanaAlertState.NoData) ||
      (stateFilter.normal && alert.state === GrafanaAlertState.Normal) ||
      (stateFilter.error && alert.state === GrafanaAlertState.Error) ||
      (stateFilter.inactive && alert.state === PromAlertingRuleState.Inactive)
    );
  });
}

export function isPrivateLabel(label: string) {
  return !(label.startsWith('__') && label.endsWith('__'));
}
