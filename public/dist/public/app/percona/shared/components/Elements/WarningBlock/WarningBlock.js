import { cx } from '@emotion/css';
import React from 'react';
import { Icon, useStyles } from '@grafana/ui';
import { getStyles } from './WarningBlock.styles';
const WarningIconMap = {
    info: 'info-circle',
    warning: 'exclamation-triangle',
};
export const WarningBlock = ({ message, className, type = 'info', dataTestId = 'warning-block', }) => {
    const styles = useStyles(getStyles);
    return (React.createElement("div", { className: cx(styles.warningWrapper, className), "data-testid": dataTestId },
        React.createElement(Icon, { className: styles.warningIcon, size: "xl", name: WarningIconMap[type] }),
        React.createElement("span", null, message)));
};
//# sourceMappingURL=WarningBlock.js.map