import { AlertmanagerAlert } from 'app/plugins/datasource/alertmanager/types';
import React, { FC, useState } from 'react';
import { CollapseToggle } from '../CollapseToggle';
import { ActionIcon } from '../rules/ActionIcon';
import { getAlertTableStyles } from '../../styles/table';
import { useStyles2 } from '@grafana/ui';
import { dateTimeAsMoment, toDuration } from '@grafana/data';
import { AlertLabels } from '../AlertLabels';
import { AmAlertStateTag } from './AmAlertStateTag';

interface Props {
  alert: AlertmanagerAlert;
  className?: string;
}

export const SilencedAlertsTableRow: FC<Props> = ({ alert, className }) => {
  const [isCollapsed, setIsCollapsed] = useState(true);
  const tableStyles = useStyles2(getAlertTableStyles);
  const alertDuration = toDuration(dateTimeAsMoment(alert.endsAt).diff(alert.startsAt)).asSeconds();
  const alertName = Object.entries(alert.labels).reduce((name, [labelKey, labelValue]) => {
    if (labelKey === 'alertname' || labelKey === '__alert_rule_title__') {
      name = labelValue;
    }
    return name;
  }, '');
  return (
    <>
      <tr className={className}>
        <td>
          <CollapseToggle isCollapsed={isCollapsed} onToggle={(collapsed) => setIsCollapsed(collapsed)} />
        </td>
        <td>
          <AmAlertStateTag state={alert.status.state} />
        </td>
        <td>for {alertDuration} seconds</td>
        <td>{alertName}</td>
        <td className={tableStyles.actionsCell}>
          <ActionIcon icon="chart-line" to={alert.generatorURL} tooltip="View in explorer" />
        </td>
      </tr>
      {!isCollapsed && (
        <tr className={className}>
          <td></td>
          <td colSpan={5}>
            <AlertLabels labels={alert.labels} />
          </td>
        </tr>
      )}
    </>
  );
};
