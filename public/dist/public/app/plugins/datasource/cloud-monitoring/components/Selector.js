import React from 'react';
import { EditorField } from '@grafana/experimental';
import { Select } from '@grafana/ui';
import { SELECTORS } from '../constants';
export const Selector = ({ refId, query, templateVariableOptions, onChange, datasource }) => {
    return (React.createElement(EditorField, { label: "Selector", htmlFor: `${refId}-slo-selector` },
        React.createElement(Select, { inputId: `${refId}-slo-selector`, width: "auto", allowCustomValue: true, value: [...SELECTORS, ...templateVariableOptions].find((s) => { var _a; return (_a = s.value === (query === null || query === void 0 ? void 0 : query.selectorName)) !== null && _a !== void 0 ? _a : ''; }), options: [
                {
                    label: 'Template Variables',
                    options: templateVariableOptions,
                },
                ...SELECTORS,
            ], onChange: ({ value: selectorName }) => onChange(Object.assign(Object.assign({}, query), { selectorName: selectorName !== null && selectorName !== void 0 ? selectorName : '' })) })));
};
//# sourceMappingURL=Selector.js.map