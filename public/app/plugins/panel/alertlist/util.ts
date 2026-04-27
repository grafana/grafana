import { isEmpty } from 'lodash';

import { type DisplayValue, getActiveThreshold, getDisplayProcessor, type GrafanaTheme2, type Labels, type ThresholdsConfig, type ValueMapping } from '@grafana/data';
import { FieldType } from '@grafana/data/dataframe';
import { BigValueColorMode } from '@grafana/ui';
import { labelsMatchMatchers } from 'app/features/alerting/unified/utils/alertmanager';
import { parsePromQLStyleMatcherLooseSafe } from 'app/features/alerting/unified/utils/matchers';
import { createListFilterLink } from 'app/features/alerting/unified/utils/navigation';
import { type Alert, hasAlertState } from 'app/types/unified-alerting';
import { GrafanaAlertState, PromAlertingRuleState } from 'app/types/unified-alerting-dto';

import { type UnifiedAlertListOptions } from './types';

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

export function getStatDisplayValue(
  count: number,
  colorMode: BigValueColorMode,
  thresholds: ThresholdsConfig,
  valueMappings: ValueMapping[],
  theme: GrafanaTheme2
): DisplayValue {
  const display = getDisplayProcessor({
    field: {
      type: FieldType.number,
      config: {
        thresholds,
        mappings: valueMappings,
      },
    },
    theme,
  });

  const displayValue = display(count);

  if (colorMode === BigValueColorMode.None) {
    return { ...displayValue, color: undefined };
  }

  if (!displayValue.color) {
    if (thresholds.steps.length > 0) {
      const activeStep = getActiveThreshold(count, thresholds.steps);
      return { ...displayValue, color: activeStep.color };
    }
    return displayValue;
  }

  return displayValue;
}

export function buildAlertingListUrl(options: UnifiedAlertListOptions, dashboardUid?: string): string {
  const filters: Array<[string, string]> = [];

  if (options.alertName) {
    filters.push(['rule', options.alertName]);
  }
  if (options.datasource) {
    filters.push(['datasource', options.datasource]);
  }

  const { stateFilter } = options;
  if (stateFilter.firing) {
    filters.push(['state', 'firing']);
  }
  if (stateFilter.pending) {
    filters.push(['state', 'pending']);
  }
  if (stateFilter.normal) {
    filters.push(['state', 'inactive']);
  }
  if (stateFilter.noData) {
    filters.push(['state', 'nodata']);
  }
  if (stateFilter.error) {
    filters.push(['state', 'error']);
  }
  if (stateFilter.recovering) {
    filters.push(['state', 'recovering']);
  }

  if (options.folder?.title) {
    filters.push(['namespace', options.folder.title]);
  }

  if (options.alertInstanceLabelFilter) {
    filters.push(['label', options.alertInstanceLabelFilter]);
  }

  if (options.dashboardAlerts && dashboardUid) {
    filters.push(['dashboard', dashboardUid]);
  }

  return createListFilterLink(filters);
}
