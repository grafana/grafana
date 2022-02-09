import React, { FC, useCallback, useMemo, useState } from 'react';
import pluralize from 'pluralize';
import { Icon, useStyles2 } from '@grafana/ui';
import { Alert } from 'app/types/unified-alerting';
import { GrafanaTheme2, PanelProps } from '@grafana/data';
import { css } from '@emotion/css';
import { GroupMode, UnifiedAlertListOptions } from './types';
import { AlertInstancesTable } from 'app/features/alerting/unified/components/rules/AlertInstancesTable';
import { sortAlerts } from 'app/features/alerting/unified/utils/misc';
import { filterAlerts } from './util';

interface Props {
  alerts: Alert[];
  options: PanelProps<UnifiedAlertListOptions>['options'];
}

export const AlertInstances: FC<Props> = ({ alerts, options }) => {
  // when custom grouping is enabled, we will always uncollapse the list of alert instances
  const defaultShowInstances = options.groupMode === GroupMode.Custom ? true : options.showInstances;
  const [displayInstances, setDisplayInstances] = useState<boolean>(defaultShowInstances);
  const styles = useStyles2(getStyles);

  const toggleDisplayInstances = useCallback(() => {
    setDisplayInstances((display) => !display);
  }, []);

  const filteredAlerts = useMemo(
    (): Alert[] => filterAlerts(options, sortAlerts(options.sortOrder, alerts)) ?? [],
    [alerts, options]
  );

  return (
    <div>
      {options.groupMode === GroupMode.Default && (
        <div className={styles.instance} onClick={() => toggleDisplayInstances()}>
          <Icon name={displayInstances ? 'angle-down' : 'angle-right'} size={'md'} />
          <span>{`${filteredAlerts.length} ${pluralize('instance', filteredAlerts.length)}`}</span>
        </div>
      )}
      {displayInstances && <AlertInstancesTable instances={filteredAlerts} />}
    </div>
  );
};

const getStyles = (_: GrafanaTheme2) => ({
  instance: css`
    cursor: pointer;
  `,
});
