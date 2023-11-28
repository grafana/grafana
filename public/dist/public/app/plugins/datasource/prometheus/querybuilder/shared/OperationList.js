import { css } from '@emotion/css';
import React, { useState } from 'react';
import { DragDropContext, Droppable } from 'react-beautiful-dnd';
import { useMountedState, usePrevious } from 'react-use';
import { Stack } from '@grafana/experimental';
import { Button, Cascader, useStyles2 } from '@grafana/ui';
import { OperationEditor } from './OperationEditor';
export function OperationList({ query, datasource, queryModeller, onChange, onRunQuery, highlightedOp, }) {
    const styles = useStyles2(getStyles);
    const { operations } = query;
    const opsToHighlight = useOperationsHighlight(operations);
    const [cascaderOpen, setCascaderOpen] = useState(false);
    const onOperationChange = (index, update) => {
        const updatedList = [...operations];
        updatedList.splice(index, 1, update);
        onChange(Object.assign(Object.assign({}, query), { operations: updatedList }));
    };
    const onRemove = (index) => {
        const updatedList = [...operations.slice(0, index), ...operations.slice(index + 1)];
        onChange(Object.assign(Object.assign({}, query), { operations: updatedList }));
    };
    const addOptions = queryModeller.getCategories().map((category) => {
        return {
            value: category,
            label: category,
            items: queryModeller.getOperationsForCategory(category).map((operation) => ({
                value: operation.id,
                label: operation.name,
                isLeaf: true,
            })),
        };
    });
    const onAddOperation = (value) => {
        const operationDef = queryModeller.getOperationDef(value);
        if (!operationDef) {
            return;
        }
        onChange(operationDef.addOperationHandler(operationDef, query, queryModeller));
        setCascaderOpen(false);
    };
    const onDragEnd = (result) => {
        if (!result.destination) {
            return;
        }
        const updatedList = [...operations];
        const element = updatedList[result.source.index];
        updatedList.splice(result.source.index, 1);
        updatedList.splice(result.destination.index, 0, element);
        onChange(Object.assign(Object.assign({}, query), { operations: updatedList }));
    };
    const onCascaderBlur = () => {
        setCascaderOpen(false);
    };
    return (React.createElement(Stack, { gap: 1, direction: "column" },
        React.createElement(Stack, { gap: 1 },
            operations.length > 0 && (React.createElement(DragDropContext, { onDragEnd: onDragEnd },
                React.createElement(Droppable, { droppableId: "sortable-field-mappings", direction: "horizontal" }, (provided) => (React.createElement("div", Object.assign({ className: styles.operationList, ref: provided.innerRef }, provided.droppableProps),
                    operations.map((op, index) => {
                        return (React.createElement(OperationEditor, { key: op.id + JSON.stringify(op.params) + index, queryModeller: queryModeller, index: index, operation: op, query: query, datasource: datasource, onChange: onOperationChange, onRemove: onRemove, onRunQuery: onRunQuery, flash: opsToHighlight[index], highlight: highlightedOp === op }));
                    }),
                    provided.placeholder))))),
            React.createElement("div", { className: styles.addButton }, cascaderOpen ? (React.createElement(Cascader, { options: addOptions, onSelect: onAddOperation, onBlur: onCascaderBlur, autoFocus: true, alwaysOpen: true, hideActiveLevelLabel: true, placeholder: 'Search' })) : (React.createElement(Button, { icon: 'plus', variant: 'secondary', onClick: () => setCascaderOpen(true), title: 'Add operation' }, "Operations"))))));
}
/**
 * Returns indexes of operations that should be highlighted. We check the diff of operations added but at the same time
 * we want to highlight operations only after the initial render, so we check for mounted state and calculate the diff
 * only after.
 * @param operations
 */
function useOperationsHighlight(operations) {
    const isMounted = useMountedState();
    const prevOperations = usePrevious(operations);
    if (!isMounted()) {
        return operations.map(() => false);
    }
    if (!prevOperations) {
        return operations.map(() => true);
    }
    let newOps = [];
    if (prevOperations.length - 1 === operations.length && operations.every((op) => prevOperations.includes(op))) {
        // In case we remove one op and does not change any ops then don't highlight anything.
        return operations.map(() => false);
    }
    if (prevOperations.length + 1 === operations.length && prevOperations.every((op) => operations.includes(op))) {
        // If we add a single op just find it and highlight just that.
        const newOp = operations.find((op) => !prevOperations.includes(op));
        newOps = operations.map((op) => {
            return op === newOp;
        });
    }
    else {
        // Default diff of all ops.
        newOps = operations.map((op, index) => {
            var _a;
            return !isSameOp(op.id, (_a = prevOperations[index]) === null || _a === void 0 ? void 0 : _a.id);
        });
    }
    return newOps;
}
function isSameOp(op1, op2) {
    return op1 === op2 || `__${op1}_by` === op2 || op1 === `__${op2}_by`;
}
const getStyles = (theme) => {
    return {
        heading: css({
            label: 'heading',
            fontSize: 12,
            fontWeight: theme.typography.fontWeightMedium,
            marginBottom: 0,
        }),
        operationList: css({
            label: 'operationList',
            display: 'flex',
            flexWrap: 'wrap',
            gap: theme.spacing(2),
        }),
        addButton: css({
            label: 'addButton',
            width: 126,
            paddingBottom: theme.spacing(1),
        }),
    };
};
//# sourceMappingURL=OperationList.js.map