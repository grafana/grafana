import { AlertmanagerAlert } from 'app/plugins/datasource/alertmanager/types';
import React, { useMemo } from 'react';
import { useStyles2 } from '@grafana/ui';
import { GrafanaTheme2, intervalToAbbreviatedDurationString } from '@grafana/data';
import { css } from '@emotion/css';
import { DynamicTableColumnProps, DynamicTableItemProps } from '../DynamicTable';
import { AmAlertStateTag } from '../silences/AmAlertStateTag';
import { AlertLabels } from '../AlertLabels';
import { DynamicTableWithGuidelines } from '../DynamicTableWithGuidelines';
import { AmNotificationsAlertDetails } from './AmNotificationsAlertDetails';

interface Props {
  alerts: AlertmanagerAlert[];
  alertManagerSourceName: string;
}

type AmNotificationsAlertsTableColumnProps = DynamicTableColumnProps<AlertmanagerAlert>;
type AmNotificationsAlertsTableItemProps = DynamicTableItemProps<AlertmanagerAlert>;

export const AmNotificationsAlertsTable = ({ alerts, alertManagerSourceName }: Props) => {
  const styles = useStyles2(getStyles);

  const columns = useMemo(
    (): AmNotificationsAlertsTableColumnProps[] => [
      {
        id: 'state',
        label: 'State',
        // eslint-disable-next-line react/display-name
        renderCell: ({ data: alert }) => (
          <>
            <AmAlertStateTag state={alert.status.state} />
            <span className={styles.duration}>
              for{' '}
              {intervalToAbbreviatedDurationString({
                start: new Date(alert.startsAt),
                end: new Date(alert.endsAt),
              })}
            </span>
          </>
        ),
        size: '190px',
      },
      {
        id: 'labels',
        label: 'Labels',
        // eslint-disable-next-line react/display-name
        renderCell: ({ data: { labels } }) => <AlertLabels className={styles.labels} labels={labels} />,
        size: 1,
      },
    ],
    [styles]
  );

  const items = useMemo(
    (): AmNotificationsAlertsTableItemProps[] =>
      alerts.map((alert) => ({
        id: alert.fingerprint,
        data: alert,
      })),
    [alerts]
  );

  return (
    <div className={styles.tableWrapper} data-testid="notifications-table">
      <DynamicTableWithGuidelines
        cols={columns}
        items={items}
        isExpandable={true}
        renderExpandedContent={({ data: alert }) => (
          <AmNotificationsAlertDetails alert={alert} alertManagerSourceName={alertManagerSourceName} />
        )}
      />
    </div>
  );
};

const getStyles = (theme: GrafanaTheme2) => ({
  tableWrapper: css`
    margin-top: ${theme.spacing(3)};
    ${theme.breakpoints.up('md')} {
      margin-left: ${theme.spacing(4.5)};
    }
  `,
  duration: css`
    margin-left: ${theme.spacing(1)};
    font-size: ${theme.typography.bodySmall.fontSize};
  `,
  labels: css`
    padding-bottom: 0;
  `,
});
