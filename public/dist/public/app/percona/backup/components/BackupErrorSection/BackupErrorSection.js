import React from 'react';
import { Card, useStyles } from '@grafana/ui';
import { Messages } from './BackupErrorSection.messages';
import { getStyles } from './BackupErrorSection.styles';
export const BackupErrorSection = ({ backupErrors = [] }) => {
    const styles = useStyles(getStyles);
    return (React.createElement(Card, { heading: Messages.problemOcurred, className: styles.apiErrorCard },
        React.createElement(Card.Meta, { separator: "" },
            React.createElement("section", { "data-testid": "backup-errors", className: styles.apiErrorSection }, backupErrors.map((error) => (React.createElement("div", { key: error.message, className: styles.errorLine },
                React.createElement("span", { className: styles.errorText },
                    error.message,
                    " "),
                error.link && (React.createElement("a", { href: error.link, className: styles.readMore, rel: "noreferrer", target: "_blank" }, Messages.readMore)))))))));
};
//# sourceMappingURL=BackupErrorSection.js.map