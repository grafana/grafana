import React from 'react';
import { Icon, useStyles2 } from '@grafana/ui';
import { DATABASE_ICONS } from 'app/percona/shared/core';
import { getStyles } from './ServiceIconWithText.styles';
export const ServiceIconWithText = ({ dbType, text }) => {
    // @ts-ignore
    const icon = DATABASE_ICONS[dbType];
    const styles = useStyles2(getStyles);
    return (React.createElement("div", { className: styles.wrapper },
        !!icon && React.createElement(Icon, { name: icon, "data-testid": "service-icon" }),
        React.createElement("span", null, text)));
};
//# sourceMappingURL=ServiceIconWithText.js.map