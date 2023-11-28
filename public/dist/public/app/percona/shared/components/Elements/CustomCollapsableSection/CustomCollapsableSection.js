import React, { useContext } from 'react';
import { ControlledCollapse, useTheme2 } from '@grafana/ui';
import { IsDisabledContext } from './CustomCollapsableSection.context';
import { getStyles } from './CustomCollapsableSection.styles';
export const CustomCollapsableSection = ({ children, mainLabel, content, sideLabel, isInitOpen, }) => {
    //used to automatically disable collapse when wrapping in UpgradePlanWrapper
    const disabled = useContext(IsDisabledContext);
    const theme = useTheme2();
    const styles = getStyles(theme, disabled);
    return (React.createElement(ControlledCollapse, { label: React.createElement("div", { className: styles.collapsableLabel },
            React.createElement("span", { className: styles.mainLabel }, mainLabel),
            React.createElement("span", { className: styles.label }, content),
            React.createElement("span", { className: styles.label }, sideLabel)), className: styles.collapsableSection, bodyCustomClass: styles.collapsableBody, headerCustomClass: styles.collapsableHeader, headerLabelCustomClass: styles.collapsableHeaderLabel, disabled: disabled, isOpen: isInitOpen }, children));
};
//# sourceMappingURL=CustomCollapsableSection.js.map