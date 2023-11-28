import React from 'react';
import { HorizontalGroup, Icon, Tooltip } from '@grafana/ui';
import { Messages } from './AccessRoleHeader.messages';
const AccessRoleHeader = () => (React.createElement("th", null,
    React.createElement(HorizontalGroup, null,
        React.createElement("span", { "data-testid": "access-role-header" }, Messages.header),
        React.createElement(Tooltip, { content: Messages.tooltip },
            React.createElement(Icon, { name: "info-circle" })))));
export default AccessRoleHeader;
//# sourceMappingURL=AccessRoleHeader.js.map