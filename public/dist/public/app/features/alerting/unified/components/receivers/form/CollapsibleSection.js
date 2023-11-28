import { css, cx } from '@emotion/css';
import React, { useState } from 'react';
import { useStyles2 } from '@grafana/ui';
import { CollapseToggle } from '../../CollapseToggle';
export const CollapsibleSection = ({ label, description, children, className, size = 'xl', }) => {
    const styles = useStyles2(getStyles);
    const [isCollapsed, setIsCollapsed] = useState(true);
    const toggleCollapse = () => setIsCollapsed(!isCollapsed);
    return (React.createElement("div", { className: cx(styles.wrapper, className) },
        React.createElement(CollapseToggle, { className: styles.toggle, size: size, onToggle: toggleCollapse, isCollapsed: isCollapsed, text: label }),
        description && React.createElement("p", { className: styles.description }, description),
        React.createElement("div", { className: isCollapsed ? styles.hidden : styles.content }, children)));
};
const getStyles = (theme) => ({
    wrapper: css `
    margin-top: ${theme.spacing(1)};
    padding-bottom: ${theme.spacing(1)};
  `,
    toggle: css `
    margin: ${theme.spacing(1, 0)};
    padding: 0;
  `,
    hidden: css `
    display: none;
  `,
    description: css `
    color: ${theme.colors.text.secondary};
    font-size: ${theme.typography.size.sm};
    font-weight: ${theme.typography.fontWeightRegular};
    margin: 0;
  `,
    content: css `
    padding-left: ${theme.spacing(3)};
  `,
});
//# sourceMappingURL=CollapsibleSection.js.map