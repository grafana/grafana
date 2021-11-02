import React from 'react';
import { getModalStyles } from './getModalStyles';
import { useStyles2 } from '../../themes';
/** @internal */
export var ModalHeader = function (_a) {
    var icon = _a.icon, iconTooltip = _a.iconTooltip, title = _a.title, children = _a.children;
    var styles = useStyles2(getModalStyles);
    return (React.createElement(React.Fragment, null,
        React.createElement("h2", { className: styles.modalHeaderTitle }, title),
        children));
};
//# sourceMappingURL=ModalHeader.js.map