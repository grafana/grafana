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

export const AlertInstances = ({ alerts, options }: Props) => {
  // when custom grouping is enabled, we will always uncollapse the list of alert instances
  const defaultShowInstances = options.groupMode === GroupMode.Custom ? true : options.showInstances;
  const [displayInstances, setDisplayInstances] = useState<boolean>(defaultShowInstances);

  const toggleDisplayInstances = useCallback(() => {
    setDisplayInstances((display) => !display);
  }, []);

  const filteredAlerts = useMemo((): Alert[] => filterAlerts(options, sortAlerts(options.sortOrder, alerts)) ?? [], [
    alerts,
    options,
  ]);

  return (
    <div>
      {options.groupMode === GroupMode.Default && (
        <UngroupedListHeader
          alertCount={filteredAlerts.length}
          displayInstances={displayInstances}
          toggleDisplayInstances={toggleDisplayInstances}
        />
      )}
      {options.groupMode === GroupMode.Custom && <GroupedListHeader />}
      {displayInstances && <AlertInstancesTable instances={filteredAlerts} />}
    </div>
  );
};

interface UngroupedListHeaderProps {
  alertCount: number;
  displayInstances: boolean;
  toggleDisplayInstances: () => void;
}

const UngroupedListHeader: FC<UngroupedListHeaderProps> = ({
  alertCount,
  displayInstances,
  toggleDisplayInstances,
}) => {
  const styles = useStyles2(getStyles);

  return (
    <div className={styles.instance} onClick={() => toggleDisplayInstances()}>
      <Icon name={displayInstances ? 'angle-down' : 'angle-right'} size={'md'} />
      <span>{`${alertCount} ${pluralize('instance', alertCount)}`}</span>
    </div>
  );
};

const GroupedListHeader: FC<{}> = ({ children }) => {
  const styles = useStyles2(getStyles);
  return <div className={styles.ungroupedHeader}>{children}</div>;
};

const getStyles = (theme: GrafanaTheme2) => ({
  instance: css`
    cursor: pointer;
  `,
  ungroupedHeader: css`
    margin-bottom: ${theme.spacing(1)};
  `,
});
