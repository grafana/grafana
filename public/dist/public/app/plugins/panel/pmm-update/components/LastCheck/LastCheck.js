import React from 'react';
import { Button } from '@grafana/ui';
import { Messages } from './LastCheck.messages';
import * as styles from './LastCheck.styles';
export const LastCheck = ({ lastCheckDate, onCheckForUpdates, disabled = false }) => (React.createElement("div", { className: styles.lastCheck },
    React.createElement("p", null,
        Messages.lastCheck,
        React.createElement("span", { "data-testid": "update-last-check" }, lastCheckDate)),
    React.createElement(Button, { "data-testid": "update-last-check-button", fill: "text", size: "sm", onClick: onCheckForUpdates, 
        // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
        icon: 'fa fa-refresh', disabled: disabled })));
//# sourceMappingURL=LastCheck.js.map