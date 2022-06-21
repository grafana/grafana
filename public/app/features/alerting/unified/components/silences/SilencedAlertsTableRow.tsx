import React, { FC, useState } from 'react';

import { intervalToAbbreviatedDurationString } from '@grafana/data';
import { AlertmanagerAlert } from 'app/plugins/datasource/alertmanager/types';

import { AlertLabels } from '../AlertLabels';
import { CollapseToggle } from '../CollapseToggle';

import { AmAlertStateTag } from './AmAlertStateTag';

interface Props {
  alert: AlertmanagerAlert;
  className?: string;
}

export const SilencedAlertsTableRow: FC<Props> = ({ alert, className }) => {
  const [isCollapsed, setIsCollapsed] = useState(true);

  const duration = intervalToAbbreviatedDurationString({
    start: new Date(alert.startsAt),
    end: new Date(alert.endsAt),
  });
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
        <td>for {duration} seconds</td>
        <td>{alertName}</td>
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
