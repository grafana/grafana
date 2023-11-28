import React, { useCallback, useEffect, useState } from 'react';
import { isEmptyObject } from '@grafana/data';
import { Input } from '@grafana/ui';
import { t } from 'app/core/internationalization';
import { useDispatch } from 'app/types';
import { variableAdapters } from '../adapters';
import { VARIABLE_PREFIX } from '../constants';
import { toKeyedAction } from '../state/keyedVariablesReducer';
import { changeVariableProp } from '../state/sharedReducer';
import { toVariablePayload } from '../utils';
export function TextBoxVariablePicker({ variable, onVariableChange, readOnly }) {
    const dispatch = useDispatch();
    const [updatedValue, setUpdatedValue] = useState(variable.current.value);
    useEffect(() => {
        setUpdatedValue(variable.current.value);
    }, [variable]);
    const updateVariable = useCallback(() => {
        if (!variable.rootStateKey) {
            console.error('Cannot update variable without rootStateKey');
            return;
        }
        if (variable.current.value === updatedValue) {
            return;
        }
        dispatch(toKeyedAction(variable.rootStateKey, changeVariableProp(toVariablePayload({ id: variable.id, type: variable.type }, { propName: 'query', propValue: updatedValue }))));
        if (onVariableChange) {
            onVariableChange(Object.assign(Object.assign({}, variable), { current: isEmptyObject(variable.current) ? {} : Object.assign(Object.assign({}, variable.current), { value: updatedValue }) }));
            return;
        }
        variableAdapters.get(variable.type).updateOptions(variable);
    }, [variable, updatedValue, dispatch, onVariableChange]);
    const onChange = useCallback((event) => setUpdatedValue(event.target.value), [setUpdatedValue]);
    const onBlur = (e) => updateVariable();
    const onKeyDown = (event) => {
        if (event.keyCode === 13) {
            event.preventDefault();
            updateVariable();
        }
    };
    return (React.createElement(Input, { type: "text", value: updatedValue, onChange: onChange, onBlur: onBlur, disabled: readOnly, onKeyDown: onKeyDown, placeholder: t('variable.textbox.placeholder', 'Enter variable value'), id: VARIABLE_PREFIX + variable.id }));
}
//# sourceMappingURL=TextBoxVariablePicker.js.map