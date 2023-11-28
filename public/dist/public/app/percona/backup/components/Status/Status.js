/* eslint-disable @typescript-eslint/consistent-type-assertions */
import React, { useMemo } from 'react';
import { Tooltip, useTheme2, Icon } from '@grafana/ui';
import { Ellipsis } from 'app/percona/shared/components/Elements/Icons';
import { formatStatus } from '../../Backup.utils';
import { pendingStates, successfulStates } from './Status.constants';
import { Messages } from './Status.messages';
import { getStyles } from './Status.styles';
export const Status = ({ status, showLogsAction = false, onLogClick = () => null }) => {
    const statusMsg = formatStatus(status);
    const theme = useTheme2();
    const styles = getStyles(theme, status);
    const isPending = useMemo(() => pendingStates.includes(status), [status]);
    const backupSucceeded = useMemo(() => successfulStates.includes(status), [status]);
    return (React.createElement("div", { className: styles.statusContainer },
        isPending ? (React.createElement("span", { "data-testid": "statusPending", className: styles.ellipsisContainer },
            React.createElement(Ellipsis, null))) : (React.createElement("span", { "data-testid": "statusMsg", className: styles.statusIcon },
            React.createElement(Tooltip, { placement: "top", content: statusMsg }, backupSucceeded ? (React.createElement(Icon, { name: "check-circle", size: "xl", "data-testid": "success-icon" })) : (React.createElement(Icon, { name: 'times-circle', size: "xl", "data-testid": "fail-icon" }))))),
        showLogsAction && (
        // eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/interactive-supports-focus
        React.createElement("span", { role: "button", className: styles.logs, onClick: onLogClick }, Messages.logs))));
};
//# sourceMappingURL=Status.js.map