import React from 'react';
import { Badge, useStyles2 } from '@grafana/ui';
import { Messages } from '../../AccessRole.messages';
import { getStyles } from './NameCell.styles';
const NameCell = ({ role }) => {
    const styles = useStyles2(getStyles);
    return (React.createElement("div", null,
        React.createElement("span", null, role.title),
        role.isDefault && (React.createElement(Badge, { "data-testid": "role-default-badge", className: styles.button, color: "blue", text: Messages.default.text, tooltip: Messages.default.tooltip }))));
};
export default NameCell;
//# sourceMappingURL=NameCell.js.map