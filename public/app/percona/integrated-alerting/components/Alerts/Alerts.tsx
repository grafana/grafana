/* eslint-disable react/display-name */
import { cx } from '@emotion/css';
import { format } from 'date-fns';
import React, { FC, useCallback } from 'react';
import { Cell, Column, Row } from 'react-table';

import { Icon, LinkButton, useStyles2 } from '@grafana/ui';
import { Page } from 'app/core/components/Page/Page';
import { useNavModel } from 'app/core/hooks/useNavModel';
import { alertmanagerApi } from 'app/features/alerting/unified/api/alertmanagerApi';
import { AmAlertStateTag } from 'app/features/alerting/unified/components/silences/AmAlertStateTag';
import { makeLabelBasedSilenceLink } from 'app/features/alerting/unified/utils/misc';
import { ExpandableCell } from 'app/percona/shared/components/Elements/ExpandableCell';
import { FeatureLoader } from 'app/percona/shared/components/Elements/FeatureLoader';
import { getPerconaSettingFlag } from 'app/percona/shared/core/selectors';
import { AlertmanagerAlert, AlertState } from 'app/plugins/datasource/alertmanager/types';

import { Table } from '../../../shared/components/Elements/Table/Table';
import { Messages } from '../../IntegratedAlerting.messages';
import { Severity } from '../Severity';

import { AlertDetails } from './AlertDetails/AlertDetails';
import { ACTIONS_COLUMN, DATA_INTERVAL, SILENCES_URL } from './Alerts.constants';
import { Messages as AlertMessages } from './Alerts.messages';
import { getStyles } from './Alerts.styles';

const {
  table: { columns },
} = Messages.alerts;
const {
  activeSince: activeSinceColumn,
  lastNotified: lastNotifiedColumn,
  severity: severityColumn,
  state: stateColumn,
  actions: actionsColumn,
  triggered,
} = columns;

export const Alerts: FC = () => {
  const style = useStyles2(getStyles);
  const navModel = useNavModel('integrated-alerting-alerts');
  const { data: alertManagerAlerts = [], isLoading: amAlertsIsLoading } =
    alertmanagerApi.endpoints.getAlertmanagerAlerts.useQuery(
      { amSourceName: 'grafana', filter: { silenced: true, active: true, inhibited: true } },
      { pollingInterval: DATA_INTERVAL }
    );

  const columns = React.useMemo(
    (): Array<Column<AlertmanagerAlert>> => [
      {
        Header: triggered,
        accessor: 'labels',
        id: 'triggeredBy',
        Cell: ({ value: { __alert_rule_uid__, rulename, alertname } }) => (
          <a
            className={style.ruleLink}
            href={`/alerting/grafana/${__alert_rule_uid__}/view?returnTo=%2Falerting%2Falerts`}
          >
            {rulename ?? alertname}
          </a>
        ),
      },
      {
        Header: stateColumn,
        accessor: 'status',
        width: '5%',
        Cell: ({ value }) => <AmAlertStateTag state={value.state} silenced={AlertMessages.silenced} />,
      },
      {
        Header: 'Summary',
        accessor: 'annotations',
        Cell: ({ value: { summary } }) => <>{summary || ''}</>,
        width: '30%',
      },
      {
        Header: severityColumn,
        accessor: 'labels',
        id: 'severity',
        Cell: ({ row, value: { severity } }) =>
          severity ? (
            <Severity
              severity={`${severity[0].toUpperCase()}${severity.substring(1)}`}
              className={cx({ [style.silencedSeverity]: row.original.status.state === AlertState.Suppressed })}
            />
          ) : null,
        width: '5%',
      },
      {
        Header: activeSinceColumn,
        accessor: 'startsAt',
        Cell: ({ value }) => <>{value ? format(new Date(value), 'yyyy-MM-dd HH:mm:ss') : null}</>,
        width: '10%',
      },
      {
        Header: lastNotifiedColumn,
        accessor: 'updatedAt',
        Cell: ({ value }) => <>{value ? format(new Date(value), 'yyyy-MM-dd HH:mm:ss') : null}</>,
        width: '10%',
      },
      {
        Header: actionsColumn,
        accessor: 'receivers',
        id: ACTIONS_COLUMN,
        width: '15%',
        Cell: ({ row }) => (
          <ExpandableCell
            row={row}
            value={
              <LinkButton
                href={
                  row.original.status.state === AlertState.Suppressed
                    ? SILENCES_URL
                    : makeLabelBasedSilenceLink('grafana', row.original.labels)
                }
                icon={'bell-slash'}
                size={'sm'}
              >
                {row.original.status.state === AlertState.Suppressed ? AlertMessages.unsilence : AlertMessages.silence}
              </LinkButton>
            }
          ></ExpandableCell>
        ),
      },
    ],
    [style.ruleLink, style.silencedSeverity]
  );

  const getCellProps = useCallback(
    (cell: Cell<AlertmanagerAlert>) => {
      let className = '';
      if (cell.row.original.status.state === AlertState.Suppressed) {
        if (cell.column.id === ACTIONS_COLUMN) {
          className = style.disableActionCell;
        } else {
          className = style.disabledRow;
        }
      }
      return {
        className,
        key: cell.row.original.labels.__alert_rule_uid__,
      };
    },
    [style.disableActionCell, style.disabledRow]
  );

  const renderSelectedSubRow = React.useCallback(
    (row: Row<AlertmanagerAlert>) => <AlertDetails labels={row.original.labels} />,
    []
  );

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const featureSelector = useCallback(getPerconaSettingFlag('alertingEnabled'), []);

  return (
    <Page navModel={navModel}>
      <Page.Contents>
        <FeatureLoader featureName={Messages.alerting} featureSelector={featureSelector}>
          <Table
            totalItems={alertManagerAlerts.length}
            data={alertManagerAlerts || []}
            columns={columns}
            pendingRequest={amAlertsIsLoading}
            autoResetExpanded={false}
            emptyMessage={
              <h1>
                <Icon name="check-circle" size="xxl" /> No alerts detected
              </h1>
            }
            getCellProps={getCellProps}
            renderExpandedRow={renderSelectedSubRow}
          />
        </FeatureLoader>
      </Page.Contents>
    </Page>
  );
};

export default Alerts;
