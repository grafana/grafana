import { css, cx } from '@emotion/css';
import React from 'react';
import { Link } from 'react-router-dom';
import { useToggle } from 'react-use';
import { Stack } from '@grafana/experimental';
import { Button, Dropdown, Icon, Menu, MenuItem, useStyles2 } from '@grafana/ui';
import { GrafanaReceiversExporter } from '../export/GrafanaReceiversExporter';
export const ReceiversSection = ({ className, title, description, addButtonLabel, addButtonTo, children, showButton = true, canReadSecrets = false, showExport = false, }) => {
    const styles = useStyles2(getStyles);
    const showMore = showExport;
    const [showExportDrawer, toggleShowExportDrawer] = useToggle(false);
    const newMenu = React.createElement(Menu, null, showExport && React.createElement(MenuItem, { onClick: toggleShowExportDrawer, label: "Export all" }));
    return (React.createElement(Stack, { direction: "column", gap: 2 },
        React.createElement("div", { className: cx(styles.heading, className) },
            React.createElement("div", null,
                React.createElement("h4", null, title),
                React.createElement("div", { className: styles.description }, description)),
            React.createElement(Stack, { direction: "row", gap: 0.5 },
                showButton && (React.createElement(Link, { to: addButtonTo },
                    React.createElement(Button, { type: "button", icon: "plus" }, addButtonLabel))),
                showMore && (React.createElement(Dropdown, { overlay: newMenu },
                    React.createElement(Button, { variant: "secondary" },
                        "More",
                        React.createElement(Icon, { name: "angle-down" })))))),
        children,
        showExportDrawer && React.createElement(GrafanaReceiversExporter, { decrypt: canReadSecrets, onClose: toggleShowExportDrawer })));
};
const getStyles = (theme) => ({
    heading: css `
    display: flex;
    justify-content: space-between;
    align-items: flex-end;
  `,
    description: css `
    color: ${theme.colors.text.secondary};
  `,
});
//# sourceMappingURL=ReceiversSection.js.map