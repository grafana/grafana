import React, { useCallback, useState } from 'react';
import { ValueMatcherID, VariableOrigin } from '@grafana/data';
import { getTemplateSrv, config as cfg } from '@grafana/runtime';
import { Input } from '@grafana/ui';
import { SuggestionsInput } from '../../suggestionsInput/SuggestionsInput';
import { numberOrVariableValidator } from '../../utils';
import { convertToType } from './utils';
export function basicMatcherEditor(config) {
    return function Render({ options, onChange, field }) {
        const { validator, converter = convertToType } = config;
        const { value } = options;
        const [isInvalid, setInvalid] = useState(!validator(value));
        const templateSrv = getTemplateSrv();
        const variables = templateSrv.getVariables().map((v) => {
            return { value: v.name, label: v.label || v.name, origin: VariableOrigin.Template };
        });
        const onChangeValue = useCallback((event) => {
            setInvalid(!validator(event.currentTarget.value));
        }, [setInvalid, validator]);
        const onChangeOptions = useCallback((event) => {
            if (isInvalid) {
                return;
            }
            const { value } = event.currentTarget;
            onChange(Object.assign(Object.assign({}, options), { value: converter(value, field) }));
        }, [options, onChange, isInvalid, field, converter]);
        const onChangeVariableValue = useCallback((value) => {
            setInvalid(!validator(value));
            onChange(Object.assign(Object.assign({}, options), { value: value }));
        }, [setInvalid, validator, onChange, options]);
        if (cfg.featureToggles.transformationsVariableSupport) {
            return (React.createElement(SuggestionsInput, { invalid: isInvalid, value: value, error: 'Value needs to be an integer or a variable', onChange: onChangeVariableValue, placeholder: "Value or variable", suggestions: variables }));
        }
        else {
            return (React.createElement(Input, { className: "flex-grow-1", invalid: isInvalid, defaultValue: String(options.value), placeholder: "Value", onChange: onChangeValue, onBlur: onChangeOptions }));
        }
    };
}
export const getBasicValueMatchersUI = () => {
    return [
        {
            name: 'Is greater',
            id: ValueMatcherID.greater,
            component: basicMatcherEditor({
                validator: numberOrVariableValidator,
            }),
        },
        {
            name: 'Is greater or equal',
            id: ValueMatcherID.greaterOrEqual,
            component: basicMatcherEditor({
                validator: numberOrVariableValidator,
            }),
        },
        {
            name: 'Is lower',
            id: ValueMatcherID.lower,
            component: basicMatcherEditor({
                validator: numberOrVariableValidator,
            }),
        },
        {
            name: 'Is lower or equal',
            id: ValueMatcherID.lowerOrEqual,
            component: basicMatcherEditor({
                validator: numberOrVariableValidator,
            }),
        },
        {
            name: 'Is equal',
            id: ValueMatcherID.equal,
            component: basicMatcherEditor({
                validator: () => true,
            }),
        },
        {
            name: 'Is not equal',
            id: ValueMatcherID.notEqual,
            component: basicMatcherEditor({
                validator: () => true,
            }),
        },
    ];
};
//# sourceMappingURL=BasicMatcherEditor.js.map