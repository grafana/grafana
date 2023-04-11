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
  handleShowAllInstances?: () => void;
}

export const AlertInstances = ({ alerts, options, grafanaTotalInstances, handleShowAllInstances }: Props) => {
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

  const hiddenInstances = grafanaTotalInstances
    ? grafanaTotalInstances - filteredAlerts.length
    : alerts.length - filteredAlerts.length;

  const uncollapsible = filteredAlerts.length > 0;
  const toggleShowInstances = uncollapsible ? toggleDisplayInstances : noop;

  useEffect(() => {
    if (filteredAlerts.length === 0) {
      setDisplayInstances(false);
    }
  }, [filteredAlerts]);

  const onShowAllClick = async () => {
    if (!handleShowAllInstances) {
      return;
    }
    await handleShowAllInstances();
    setDisplayInstances(true);
  };

  const footerRow =
    hiddenInstances > 0 &&
    grafanaTotalInstances &&
    grafanaTotalInstances > INSTANCES_DISPLAY_LIMIT &&
    filteredAlerts.length <= INSTANCES_DISPLAY_LIMIT ? (
      <div className={styles.footerRow}>
        <div>Limiting the result to {INSTANCES_DISPLAY_LIMIT} instances</div>
        {
          <Button size="sm" variant="secondary" onClick={onShowAllClick}>
            Remove limit
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
          <span>{`${filteredAlerts.length} ${pluralize('instance', filteredAlerts.length)}`}</span>
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
