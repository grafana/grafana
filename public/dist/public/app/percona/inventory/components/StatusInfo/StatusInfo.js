import React from 'react';
import { Badge, useStyles2 } from '@grafana/ui';
import { ServiceStatus } from 'app/percona/shared/services/services/Services.types';
import { getBadgeColorForServiceStatus, getBadgeIconForServiceStatus, getBadgeTextForServiceStatus, } from '../../Tabs/Services.utils';
import { Messages } from './StatusInfo.messages';
import { getStyles } from './StatusInfo.styles';
export const StatusInfo = () => {
    const styles = useStyles2(getStyles);
    return (React.createElement(React.Fragment, null, [ServiceStatus.UP, ServiceStatus.DOWN, ServiceStatus.UNKNOWN, ServiceStatus.NA].map((status) => (React.createElement("div", { className: styles.statusLine, key: status },
        React.createElement(Badge, { text: getBadgeTextForServiceStatus(status), color: getBadgeColorForServiceStatus(status), icon: getBadgeIconForServiceStatus(status) }),
        Messages[status])))));
};
//# sourceMappingURL=StatusInfo.js.map