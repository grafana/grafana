import React from 'react';
import { InlineField, InlineFieldRow, Input } from '@grafana/ui';
import { selectors } from '@grafana/e2e-selectors';
var randomWalkFields = [
    { label: 'Series count', id: 'seriesCount', placeholder: '1', min: 1, step: 1 },
    { label: 'Start value', id: 'startValue', placeholder: 'auto', step: 1 },
    { label: 'Spread', id: 'spread', placeholder: '1', min: 0.5, step: 0.1 },
    { label: 'Noise', id: 'noise', placeholder: '0', min: 0, step: 0.1 },
    { label: 'Min', id: 'min', placeholder: 'none', step: 0.1 },
    { label: 'Max', id: 'max', placeholder: 'none', step: 0.1 },
];
var testSelectors = selectors.components.DataSource.TestData.QueryTab;
export var RandomWalkEditor = function (_a) {
    var onChange = _a.onChange, query = _a.query;
    return (React.createElement(InlineFieldRow, null, randomWalkFields.map(function (_a) {
        var label = _a.label, id = _a.id, min = _a.min, step = _a.step, placeholder = _a.placeholder;
        var selector = testSelectors === null || testSelectors === void 0 ? void 0 : testSelectors[id];
        return (React.createElement(InlineField, { label: label, labelWidth: 14, key: id, "aria-label": selector },
            React.createElement(Input, { width: 32, name: id, type: "number", id: "randomWalk-" + id + "-" + query.refId, min: min, step: step, value: query[id] || placeholder, placeholder: placeholder, onChange: onChange })));
    })));
};
//# sourceMappingURL=RandomWalkEditor.js.map