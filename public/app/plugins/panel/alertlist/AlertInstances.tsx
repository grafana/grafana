import { css } from '@emotion/css';
import { noop } from 'lodash';
import pluralize from 'pluralize';
import React, { FC, useCallback, useEffect, useMemo, useState } from 'react';

import { GrafanaTheme2, PanelProps } from '@grafana/data';
import { Icon, useStyles2 } from '@grafana/ui';
import { AlertInstancesTable } from 'app/features/alerting/unified/components/rules/AlertInstancesTable';
import { sortAlerts } from 'app/features/alerting/unified/utils/misc';
import { Alert } from 'app/types/unified-alerting';

import { DEFAULT_PER_PAGE_PAGINATION } from '../../../core/constants';

import { GroupMode, UnifiedAlertListOptions } from './types';
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

  // TODO Filtering instances here has some implications
  // If a rule has 0 instances after filtering there is no way not to show that rule
  const filteredAlerts = useMemo(
    (): Alert[] => filterAlerts(options, sortAlerts(options.sortOrder, alerts)) ?? [],
    [alerts, options]
  );

  const hiddenInstances = alerts.length - filteredAlerts.length;

  const uncollapsible = filteredAlerts.length > 0;
  const toggleShowInstances = uncollapsible ? toggleDisplayInstances : noop;

  useEffect(() => {
    if (filteredAlerts.length === 0) {
      setDisplayInstances(false);
    }
  }, [filteredAlerts]);

  return (
    <div>
      {options.groupMode === GroupMode.Default && (
        <div className={uncollapsible ? styles.clickable : ''} onClick={() => toggleShowInstances()}>
          {uncollapsible && <Icon name={displayInstances ? 'angle-down' : 'angle-right'} size={'md'} />}
          <span>{`${filteredAlerts.length} ${pluralize('instance', filteredAlerts.length)}`}</span>
          {hiddenInstances > 0 && <span>, {`${hiddenInstances} hidden by filters`}</span>}
        </div>
      )}
      {displayInstances && (
        <AlertInstancesTable
          instances={filteredAlerts}
          pagination={{ itemsPerPage: 2 * DEFAULT_PER_PAGE_PAGINATION }}
        />
      )}
    </div>
  );
};

const getStyles = (_: GrafanaTheme2) => ({
  clickable: css`
    cursor: pointer;
  `,
});
