import { css, cx } from '@emotion/css';
import React from 'react';
import { DragDropContext, Draggable, Droppable } from 'react-beautiful-dnd';
import { Icon, IconButton, useStyles2 } from '@grafana/ui';
import { LayerName } from './LayerName';
export const DATA_TEST_ID = 'layer-drag-drop-list';
export const LayerDragDropList = ({ layers, getLayerInfo, onDragEnd, onSelect, onDelete, onDuplicate, showActions, selection, excludeBaseLayer, onNameChange, verifyLayerNameUniqueness, }) => {
    const style = useStyles2(getStyles);
    const getRowStyle = (isSelected) => {
        return isSelected ? `${style.row} ${style.sel}` : style.row;
    };
    return (React.createElement(DragDropContext, { onDragEnd: onDragEnd },
        React.createElement(Droppable, { droppableId: "droppable" }, (provided, snapshot) => (React.createElement("div", Object.assign({}, provided.droppableProps, { ref: provided.innerRef, "data-testid": DATA_TEST_ID }),
            (() => {
                // reverse order
                const rows = [];
                const lastLayerIndex = excludeBaseLayer ? 1 : 0;
                const shouldRenderDragIconLengthThreshold = excludeBaseLayer ? 2 : 1;
                for (let i = layers.length - 1; i >= lastLayerIndex; i--) {
                    const element = layers[i];
                    const uid = element.getName();
                    const isSelected = Boolean(selection === null || selection === void 0 ? void 0 : selection.includes(uid));
                    rows.push(React.createElement(Draggable, { key: uid, draggableId: uid, index: rows.length }, (provided, snapshot) => (React.createElement("div", Object.assign({ className: getRowStyle(isSelected), ref: provided.innerRef }, provided.draggableProps, provided.dragHandleProps, { onMouseDown: () => onSelect(element), role: "button", tabIndex: 0 }),
                        React.createElement(LayerName, { name: uid, onChange: (v) => onNameChange(element, v), verifyLayerNameUniqueness: verifyLayerNameUniqueness !== null && verifyLayerNameUniqueness !== void 0 ? verifyLayerNameUniqueness : undefined }),
                        React.createElement("div", { className: style.textWrapper },
                            "\u00A0 ",
                            getLayerInfo(element)),
                        showActions(element) && (React.createElement(React.Fragment, null,
                            onDuplicate ? (React.createElement(IconButton, { name: "copy", tooltip: "Duplicate", className: style.actionIcon, onClick: () => onDuplicate(element) })) : null,
                            React.createElement(IconButton, { name: "trash-alt", tooltip: "Remove", className: cx(style.actionIcon, style.dragIcon), onClick: () => onDelete(element) }))),
                        layers.length > shouldRenderDragIconLengthThreshold && (React.createElement(Icon, { "aria-label": "Drag and drop icon", title: "Drag and drop to reorder", name: "draggabledots", size: "lg", className: style.dragIcon }))))));
                }
                return rows;
            })(),
            provided.placeholder)))));
};
LayerDragDropList.defaultProps = {
    isGroup: () => false,
};
const getStyles = (theme) => ({
    wrapper: css `
    margin-bottom: ${theme.spacing(2)};
  `,
    row: css `
    padding: ${theme.spacing(0.5, 1)};
    border-radius: ${theme.shape.radius.default};
    background: ${theme.colors.background.secondary};
    min-height: ${theme.spacing(4)};
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 3px;
    cursor: pointer;

    border: 1px solid ${theme.components.input.borderColor};
    &:hover {
      border: 1px solid ${theme.components.input.borderHover};
    }
  `,
    sel: css `
    border: 1px solid ${theme.colors.primary.border};
    &:hover {
      border: 1px solid ${theme.colors.primary.border};
    }
  `,
    dragIcon: css `
    cursor: drag;
  `,
    actionIcon: css `
    color: ${theme.colors.text.secondary};
    &:hover {
      color: ${theme.colors.text};
    }
  `,
    typeWrapper: css `
    color: ${theme.colors.primary.text};
    margin-right: 5px;
  `,
    textWrapper: css `
    display: flex;
    align-items: center;
    flex-grow: 1;
    overflow: hidden;
    margin-right: ${theme.spacing(1)};
  `,
});
//# sourceMappingURL=LayerDragDropList.js.map