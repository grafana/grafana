import { css, cx } from '@emotion/css';
import React from 'react';
import { Stack } from '@grafana/experimental';
import { IconButton, useStyles2 } from '@grafana/ui';
export const QueryOperationRowHeader = ({ actionsElement, disabled, draggable, collapsable = true, dragHandleProps, headerElement, isContentVisible, onRowToggle, reportDragMousePosition, title, id, expanderMessages, }) => {
    const styles = useStyles2(getStyles);
    let tooltipMessage = isContentVisible ? 'Collapse query row' : 'Expand query row';
    if (expanderMessages !== undefined && isContentVisible) {
        tooltipMessage = expanderMessages.close;
    }
    else if (expanderMessages !== undefined) {
        tooltipMessage = expanderMessages === null || expanderMessages === void 0 ? void 0 : expanderMessages.open;
    }
    return (React.createElement("div", { className: styles.header },
        React.createElement("div", { className: styles.column },
            collapsable && (React.createElement(IconButton, { name: isContentVisible ? 'angle-down' : 'angle-right', tooltip: tooltipMessage, className: styles.collapseIcon, onClick: onRowToggle, "aria-expanded": isContentVisible, "aria-controls": id })),
            title && (
            // disabling the a11y rules here as the IconButton above handles keyboard interactions
            // this is just to provide a better experience for mouse users
            // eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions
            React.createElement("div", { className: styles.titleWrapper, onClick: onRowToggle, "aria-label": "Query operation row title" },
                React.createElement("div", { className: cx(styles.title, disabled && styles.disabled) }, title))),
            headerElement),
        React.createElement(Stack, { gap: 1, alignItems: "center", wrap: false },
            actionsElement,
            draggable && (React.createElement(IconButton, Object.assign({ title: "Drag and drop to reorder", name: "draggabledots", tooltip: "Drag and drop to reorder", tooltipPlacement: "bottom", size: "lg", className: styles.dragIcon, onMouseMove: reportDragMousePosition }, dragHandleProps))))));
};
const getStyles = (theme) => ({
    header: css `
    label: Header;
    padding: ${theme.spacing(0.5, 0.5)};
    border-radius: ${theme.shape.radius.default};
    background: ${theme.colors.background.secondary};
    min-height: ${theme.spacing(4)};
    display: grid;
    grid-template-columns: minmax(100px, max-content) min-content;
    align-items: center;
    justify-content: space-between;
    white-space: nowrap;

    &:focus {
      outline: none;
    }
  `,
    column: css `
    label: Column;
    display: flex;
    align-items: center;
  `,
    dragIcon: css `
    cursor: grab;
    color: ${theme.colors.text.disabled};
    margin: ${theme.spacing(0, 0.5)};
    &:hover {
      color: ${theme.colors.text};
    }
  `,
    collapseIcon: css `
    margin-left: ${theme.spacing(0.5)};
    color: ${theme.colors.text.disabled};
    }
  `,
    titleWrapper: css `
    display: flex;
    align-items: center;
    flex-grow: 1;
    cursor: pointer;
    overflow: hidden;
    margin-right: ${theme.spacing(0.5)};
  `,
    title: css `
    font-weight: ${theme.typography.fontWeightBold};
    color: ${theme.colors.text.link};
    margin-left: ${theme.spacing(0.5)};
    overflow: hidden;
    text-overflow: ellipsis;
  `,
    disabled: css `
    color: ${theme.colors.text.disabled};
  `,
});
QueryOperationRowHeader.displayName = 'QueryOperationRowHeader';
//# sourceMappingURL=QueryOperationRowHeader.js.map