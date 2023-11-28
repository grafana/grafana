import { cx } from '@emotion/css';
import React from 'react';
import { Spinner, Tooltip, useStyles2 } from '@grafana/ui';
import { MultipleActions } from 'app/percona/dbaas/components/MultipleActions';
import { ExpandableRowButton } from 'app/percona/shared/components/Elements/ExpandableRowButton/ExpandableRowButton';
import { Messages } from './ExpandAndActionsCol.messages';
import { getStyles } from './ExpandAndActionsCol.styles';
export const ExpandAndActionsCol = ({ row, loading = false, actions = [], className, children, }) => {
    const styles = useStyles2((theme) => getStyles(theme, !children && !actions.length));
    return (React.createElement("div", { className: cx(styles.actionsWrapper, className) }, loading ? (React.createElement(Spinner, null)) : (React.createElement(React.Fragment, null,
        children,
        React.createElement(Tooltip, { content: Messages.details, placement: "top" },
            React.createElement("span", null,
                React.createElement(ExpandableRowButton, { row: row }))),
        !!actions.length && React.createElement(MultipleActions, { actions: actions, dataTestId: "actions" })))));
};
//# sourceMappingURL=ExpandAndActionsCol.js.map