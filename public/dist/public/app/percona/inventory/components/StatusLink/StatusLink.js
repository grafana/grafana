import React from 'react';
import { Link, useStyles2 } from '@grafana/ui';
import { MonitoringStatus } from '../../Inventory.types';
import { getStyles } from './StatusLink.styles';
export const StatusLink = ({ agentsStatus, type, strippedId }) => {
    const link = `/inventory/${type}/${strippedId}/agents`;
    const styles = useStyles2((theme) => getStyles(theme, agentsStatus === MonitoringStatus.OK));
    return (React.createElement(Link, { href: link, className: styles.link }, agentsStatus));
};
//# sourceMappingURL=StatusLink.js.map