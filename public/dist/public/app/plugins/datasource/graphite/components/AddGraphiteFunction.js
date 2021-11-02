import { __makeTemplateObject, __read } from "tslib";
import React, { useEffect, useMemo, useState } from 'react';
import { Button, Segment, useStyles2 } from '@grafana/ui';
import { actions } from '../state/actions';
import { css, cx } from '@emotion/css';
import { mapFuncDefsToSelectables } from './helpers';
import { useDispatch } from '../state/context';
export function AddGraphiteFunction(_a) {
    var funcDefs = _a.funcDefs;
    var dispatch = useDispatch();
    var _b = __read(useState(undefined), 2), value = _b[0], setValue = _b[1];
    var styles = useStyles2(getStyles);
    var options = useMemo(function () { return mapFuncDefsToSelectables(funcDefs); }, [funcDefs]);
    // Note: actions.addFunction will add a component that will have a dropdown or input in auto-focus
    // (the first param of the function). This auto-focus will cause onBlur() on AddGraphiteFunction's
    // Segment component and trigger onChange once again. (why? we call onChange if the user dismissed
    // the dropdown, see: SegmentSelect.onCloseMenu for more details). To avoid it we need to wait for
    // the Segment to disappear first (hence useEffect) and then dispatch the action that will add new
    // components.
    useEffect(function () {
        if ((value === null || value === void 0 ? void 0 : value.value) !== undefined) {
            dispatch(actions.addFunction({ name: value.value }));
            setValue(undefined);
        }
    }, [value, dispatch]);
    return (React.createElement(Segment, { Component: React.createElement(Button, { icon: "plus", variant: "secondary", className: cx(styles.button) }), options: options, onChange: setValue, inputMinWidth: 150 }));
}
function getStyles(theme) {
    return {
        button: css(templateObject_1 || (templateObject_1 = __makeTemplateObject(["\n      margin-right: ", ";\n    "], ["\n      margin-right: ", ";\n    "])), theme.spacing(0.5)),
    };
}
var templateObject_1;
//# sourceMappingURL=AddGraphiteFunction.js.map