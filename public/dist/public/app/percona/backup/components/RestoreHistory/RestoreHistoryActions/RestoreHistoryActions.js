import React from 'react';
import { Tooltip, useStyles2 } from '@grafana/ui';
import { ExpandableRowButton } from 'app/percona/shared/components/Elements/ExpandableRowButton/ExpandableRowButton';
import { Messages } from './RestoreHistoryActions.messages';
import { getStyles } from './RestoreHistoryActions.styles';
export const RestoreHistoryActions = ({ row }) => {
    const styles = useStyles2(getStyles);
    return (React.createElement("div", { className: styles.actionsWrapper },
        React.createElement(Tooltip, { content: Messages.details, placement: "top" },
            React.createElement("span", null,
                React.createElement(ExpandableRowButton, { row: row })))));
};
//# sourceMappingURL=RestoreHistoryActions.js.map