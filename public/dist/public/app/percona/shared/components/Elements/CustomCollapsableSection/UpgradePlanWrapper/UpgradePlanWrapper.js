import React from 'react';
import { Button, Icon, useStyles2 } from '@grafana/ui';
import { IsDisabledContext } from '../CustomCollapsableSection.context';
import { getStyles } from './UpgradePlanWrapper.style';
export const UpgradePlanWrapper = ({ label, buttonLabel, buttonOnClick, children }) => {
    const styles = useStyles2(getStyles);
    return (React.createElement("div", { className: styles.wrapper },
        React.createElement("div", { className: styles.header },
            React.createElement("div", { className: styles.headerLabel },
                React.createElement(Icon, { name: "lock" }),
                " ",
                label),
            React.createElement(Button, { variant: "secondary", onClick: buttonOnClick }, buttonLabel)),
        React.createElement("div", { className: styles.children },
            React.createElement(IsDisabledContext.Provider, { value: true }, children))));
};
//# sourceMappingURL=UpgradePlanWrapper.js.map