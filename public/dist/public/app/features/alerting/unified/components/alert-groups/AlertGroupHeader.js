import pluralize from 'pluralize';
import React from 'react';
import { useStyles2 } from '@grafana/ui';
import { getNotificationsTextColors } from '../../styles/notifications';
export const AlertGroupHeader = ({ group }) => {
    const textStyles = useStyles2(getNotificationsTextColors);
    const total = group.alerts.length;
    const countByStatus = group.alerts.reduce((statusObj, alert) => {
        if (statusObj[alert.status.state]) {
            statusObj[alert.status.state] += 1;
        }
        else {
            statusObj[alert.status.state] = 1;
        }
        return statusObj;
    }, {});
    return (React.createElement("div", null,
        `${total} ${pluralize('alert', total)}: `,
        Object.entries(countByStatus).map(([state, count], index) => {
            return (React.createElement("span", { key: `${JSON.stringify(group.labels)}-notifications-${index}`, className: textStyles[state] },
                index > 0 && ', ',
                `${count} ${state}`));
        })));
};
//# sourceMappingURL=AlertGroupHeader.js.map