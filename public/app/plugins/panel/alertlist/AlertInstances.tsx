import { css, cx } from '@emotion/css';
import { noop } from 'lodash';
import pluralize from 'pluralize';
import React, { useCallback, useEffect, useMemo, useState } from 'react';

import { GrafanaTheme2, PanelProps } from '@grafana/data';
import { Button, clearButtonStyles, Icon, useStyles2 } from '@grafana/ui';
import { AlertInstancesTable } from 'app/features/alerting/unified/components/rules/AlertInstancesTable';
import { INSTANCES_DISPLAY_LIMIT } from 'app/features/alerting/unified/components/rules/RuleDetails';
import { sortAlerts } from 'app/features/alerting/unified/utils/misc';
import { Alert } from 'app/types/unified-alerting';

import { DEFAULT_PER_PAGE_PAGINATION } from '../../../core/constants';

import { GroupMode, UnifiedAlertListOptions } from './types';
import { filterAlerts } from './util';

interface Props {
  alerts: Alert[];
  options: PanelProps<UnifiedAlertListOptions>['options'];
  grafanaTotalInstances?: number;
  grafanaFilteredInstancesTotal?: number;
  handleInstancesLimit?: (limit: boolean) => void;
  limitInstances?: boolean;
}

export const AlertInstances = ({
  alerts,
  options,
  grafanaTotalInstances,
  handleInstancesLimit,
  limitInstances,
  grafanaFilteredInstancesTotal,
}: Props) => {
  // when custom grouping is enabled, we will always uncollapse the list of alert instances
  const defaultShowInstances = options.groupMode === GroupMode.Custom ? true : options.showInstances;
  const [displayInstances, setDisplayInstances] = useState<boolean>(defaultShowInstances);
  const styles = useStyles2(getStyles);
  const clearButton = useStyles2(clearButtonStyles);

  const toggleDisplayInstances = useCallback(() => {
    setDisplayInstances((display) => !display);
  }, []);

  // TODO Filtering instances here has some implications
  // If a rule has 0 instances after filtering there is no way not to show that rule
  const filteredAlerts = useMemo(
    (): Alert[] => filterAlerts(options, sortAlerts(options.sortOrder, alerts)) ?? [],
    [alerts, options]
  );
  const isGrafanaAlert = grafanaTotalInstances !== undefined;

  const hiddenInstancesForGrafanaAlerts =
    grafanaTotalInstances && grafanaFilteredInstancesTotal ? grafanaTotalInstances - grafanaFilteredInstancesTotal : 0;
  const hiddenInstancesForNonGrafanaAlerts = alerts.length - filteredAlerts.length;

  const hiddenInstances = isGrafanaAlert ? hiddenInstancesForGrafanaAlerts : hiddenInstancesForNonGrafanaAlerts;

  const uncollapsible = filteredAlerts.length > 0;
  const toggleShowInstances = uncollapsible ? toggleDisplayInstances : noop;

  useEffect(() => {
    if (filteredAlerts.length === 0) {
      setDisplayInstances(false);
    }
  }, [filteredAlerts]);

  const onShowAllClick = async () => {
    if (!handleInstancesLimit) {
      return;
    }
    handleInstancesLimit(false);
    setDisplayInstances(true);
  };

  const onShowLimitedClick = async () => {
    if (!handleInstancesLimit) {
      return;
    }
    handleInstancesLimit(true);
    setDisplayInstances(true);
  };
  const totalInstancesGrafana = limitInstances ? grafanaFilteredInstancesTotal : filteredAlerts.length;
  const totalInstancesNotGrafana = filteredAlerts.length;
  const totalInstancesNumber = isGrafanaAlert ? totalInstancesGrafana : totalInstancesNotGrafana;

  const limitStatus = limitInstances
    ? `Showing ${INSTANCES_DISPLAY_LIMIT} of ${grafanaTotalInstances} instances`
    : `Showing all ${grafanaTotalInstances} instances`;

  const limitButtonLabel = limitInstances
    ? 'View all instances'
    : `Limit the result to ${INSTANCES_DISPLAY_LIMIT} instances`;

  const instancesLimitedAndOverflowed =
    grafanaTotalInstances &&
    INSTANCES_DISPLAY_LIMIT === filteredAlerts.length &&
    grafanaTotalInstances > filteredAlerts.length;
  const instancesNotLimitedAndoverflowed =
    grafanaTotalInstances && INSTANCES_DISPLAY_LIMIT < filteredAlerts.length && !limitInstances;

  const footerRow =
    instancesLimitedAndOverflowed || instancesNotLimitedAndoverflowed ? (
      <div className={styles.footerRow}>
        <div>{limitStatus}</div>
        {
          <Button size="sm" variant="secondary" onClick={limitInstances ? onShowAllClick : onShowLimitedClick}>
            {limitButtonLabel}
          </Button>
        }
      </div>
    ) : undefined;

  return (
    <div>
      {options.groupMode === GroupMode.Default && (
        <button
          className={cx(clearButton, uncollapsible ? styles.clickable : '')}
          onClick={() => toggleShowInstances()}
        >
          {uncollapsible && <Icon name={displayInstances ? 'angle-down' : 'angle-right'} size={'md'} />}
          <span>{`${totalInstancesNumber} ${pluralize('instance', totalInstancesNumber)}`}</span>
          {hiddenInstances > 0 && <span>, {`${hiddenInstances} hidden by filters`}</span>}
        </button>
      )}
      {displayInstances && (
        <AlertInstancesTable
          instances={filteredAlerts}
          pagination={{ itemsPerPage: 2 * DEFAULT_PER_PAGE_PAGINATION }}
          footerRow={footerRow}
        />
      )}
    </div>
  );
};

const getStyles = (theme: GrafanaTheme2) => ({
  clickable: css`
    cursor: pointer;
  `,
  footerRow: css`
    display: flex;
    flex-direction: column;
    gap: ${theme.spacing(1)};
    justify-content: space-between;
    align-items: center;
    width: 100%;
  `,
});
