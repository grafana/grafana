import { __rest } from "tslib";
import React from 'react';
import { Button, useStyles } from '@grafana/ui';
import { getStyles } from './AddClusterButton.styles';
export const AddClusterButton = (_a) => {
    var { label, disabled, action } = _a, props = __rest(_a, ["label", "disabled", "action"]);
    const styles = useStyles(getStyles);
    return (React.createElement("div", { className: styles.addClusterButtonWrapper },
        React.createElement(Button, Object.assign({ role: "button", size: "md", onClick: action, icon: "plus-square", fill: "text", disabled: disabled }, props), label)));
};
//# sourceMappingURL=AddClusterButton.js.map