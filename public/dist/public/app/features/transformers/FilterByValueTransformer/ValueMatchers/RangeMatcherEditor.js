import React, { useCallback, useState } from 'react';
import { ValueMatcherID, VariableOrigin } from '@grafana/data';
import { getTemplateSrv, config as cfg } from '@grafana/runtime';
import { Input } from '@grafana/ui';
import { SuggestionsInput } from '../../suggestionsInput/SuggestionsInput';
import { numberOrVariableValidator } from '../../utils';
import { convertToType } from './utils';
export function rangeMatcherEditor(config) {
    return function RangeMatcherEditor({ options, onChange, field }) {
        const { validator } = config;
        const [isInvalid, setInvalid] = useState({
            from: !validator(options.from),
            to: !validator(options.to),
        });
        const templateSrv = getTemplateSrv();
        const variables = templateSrv.getVariables().map((v) => {
            return { value: v.name, label: v.label || v.name, origin: VariableOrigin.Template };
        });
        const onChangeValue = useCallback((event, prop) => {
            setInvalid(Object.assign(Object.assign({}, isInvalid), { [prop]: !validator(event.currentTarget.value) }));
        }, [setInvalid, validator, isInvalid]);
        const onChangeOptions = useCallback((event, prop) => {
            if (isInvalid[prop]) {
                return;
            }
            const { value } = event.currentTarget;
            onChange(Object.assign(Object.assign({}, options), { [prop]: convertToType(value, field) }));
        }, [options, onChange, isInvalid, field]);
        const onChangeOptionsSuggestions = useCallback((value, prop) => {
            const invalid = !validator(value);
            setInvalid(Object.assign(Object.assign({}, isInvalid), { [prop]: invalid }));
            if (invalid) {
                return;
            }
            onChange(Object.assign(Object.assign({}, options), { [prop]: value }));
        }, [options, onChange, isInvalid, setInvalid, validator]);
        if (cfg.featureToggles.transformationsVariableSupport) {
            return (React.createElement(React.Fragment, null,
                React.createElement(SuggestionsInput, { value: String(options.from), invalid: isInvalid.from, error: 'Value needs to be an integer or a variable', placeholder: "From", onChange: (val) => onChangeOptionsSuggestions(val, 'from'), suggestions: variables }),
                React.createElement("div", { className: "gf-form-label" }, "and"),
                React.createElement(SuggestionsInput, { invalid: isInvalid.to, error: 'Value needs to be an integer or a variable', value: String(options.to), placeholder: "To", suggestions: variables, onChange: (val) => onChangeOptionsSuggestions(val, 'to') })));
        }
        return (React.createElement(React.Fragment, null,
            React.createElement(Input, { className: "flex-grow-1 gf-form-spacing", invalid: isInvalid['from'], defaultValue: String(options.from), placeholder: "From", onChange: (event) => onChangeValue(event, 'from'), onBlur: (event) => onChangeOptions(event, 'from') }),
            React.createElement("div", { className: "gf-form-label" }, "and"),
            React.createElement(Input, { className: "flex-grow-1", invalid: isInvalid['to'], defaultValue: String(options.to), placeholder: "To", onChange: (event) => onChangeValue(event, 'to'), onBlur: (event) => onChangeOptions(event, 'to') })));
    };
}
export const getRangeValueMatchersUI = () => {
    return [
        {
            name: 'Is between',
            id: ValueMatcherID.between,
            component: rangeMatcherEditor({
                validator: numberOrVariableValidator,
            }),
        },
    ];
};
//# sourceMappingURL=RangeMatcherEditor.js.map