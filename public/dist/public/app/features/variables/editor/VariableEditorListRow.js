import { css } from '@emotion/css';
import React from 'react';
import { Draggable } from 'react-beautiful-dnd';
import { selectors } from '@grafana/e2e-selectors';
import { reportInteraction } from '@grafana/runtime';
import { Button, Icon, IconButton, useStyles2, useTheme2 } from '@grafana/ui';
import { hasOptions, isAdHoc, isQuery } from '../guard';
import { VariableUsagesButton } from '../inspect/VariableUsagesButton';
import { getVariableUsages } from '../inspect/utils';
import { toKeyedVariableIdentifier } from '../utils';
export function VariableEditorListRow({ index, variable, usageTree, usagesNetwork, onEdit: propsOnEdit, onDuplicate: propsOnDuplicate, onDelete: propsOnDelete, }) {
    const theme = useTheme2();
    const styles = useStyles2(getStyles);
    const definition = getDefinition(variable);
    const usages = getVariableUsages(variable.id, usageTree);
    const passed = usages > 0 || isAdHoc(variable);
    const identifier = toKeyedVariableIdentifier(variable);
    return (React.createElement(Draggable, { draggableId: JSON.stringify(identifier), index: index }, (provided, snapshot) => (React.createElement("tr", Object.assign({ ref: provided.innerRef }, provided.draggableProps, { style: Object.assign({ userSelect: snapshot.isDragging ? 'none' : 'auto', background: snapshot.isDragging ? theme.colors.background.secondary : undefined }, provided.draggableProps.style) }),
        React.createElement("td", { role: "gridcell", className: styles.column },
            React.createElement(Button, { size: "xs", fill: "text", onClick: (event) => {
                    event.preventDefault();
                    propsOnEdit(identifier);
                }, className: styles.nameLink, "aria-label": selectors.pages.Dashboard.Settings.Variables.List.tableRowNameFields(variable.name) }, variable.name)),
        React.createElement("td", { role: "gridcell", className: styles.definitionColumn, onClick: (event) => {
                event.preventDefault();
                propsOnEdit(identifier);
            }, "aria-label": selectors.pages.Dashboard.Settings.Variables.List.tableRowDefinitionFields(variable.name) }, definition),
        React.createElement("td", { role: "gridcell", className: styles.column },
            React.createElement("div", { className: styles.icons },
                React.createElement(VariableCheckIndicator, { passed: passed }),
                React.createElement(VariableUsagesButton, { id: variable.id, isAdhoc: isAdHoc(variable), usages: usagesNetwork }),
                React.createElement(IconButton, { onClick: (event) => {
                        event.preventDefault();
                        reportInteraction('Duplicate variable');
                        propsOnDuplicate(identifier);
                    }, name: "copy", tooltip: "Duplicate variable", "aria-label": selectors.pages.Dashboard.Settings.Variables.List.tableRowDuplicateButtons(variable.name) }),
                React.createElement(IconButton, { onClick: (event) => {
                        event.preventDefault();
                        reportInteraction('Delete variable');
                        propsOnDelete(identifier);
                    }, name: "trash-alt", tooltip: "Remove variable", "aria-label": selectors.pages.Dashboard.Settings.Variables.List.tableRowRemoveButtons(variable.name) }),
                React.createElement("div", Object.assign({}, provided.dragHandleProps, { className: styles.dragHandle }),
                    React.createElement(Icon, { name: "draggabledots", size: "lg" }))))))));
}
function getDefinition(model) {
    let definition = '';
    if (isQuery(model)) {
        if (model.definition) {
            definition = model.definition;
        }
        else if (typeof model.query === 'string') {
            definition = model.query;
        }
    }
    else if (hasOptions(model)) {
        definition = model.query;
    }
    return definition;
}
function VariableCheckIndicator({ passed }) {
    const styles = useStyles2(getStyles);
    if (passed) {
        return (React.createElement(Icon, { name: "check", className: styles.iconPassed, title: "This variable is referenced by other variables or dashboard." }));
    }
    return (React.createElement(Icon, { name: "exclamation-triangle", className: styles.iconFailed, title: "This variable is not referenced by any variable or dashboard." }));
}
function getStyles(theme) {
    return {
        dragHandle: css `
      cursor: grab;
      margin-left: ${theme.spacing(1)};
    `,
        column: css `
      width: 1%;
    `,
        nameLink: css `
      cursor: pointer;
      color: ${theme.colors.primary.text};
    `,
        definitionColumn: css `
      width: 100%;
      max-width: 200px;
      cursor: pointer;
      overflow: hidden;
      text-overflow: ellipsis;
      -o-text-overflow: ellipsis;
      white-space: nowrap;
    `,
        iconPassed: css `
      color: ${theme.v1.palette.greenBase};
      margin-right: ${theme.spacing(2)};
    `,
        iconFailed: css `
      color: ${theme.v1.palette.orange};
      margin-right: ${theme.spacing(2)};
    `,
        icons: css `
      display: flex;
      gap: ${theme.spacing(2)};
      align-items: center;
    `,
    };
}
//# sourceMappingURL=VariableEditorListRow.js.map