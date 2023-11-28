import { css, cx } from '@emotion/css';
import React, { useState } from 'react';
import { Icon, InlineSegmentGroup, useTheme2 } from '@grafana/ui';
import { segmentStyles } from './styles';
const getStyles = (theme, hidden) => {
    return {
        wrapper: css `
      max-width: 500px;
      display: flex;
      flex-direction: column;
    `,
        settingsWrapper: css `
      padding-top: ${theme.spacing(0.5)};
    `,
        icon: css `
      margin-right: ${theme.spacing(0.5)};
    `,
        button: css `
      justify-content: start;
      ${hidden &&
            css `
        color: ${theme.colors.text.disabled};
      `}
    `,
    };
};
export const SettingsEditorContainer = ({ label, children, hidden = false }) => {
    const [open, setOpen] = useState(false);
    const theme = useTheme2();
    const styles = getStyles(theme, hidden);
    return (React.createElement(InlineSegmentGroup, null,
        React.createElement("div", { className: cx(styles.wrapper) },
            React.createElement("button", { className: cx('gf-form-label query-part', styles.button, segmentStyles), onClick: () => setOpen(!open), "aria-expanded": open, type: "button" },
                React.createElement(Icon, { name: open ? 'angle-down' : 'angle-right', "aria-hidden": "true", className: styles.icon }),
                label),
            open && React.createElement("div", { className: styles.settingsWrapper }, children))));
};
//# sourceMappingURL=SettingsEditorContainer.js.map