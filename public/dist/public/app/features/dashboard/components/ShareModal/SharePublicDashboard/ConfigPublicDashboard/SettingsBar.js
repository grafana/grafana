import { __rest } from "tslib";
import { css } from '@emotion/css';
import React, { useState } from 'react';
import { useStyles2 } from '@grafana/ui';
import { SettingsBarHeader } from './SettingsBarHeader';
export function SettingsBar(_a) {
    var { children, title, headerElement } = _a, rest = __rest(_a, ["children", "title", "headerElement"]);
    const styles = useStyles2(getStyles);
    const [isContentVisible, setIsContentVisible] = useState(false);
    function onRowToggle() {
        setIsContentVisible((prevState) => !prevState);
    }
    return (React.createElement(React.Fragment, null,
        React.createElement(SettingsBarHeader, Object.assign({ onRowToggle: onRowToggle, isContentVisible: isContentVisible, title: title, headerElement: headerElement }, rest)),
        isContentVisible && React.createElement("div", { className: styles.content }, children)));
}
SettingsBar.displayName = 'SettingsBar';
const getStyles = (theme) => {
    return {
        content: css({
            marginTop: theme.spacing(1),
            marginLeft: theme.spacing(4),
        }),
    };
};
//# sourceMappingURL=SettingsBar.js.map