import { __makeTemplateObject, __read } from "tslib";
import React, { useState } from 'react';
import { HorizontalGroup, InlineLabel, useStyles2 } from '@grafana/ui';
import { css, cx } from '@emotion/css';
import { FunctionParamEditor } from './FunctionParamEditor';
import { actions } from '../state/actions';
import { FunctionEditor } from './FunctionEditor';
import { mapFuncInstanceToParams } from './helpers';
import { useDispatch } from '../state/context';
/**
 * Allows editing function params and removing/moving a function (note: editing function name is not supported)
 */
export function GraphiteFunctionEditor(_a) {
    var _b;
    var func = _a.func;
    var dispatch = useDispatch();
    var styles = useStyles2(getStyles);
    // keep track of mouse over and isExpanded state to display buttons for adding optional/multiple params
    // only when the user mouse over over the function editor OR any param editor is expanded.
    var _c = __read(useState(false), 2), mouseOver = _c[0], setIsMouseOver = _c[1];
    var _d = __read(useState(false), 2), expanded = _d[0], setIsExpanded = _d[1];
    var params = mapFuncInstanceToParams(func);
    params = params.filter(function (p, index) {
        // func.added is set for newly added functions - see autofocus below
        return (index < func.def.params.length && !p.optional) || func.added || p.value || expanded || mouseOver;
    });
    return (React.createElement("div", { className: cx(styles.container, (_b = {}, _b[styles.error] = func.def.unknown, _b)), onMouseOver: function () { return setIsMouseOver(true); }, onMouseLeave: function () { return setIsMouseOver(false); } },
        React.createElement(HorizontalGroup, { spacing: "none" },
            React.createElement(FunctionEditor, { func: func, onMoveLeft: function () {
                    dispatch(actions.moveFunction({ func: func, offset: -1 }));
                }, onMoveRight: function () {
                    dispatch(actions.moveFunction({ func: func, offset: 1 }));
                }, onRemove: function () {
                    dispatch(actions.removeFunction({ func: func }));
                } }),
            React.createElement(InlineLabel, { className: styles.label }, "("),
            params.map(function (editableParam, index) {
                return (React.createElement(React.Fragment, { key: index },
                    React.createElement(FunctionParamEditor, { autofocus: index === 0 && func.added, editableParam: editableParam, onChange: function (value) {
                            if (value !== '' || editableParam.optional) {
                                dispatch(actions.updateFunctionParam({ func: func, index: index, value: value }));
                            }
                            setIsExpanded(false);
                            setIsMouseOver(false);
                        }, onExpandedChange: setIsExpanded }),
                    index !== params.length - 1 ? ',' : ''));
            }),
            React.createElement(InlineLabel, { className: styles.label }, ")"))));
}
var getStyles = function (theme) { return ({
    container: css({
        backgroundColor: theme.colors.background.secondary,
        borderRadius: theme.shape.borderRadius(),
        marginRight: theme.spacing(0.5),
        padding: "0 " + theme.spacing(1),
        height: theme.v1.spacing.formInputHeight + "px",
    }),
    error: css(templateObject_1 || (templateObject_1 = __makeTemplateObject(["\n    border: 1px solid ", ";\n  "], ["\n    border: 1px solid ", ";\n  "])), theme.colors.error.main),
    label: css({
        padding: 0,
        margin: 0,
    }),
    button: css({
        padding: theme.spacing(0.5),
    }),
}); };
var templateObject_1;
//# sourceMappingURL=GraphiteFunctionEditor.js.map