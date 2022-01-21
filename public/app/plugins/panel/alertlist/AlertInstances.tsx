import React, { useEffect, useMemo, useState } from 'react';
import pluralize from 'pluralize';
import { Icon, useStyles2 } from '@grafana/ui';
import { Alert, PromRuleWithLocation } from 'app/types/unified-alerting';
import { GrafanaTheme2, PanelProps } from '@grafana/data';
import { css } from '@emotion/css';
import { GrafanaAlertState, PromAlertingRuleState } from 'app/types/unified-alerting-dto';
import { UnifiedAlertListOptions } from './types';
import { AlertInstancesTable } from 'app/features/alerting/unified/components/rules/AlertInstancesTable';
import { sortAlerts } from 'app/features/alerting/unified/utils/misc';

interface Props {
  ruleWithLocation: PromRuleWithLocation;
  options: PanelProps<UnifiedAlertListOptions>['options'];
}

export const AlertInstances = ({ ruleWithLocation, options }: Props) => {
  const { rule } = ruleWithLocation;
  const [displayInstances, setDisplayInstances] = useState<boolean>(options.showInstances);
  const styles = useStyles2(getStyles);

  useEffect(() => {
    setDisplayInstances(options.showInstances);
  }, [options.showInstances]);

  const alerts = useMemo(
    (): Alert[] => (displayInstances ? filterAlerts(options, sortAlerts(options.sortOrder, rule.alerts)) : []),
    [rule, options, displayInstances]
  );

  return (
    <div>
      {rule.state !== PromAlertingRuleState.Inactive && (
        <div className={styles.instance} onClick={() => setDisplayInstances(!displayInstances)}>
          <Icon name={displayInstances ? 'angle-down' : 'angle-right'} size={'md'} />
          <span>{`${rule.alerts.length} ${pluralize('instance', rule.alerts.length)}`}</span>
        </div>
      )}

      {!!alerts.length && <AlertInstancesTable instances={alerts} />}
    </div>
  );
};

function filterAlerts(options: PanelProps<UnifiedAlertListOptions>['options'], alerts: Alert[]): Alert[] {
  const hasAlertState = Object.values(options.stateFilter).some((value) => value);
  let filteredAlerts = [...alerts];
  if (hasAlertState) {
    filteredAlerts = filteredAlerts.filter((alert) => {
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
  return filteredAlerts;
}

const getStyles = (_: GrafanaTheme2) => ({
  instance: css`
    cursor: pointer;
  `,
});
