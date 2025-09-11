import { css } from '@emotion/css';
import { useMemo } from 'react';

import { GrafanaTheme2, intervalToAbbreviatedDurationString } from '@grafana/data';
import { Trans, t } from '@grafana/i18n';
import { useStyles2 } from '@grafana/ui';
import { AlertmanagerAlert } from 'app/plugins/datasource/alertmanager/types';

import { AlertLabels } from '../AlertLabels';
import { DynamicTableColumnProps, DynamicTableItemProps } from '../DynamicTable';
import { DynamicTableWithGuidelines } from '../DynamicTableWithGuidelines';
import { AmAlertStateTag } from '../silences/AmAlertStateTag';

import { AlertDetails } from './AlertDetails';

interface Props {
  alerts: AlertmanagerAlert[];
  alertManagerSourceName: string;
}

type AlertGroupAlertsTableColumnProps = DynamicTableColumnProps<AlertmanagerAlert>;
type AlertGroupAlertsTableItemProps = DynamicTableItemProps<AlertmanagerAlert>;

export const AlertGroupAlertsTable = ({ alerts, alertManagerSourceName }: Props) => {
  const styles = useStyles2(getStyles);

  const columns = useMemo(
    (): AlertGroupAlertsTableColumnProps[] => [
      {
        id: 'state',
        label: t('alerting.alert-group-alerts-table.columns.label.notification-state', 'Notification state'),

        renderCell: ({ data: alert }) => (
          <>
            <AmAlertStateTag state={alert.status.state} />
            <span className={styles.duration}>
              <Trans
                i18nKey="alerting.alert-group-alerts-table.duration"
                values={{
                  time: intervalToAbbreviatedDurationString({
                    start: new Date(alert.startsAt),
                    end: new Date(alert.endsAt),
                  }),
                }}
              >
                for {'{{time}}'}
              </Trans>
            </span>
          </>
        ),
        size: '220px',
      },
      {
        id: 'labels',
        label: t('alerting.alert-group-alerts-table.columns.label.instance-labels', 'Instance labels'),

        renderCell: ({ data: { labels } }) => <AlertLabels labels={labels} size="sm" />,
        size: 1,
      },
    ],
    [styles]
  );

  const items = useMemo(
    (): AlertGroupAlertsTableItemProps[] =>
      alerts.map((alert) => ({
        id: alert.fingerprint,
        data: alert,
      })),
    [alerts]
  );

  return (
    <div className={styles.tableWrapper} data-testid="alert-group-table">
      <DynamicTableWithGuidelines
        cols={columns}
        items={items}
        isExpandable={true}
        renderExpandedContent={({ data: alert }) => (
          <AlertDetails alert={alert} alertManagerSourceName={alertManagerSourceName} />
        )}
      />
    </div>
  );
};

const getStyles = (theme: GrafanaTheme2) => ({
  tableWrapper: css({
    marginTop: theme.spacing(3),
    [theme.breakpoints.up('md')]: {
      marginLeft: theme.spacing(4.5),
    },
  }),
  duration: css({
    marginLeft: theme.spacing(1),
    fontSize: theme.typography.bodySmall.fontSize,
  }),
});
