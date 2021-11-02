import { __assign, __read } from "tslib";
import React, { useCallback, useEffect, useState } from 'react';
import { toVariablePayload } from '../state/types';
import { changeVariableProp } from '../state/sharedReducer';
import { Input } from '@grafana/ui';
import { variableAdapters } from '../adapters';
import { useDispatch } from 'react-redux';
export function TextBoxVariablePicker(_a) {
    var variable = _a.variable, onVariableChange = _a.onVariableChange;
    var dispatch = useDispatch();
    var _b = __read(useState(variable.current.value), 2), updatedValue = _b[0], setUpdatedValue = _b[1];
    useEffect(function () {
        setUpdatedValue(variable.current.value);
    }, [variable]);
    var updateVariable = useCallback(function () {
        if (variable.current.value === updatedValue) {
            return;
        }
        dispatch(changeVariableProp(toVariablePayload({ id: variable.id, type: variable.type }, { propName: 'query', propValue: updatedValue })));
        if (onVariableChange) {
            onVariableChange(__assign(__assign({}, variable), { current: __assign(__assign({}, variable.current), { value: updatedValue }) }));
            return;
        }
        variableAdapters.get(variable.type).updateOptions(variable);
    }, [variable, updatedValue, dispatch, onVariableChange]);
    var onChange = useCallback(function (event) { return setUpdatedValue(event.target.value); }, [
        setUpdatedValue,
    ]);
    var onBlur = function (e) { return updateVariable(); };
    var onKeyDown = function (event) {
        if (event.keyCode === 13) {
            event.preventDefault();
            updateVariable();
        }
    };
    return (React.createElement(Input, { type: "text", value: updatedValue, onChange: onChange, onBlur: onBlur, onKeyDown: onKeyDown, placeholder: "Enter variable value", id: variable.id }));
}
//# sourceMappingURL=TextBoxVariablePicker.js.map