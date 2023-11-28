import { css, cx } from '@emotion/css';
import React, { useEffect, useId, useState } from 'react';
import { Draggable } from 'react-beautiful-dnd';
import { Stack } from '@grafana/experimental';
import { Button, Icon, InlineField, Tooltip, useTheme2 } from '@grafana/ui';
import { isConflictingFilter } from 'app/plugins/datasource/loki/querybuilder/operationUtils';
import { LokiOperationId } from 'app/plugins/datasource/loki/querybuilder/types';
import { OperationHeader } from './OperationHeader';
import { getOperationParamEditor } from './OperationParamEditor';
import { getOperationParamId } from './operationUtils';
export function OperationEditor({ operation, index, onRemove, onChange, onRunQuery, queryModeller, query, datasource, flash, highlight, }) {
    const def = queryModeller.getOperationDef(operation.id);
    const shouldFlash = useFlash(flash);
    const id = useId();
    const isConflicting = operation.id === LokiOperationId.LabelFilter && isConflictingFilter(operation, query.operations);
    const theme = useTheme2();
    const styles = getStyles(theme, isConflicting);
    if (!def) {
        return React.createElement("span", null,
            "Operation ",
            operation.id,
            " not found");
    }
    const onParamValueChanged = (paramIdx, value) => {
        const update = Object.assign(Object.assign({}, operation), { params: [...operation.params] });
        update.params[paramIdx] = value;
        callParamChangedThenOnChange(def, update, index, paramIdx, onChange);
    };
    const onAddRestParam = () => {
        const update = Object.assign(Object.assign({}, operation), { params: [...operation.params, ''] });
        callParamChangedThenOnChange(def, update, index, operation.params.length, onChange);
    };
    const onRemoveRestParam = (paramIdx) => {
        const update = Object.assign(Object.assign({}, operation), { params: [...operation.params.slice(0, paramIdx), ...operation.params.slice(paramIdx + 1)] });
        callParamChangedThenOnChange(def, update, index, paramIdx, onChange);
    };
    const operationElements = [];
    for (let paramIndex = 0; paramIndex < operation.params.length; paramIndex++) {
        const paramDef = def.params[Math.min(def.params.length - 1, paramIndex)];
        const Editor = getOperationParamEditor(paramDef);
        operationElements.push(React.createElement("div", { className: styles.paramRow, key: `${paramIndex}-1` },
            !paramDef.hideName && (React.createElement("div", { className: styles.paramName },
                React.createElement("label", { htmlFor: getOperationParamId(id, paramIndex) }, paramDef.name),
                paramDef.description && (React.createElement(Tooltip, { placement: "top", content: paramDef.description, theme: "info" },
                    React.createElement(Icon, { name: "info-circle", size: "sm", className: styles.infoIcon }))))),
            React.createElement("div", { className: styles.paramValue },
                React.createElement(Stack, { gap: 0.5, direction: "row", alignItems: "center", wrap: false },
                    React.createElement(Editor, { index: paramIndex, paramDef: paramDef, value: operation.params[paramIndex], operation: operation, operationId: id, onChange: onParamValueChanged, onRunQuery: onRunQuery, query: query, datasource: datasource }),
                    paramDef.restParam && (operation.params.length > def.params.length || paramDef.optional) && (React.createElement(Button, { "data-testid": `operations.${index}.remove-rest-param`, size: "sm", fill: "text", icon: "times", variant: "secondary", title: `Remove ${paramDef.name}`, onClick: () => onRemoveRestParam(paramIndex) }))))));
    }
    // Handle adding button for rest params
    let restParam;
    if (def.params.length > 0) {
        const lastParamDef = def.params[def.params.length - 1];
        if (lastParamDef.restParam) {
            restParam = renderAddRestParamButton(lastParamDef, onAddRestParam, index, operation.params.length, styles);
        }
    }
    const isInvalid = (isDragging) => {
        if (isDragging) {
            return undefined;
        }
        return isConflicting ? true : undefined;
    };
    return (React.createElement(Draggable, { draggableId: `operation-${index}`, index: index }, (provided, snapshot) => (React.createElement(InlineField, { error: 'You have conflicting label filters', invalid: isInvalid(snapshot.isDragging), className: cx(styles.error, styles.cardWrapper) },
        React.createElement("div", Object.assign({ className: cx(styles.card, (shouldFlash || highlight) && styles.cardHighlight, isConflicting && styles.cardError), ref: provided.innerRef }, provided.draggableProps, { "data-testid": `operations.${index}.wrapper` }),
            React.createElement(OperationHeader, { operation: operation, dragHandleProps: provided.dragHandleProps, def: def, index: index, onChange: onChange, onRemove: onRemove, queryModeller: queryModeller }),
            React.createElement("div", { className: styles.body }, operationElements),
            restParam,
            index < query.operations.length - 1 && (React.createElement("div", { className: styles.arrow },
                React.createElement("div", { className: styles.arrowLine }),
                React.createElement("div", { className: styles.arrowArrow }))))))));
}
/**
 * When flash is switched on makes sure it is switched of right away, so we just flash the highlight and then fade
 * out.
 * @param flash
 */
