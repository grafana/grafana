import { css } from '@emotion/css';
import React, { useState } from 'react';
import { FlexItem } from '@grafana/experimental';
import { Button, Select, useStyles2 } from '@grafana/ui';
import { OperationInfoButton } from './OperationInfoButton';
export const OperationHeader = React.memo(({ operation, def, index, onChange, onRemove, queryModeller, dragHandleProps }) => {
    var _a;
    const styles = useStyles2(getStyles);
    const [state, setState] = useState({});
    const onToggleSwitcher = () => {
        if (state.isOpen) {
            setState(Object.assign(Object.assign({}, state), { isOpen: false }));
        }
        else {
            const alternatives = queryModeller
                .getAlternativeOperations(def.alternativesKey)
                .map((alt) => ({ label: alt.name, value: alt }));
            setState({ isOpen: true, alternatives });
        }
    };
    return (React.createElement("div", { className: styles.header },
        !state.isOpen && (React.createElement(React.Fragment, null,
            React.createElement("div", Object.assign({}, dragHandleProps), (_a = def.name) !== null && _a !== void 0 ? _a : def.id),
            React.createElement(FlexItem, { grow: 1 }),
            React.createElement("div", { className: `${styles.operationHeaderButtons} operation-header-show-on-hover` },
                React.createElement(Button, { icon: "angle-down", size: "sm", onClick: onToggleSwitcher, fill: "text", variant: "secondary", title: "Click to view alternative operations" }),
                React.createElement(OperationInfoButton, { def: def, operation: operation }),
                React.createElement(Button, { icon: "times", size: "sm", onClick: () => onRemove(index), fill: "text", variant: "secondary", title: "Remove operation" })))),
        state.isOpen && (React.createElement("div", { className: styles.selectWrapper },
            React.createElement(Select, { autoFocus: true, openMenuOnFocus: true, placeholder: "Replace with", options: state.alternatives, isOpen: true, onCloseMenu: onToggleSwitcher, onChange: (value) => {
                    if (value.value) {
                        // Operation should exist if it is selectable
                        const newDef = queryModeller.getOperationDef(value.value.id);
                        // copy default params, and override with all current params
                        const newParams = [...newDef.defaultParams];
                        for (let i = 0; i < Math.min(operation.params.length, newParams.length); i++) {
                            if (newDef.params[i].type === def.params[i].type) {
                                newParams[i] = operation.params[i];
                            }
                        }
                        const changedOp = Object.assign(Object.assign({}, operation), { params: newParams, id: value.value.id });
                        onChange(index, def.changeTypeHandler ? def.changeTypeHandler(changedOp, newDef) : changedOp);
                    }
                } })))));
});
OperationHeader.displayName = 'OperationHeader';
const getStyles = (theme) => {
    return {
        header: css({
            borderBottom: `1px solid ${theme.colors.border.medium}`,
            padding: theme.spacing(0.5, 0.5, 0.5, 1),
            display: 'flex',
            alignItems: 'center',
        }),
        operationHeaderButtons: css({
            opacity: 1,
        }),
        selectWrapper: css({
            paddingRight: theme.spacing(2),
        }),
    };
};
//# sourceMappingURL=OperationHeader.js.map