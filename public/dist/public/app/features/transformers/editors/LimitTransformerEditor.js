import React, { useCallback, useState } from 'react';
import { DataTransformerID, standardTransformers, TransformerCategory, VariableOrigin, } from '@grafana/data';
import { getTemplateSrv, config as cfg } from '@grafana/runtime';
import { InlineField, InlineFieldRow, Input } from '@grafana/ui';
import { SuggestionsInput } from '../suggestionsInput/SuggestionsInput';
import { numberOrVariableValidator } from '../utils';
export const LimitTransformerEditor = ({ options, onChange }) => {
    const [isInvalid, setInvalid] = useState(false);
    const onSetLimit = useCallback((value) => {
        onChange(Object.assign(Object.assign({}, options), { limitField: Number(value.currentTarget.value) }));
    }, [onChange, options]);
    const onSetVariableLimit = useCallback((value) => {
        setInvalid(!numberOrVariableValidator(value));
        onChange(Object.assign(Object.assign({}, options), { limitField: value }));
    }, [onChange, options]);
    const templateSrv = getTemplateSrv();
    const variables = templateSrv.getVariables().map((v) => {
        return { value: v.name, label: v.label || v.name, origin: VariableOrigin.Template };
    });
    if (!cfg.featureToggles.transformationsVariableSupport) {
        return (React.createElement(React.Fragment, null,
            React.createElement(InlineFieldRow, null,
                React.createElement(InlineField, { label: "Limit", labelWidth: 8 },
                    React.createElement(Input, { placeholder: "Limit count", pattern: "[0-9]*", value: options.limitField, onChange: onSetLimit, width: 25 })))));
    }
    return (React.createElement(React.Fragment, null,
        React.createElement(InlineFieldRow, null,
            React.createElement(SuggestionsInput, { invalid: isInvalid, error: 'Value needs to be an integer or a variable', value: String(options.limitField), onChange: onSetVariableLimit, placeholder: "Value or variable", suggestions: variables }))));
};
export const limitTransformRegistryItem = {
    id: DataTransformerID.limit,
    editor: LimitTransformerEditor,
    transformation: standardTransformers.limitTransformer,
    name: 'Limit',
    description: `Limit the number of items displayed.`,
    categories: new Set([TransformerCategory.Filter]),
};
//# sourceMappingURL=LimitTransformerEditor.js.map