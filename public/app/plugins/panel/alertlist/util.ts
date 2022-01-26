import { PanelProps } from '@grafana/data';
import { Alert } from 'app/types/unified-alerting';
import { GrafanaAlertState, PromAlertingRuleState } from 'app/types/unified-alerting-dto';
import { isEmpty } from 'lodash';
import { UnifiedAlertListOptions } from './types';

type UnifiedAlertState = GrafanaAlertState | PromAlertingRuleState;

export function filterAlerts(options: PanelProps<UnifiedAlertListOptions>['options'], alerts: Alert[]): Alert[] {
  const { stateFilter } = options;

  if (isEmpty(options.stateFilter)) {
    return alerts;
  }

  const isFiringFilter = (state: UnifiedAlertState) =>
    stateFilter.firing && (state === GrafanaAlertState.Alerting || state === PromAlertingRuleState.Firing);
  const isPendingFilter = (state: UnifiedAlertState) =>
    stateFilter.pending && (state === GrafanaAlertState.Pending || state === PromAlertingRuleState.Pending);
  const isNoDataFilter = (state: UnifiedAlertState) => stateFilter.noData && state === GrafanaAlertState.NoData;
  const isNormalFilter = (state: UnifiedAlertState) => stateFilter.normal && state === GrafanaAlertState.Normal;
  const isErrorFilter = (state: UnifiedAlertState) => stateFilter.error && state === GrafanaAlertState.Error;
  const isInactiveFilter = (state: UnifiedAlertState) =>
    stateFilter.inactive && state === PromAlertingRuleState.Inactive;

  return alerts.filter((alert) => {
    const state = alert.state;

    return (
      isFiringFilter(state) ||
      isPendingFilter(state) ||
      isNoDataFilter(state) ||
      isNormalFilter(state) ||
      isErrorFilter(state) ||
      isInactiveFilter(state)
    );
  });
}
