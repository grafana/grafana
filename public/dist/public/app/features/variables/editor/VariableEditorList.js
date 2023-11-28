import { css } from '@emotion/css';
import React from 'react';
import { DragDropContext, Droppable } from 'react-beautiful-dnd';
import { selectors } from '@grafana/e2e-selectors';
import { Stack } from '@grafana/experimental';
import { reportInteraction } from '@grafana/runtime';
import { Button, useStyles2 } from '@grafana/ui';
import EmptyListCTA from 'app/core/components/EmptyListCTA/EmptyListCTA';
import { VariablesDependenciesButton } from '../inspect/VariablesDependenciesButton';
import { VariableEditorListRow } from './VariableEditorListRow';
export function VariableEditorList({ variables, usages, usagesNetwork, onChangeOrder, onAdd, onEdit, onDelete, onDuplicate, }) {
    const styles = useStyles2(getStyles);
    const onDragEnd = (result) => {
        if (!result.destination || !result.source) {
            return;
        }
        reportInteraction('Variable drag and drop');
        const identifier = JSON.parse(result.draggableId);
        onChangeOrder(identifier, variables[result.source.index].index, variables[result.destination.index].index);
    };
    return (React.createElement("div", null,
        React.createElement("div", null,
            variables.length === 0 && React.createElement(EmptyVariablesList, { onAdd: onAdd }),
            variables.length > 0 && (React.createElement(Stack, { direction: "column", gap: 4 },
                React.createElement("div", { className: styles.tableContainer },
                    React.createElement("table", { className: "filter-table filter-table--hover", "aria-label": selectors.pages.Dashboard.Settings.Variables.List.table, role: "grid" },
                        React.createElement("thead", null,
                            React.createElement("tr", null,
                                React.createElement("th", null, "Variable"),
                                React.createElement("th", null, "Definition"),
                                React.createElement("th", { colSpan: 5 }))),
                        React.createElement(DragDropContext, { onDragEnd: onDragEnd },
                            React.createElement(Droppable, { droppableId: "variables-list", direction: "vertical" }, (provided) => (React.createElement("tbody", Object.assign({ ref: provided.innerRef }, provided.droppableProps),
                                variables.map((variable, index) => (React.createElement(VariableEditorListRow, { index: index, key: `${variable.name}-${index}`, variable: variable, usageTree: usages, usagesNetwork: usagesNetwork, onDelete: onDelete, onDuplicate: onDuplicate, onEdit: onEdit }))),
                                provided.placeholder)))))),
                React.createElement(Stack, null,
                    React.createElement(VariablesDependenciesButton, { variables: variables }),
                    React.createElement(Button, { "aria-label": selectors.pages.Dashboard.Settings.Variables.List.newButton, onClick: onAdd, icon: "plus" }, "New variable")))))));
}
function EmptyVariablesList({ onAdd }) {
    return (React.createElement("div", null,
        React.createElement(EmptyListCTA, { title: "There are no variables yet", buttonIcon: "calculator-alt", buttonTitle: "Add variable", infoBox: {
                __html: ` <p>
                    Variables enable more interactive and dynamic dashboards. Instead of hard-coding things like server
                    or sensor names in your metric queries you can use variables in their place. Variables are shown as
                    list boxes at the top of the dashboard. These drop-down lists make it easy to change the data
                    being displayed in your dashboard. Check out the
                    <a class="external-link" href="https://grafana.com/docs/grafana/latest/variables/" target="_blank">
                      Templates and variables documentation
                    </a>
                    for more information.
                  </p>`,
            }, infoBoxTitle: "What do variables do?", onClick: (event) => {
                event.preventDefault();
                onAdd();
            } })));
}
const getStyles = () => ({
    tableContainer: css `
    overflow: scroll;
    width: 100%;
  `,
});
//# sourceMappingURL=VariableEditorList.js.map