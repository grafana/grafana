import { css } from '@emotion/css';
import React, { useState } from 'react';
import { useStyles2 } from '@grafana/ui';
import { alertStateToReadable } from '../../utils/rules';
import { CollapseToggle } from '../CollapseToggle';
import { RulesTable } from './RulesTable';
export const RuleListStateSection = ({ rules, state, defaultCollapsed = false }) => {
    const [collapsed, setCollapsed] = useState(defaultCollapsed);
    const styles = useStyles2(getStyles);
    return (React.createElement(React.Fragment, null,
        React.createElement("h4", { className: styles.header },
            React.createElement(CollapseToggle, { className: styles.collapseToggle, size: "xxl", isCollapsed: collapsed, onToggle: () => setCollapsed(!collapsed) }),
            alertStateToReadable(state),
            " (",
            rules.length,
            ")"),
        !collapsed && React.createElement(RulesTable, { className: styles.rulesTable, rules: rules, showGroupColumn: true })));
};
const getStyles = (theme) => ({
    collapseToggle: css `
    vertical-align: middle;
  `,
    header: css `
    margin-top: ${theme.spacing(2)};
  `,
    rulesTable: css `
    margin-top: ${theme.spacing(3)};
  `,
});
//# sourceMappingURL=RuleListStateSection.js.map