function useFlash(flash) {
    const [keepFlash, setKeepFlash] = useState(true);
    useEffect(() => {
        let t;
        if (flash) {
            t = setTimeout(() => {
                setKeepFlash(false);
            }, 1000);
        }
        else {
            setKeepFlash(true);
        }
        return () => clearTimeout(t);
    }, [flash]);
    return keepFlash && flash;
}
function renderAddRestParamButton(paramDef, onAddRestParam, operationIndex, paramIndex, styles) {
    return (React.createElement("div", { className: styles.restParam, key: `${paramIndex}-2` },
        React.createElement(Button, { size: "sm", icon: "plus", title: `Add ${paramDef.name}`, variant: "secondary", onClick: onAddRestParam, "data-testid": `operations.${operationIndex}.add-rest-param` }, paramDef.name)));
}
function callParamChangedThenOnChange(def, operation, operationIndex, paramIndex, onChange) {
    if (def.paramChangedHandler) {
        onChange(operationIndex, def.paramChangedHandler(paramIndex, operation, def));
    }
    else {
        onChange(operationIndex, operation);
    }
}
const getStyles = (theme, isConflicting) => {
    return {
        cardWrapper: css({
            alignItems: 'stretch',
        }),
        error: css({
            marginBottom: theme.spacing(1),
        }),
        card: css({
            background: theme.colors.background.primary,
            border: `1px solid ${theme.colors.border.medium}`,
            cursor: 'grab',
            borderRadius: theme.shape.radius.default,
            position: 'relative',
            transition: 'all 0.5s ease-in 0s',
            height: isConflicting ? 'auto' : '100%',
        }),
        cardError: css({
            boxShadow: `0px 0px 4px 0px ${theme.colors.warning.main}`,
            border: `1px solid ${theme.colors.warning.main}`,
        }),
        cardHighlight: css({
            boxShadow: `0px 0px 4px 0px ${theme.colors.primary.border}`,
            border: `1px solid ${theme.colors.primary.border}`,
        }),
        infoIcon: css({
            marginLeft: theme.spacing(0.5),
            color: theme.colors.text.secondary,
            ':hover': {
                color: theme.colors.text.primary,
            },
        }),
        body: css({
            margin: theme.spacing(1, 1, 0.5, 1),
            display: 'table',
        }),
        paramRow: css({
            label: 'paramRow',
            display: 'table-row',
            verticalAlign: 'middle',
        }),
        paramName: css({
            display: 'table-cell',
            padding: theme.spacing(0, 1, 0, 0),
            fontSize: theme.typography.bodySmall.fontSize,
            fontWeight: theme.typography.fontWeightMedium,
            verticalAlign: 'middle',
            height: '32px',
        }),
        paramValue: css({
            label: 'paramValue',
            display: 'table-cell',
            verticalAlign: 'middle',
        }),
        restParam: css({
            padding: theme.spacing(0, 1, 1, 1),
        }),
        arrow: css({
            position: 'absolute',
            top: '0',
            right: '-18px',
            display: 'flex',
        }),
        arrowLine: css({
            height: '2px',
            width: '8px',
            backgroundColor: theme.colors.border.strong,
            position: 'relative',
            top: '14px',
        }),
        arrowArrow: css({
            width: 0,
            height: 0,
            borderTop: `5px solid transparent`,
            borderBottom: `5px solid transparent`,
            borderLeft: `7px solid ${theme.colors.border.strong}`,
            position: 'relative',
            top: '10px',
        }),
    };
};
//# sourceMappingURL=OperationEditor.js.map