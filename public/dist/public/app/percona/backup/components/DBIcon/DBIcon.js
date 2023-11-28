import { __rest } from "tslib";
import { cx } from '@emotion/css';
import React from 'react';
import { Tooltip, useStyles } from '@grafana/ui';
import { getStyles } from './DBIcon.styles';
import { Edit, Delete, See, Backup, Cancel, Restore } from './assets';
const Icons = {
    edit: Edit,
    delete: Delete,
    see: See,
    restore: Restore,
    backup: Backup,
    cancel: Cancel,
};
export const DBIcon = (_a) => {
    var { type, size, tooltipText, disabled } = _a, rest = __rest(_a, ["type", "size", "tooltipText", "disabled"]);
    const styles = useStyles(getStyles);
    if (!Icons[type]) {
        return null;
    }
    const Icon = Icons[type];
    const IconEl = (React.createElement("span", { className: cx({ [styles.disabled]: disabled }, styles.iconWrapper) },
        React.createElement(Icon, Object.assign({ size: size }, rest))));
    return tooltipText ? (React.createElement(Tooltip, { "data-testid": "DBIcon-tooltip", placement: "top", content: tooltipText }, IconEl)) : (React.createElement(React.Fragment, null, IconEl));
};
//# sourceMappingURL=DBIcon.js.map