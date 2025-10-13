import pluralize from 'pluralize';

import { useStyles2 } from '@grafana/ui';
import { AlertState, AlertmanagerGroup } from 'app/plugins/datasource/alertmanager/types';

import { getNotificationsTextColors } from '../../styles/notifications';

interface Props {
  group: AlertmanagerGroup;
}

export const AlertGroupHeader = ({ group }: Props) => {
  const textStyles = useStyles2(getNotificationsTextColors);
  const total = group.alerts.length;
  const countByStatus = group.alerts.reduce(
    (statusObj, alert) => {
      if (statusObj[alert.status.state]) {
        statusObj[alert.status.state] += 1;
      } else {
        statusObj[alert.status.state] = 1;
      }
      return statusObj;
    },
    {} as Record<AlertState, number>
  );

  return (
    <div>
      {`${total} ${pluralize('alert', total)}: `}
      {Object.entries(countByStatus).map(([state, count], index) => {
        return (
          <span
            key={`${JSON.stringify(group.labels)}-notifications-${index}`}
            className={textStyles[state as AlertState]}
          >
            {index > 0 && ', '}
            {`${count} ${state}`}
          </span>
        );
      })}
    </div>
  );
};
