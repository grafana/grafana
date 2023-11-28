import { css } from '@emotion/css';
import { noop } from 'lodash';
import React from 'react';
import { IconButton, InlineFieldRow, InlineLabel, InlineSegmentGroup, useStyles2 } from '@grafana/ui';
export const QueryEditorRow = ({ children, label, onRemoveClick, onHideClick, hidden = false, }) => {
    const styles = useStyles2(getStyles);
    return (React.createElement(InlineFieldRow, null,
        React.createElement(InlineSegmentGroup, null,
            React.createElement(InlineLabel, { width: 17, as: "div" },
                React.createElement("span", null, label),
                React.createElement("span", { className: styles.iconWrapper },
                    onHideClick && (React.createElement(IconButton, { name: hidden ? 'eye-slash' : 'eye', onClick: onHideClick, size: "sm", "aria-pressed": hidden, className: styles.icon, tooltip: "Hide row" })),
                    React.createElement(IconButton, { name: "trash-alt", size: "sm", className: styles.icon, onClick: onRemoveClick || noop, disabled: !onRemoveClick, tooltip: "Remove row" })))),
        children));
};
const getStyles = (theme) => {
    return {
        iconWrapper: css `
      display: flex;
    `,
        icon: css `
      color: ${theme.colors.text.secondary};
      margin-left: ${theme.spacing(0.25)};
    `,
    };
};
//# sourceMappingURL=QueryEditorRow.js.map