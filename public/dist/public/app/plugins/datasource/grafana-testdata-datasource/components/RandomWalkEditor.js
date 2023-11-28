import React from 'react';
import { selectors } from '@grafana/e2e-selectors';
import { InlineField, InlineFieldRow, Input } from '@grafana/ui';
const randomWalkFields = [
    { label: 'Series count', id: 'seriesCount', placeholder: '1', min: 1, step: 1 },
    { label: 'Start value', id: 'startValue', placeholder: 'auto', step: 1 },
    { label: 'Min', id: 'min', placeholder: 'none', step: 0.1 },
    { label: 'Max', id: 'max', placeholder: 'none', step: 0.1 },
    { label: 'Spread', id: 'spread', placeholder: '1', min: 0.5, step: 0.1 },
    { label: 'Noise', id: 'noise', placeholder: '0', min: 0, step: 0.1 },
    {
        label: 'Drop (%)',
        id: 'drop',
        placeholder: '0',
        min: 0,
        max: 100,
        step: 1,
        tooltip: 'Exclude some percent (chance) points',
    },
];
const testSelectors = selectors.components.DataSource.TestData.QueryTab;
export const RandomWalkEditor = ({ onChange, query }) => {
    return (React.createElement(InlineFieldRow, null, randomWalkFields.map(({ label, id, min, step, placeholder, tooltip }) => {
        const selector = testSelectors === null || testSelectors === void 0 ? void 0 : testSelectors[id];
        return (React.createElement(InlineField, { label: label, labelWidth: 14, key: id, "aria-label": selector, tooltip: tooltip },
            React.createElement(Input, { width: 32, name: id, type: "number", id: `randomWalk-${id}-${query.refId}`, min: min, step: step, value: query[id] || placeholder, placeholder: placeholder, onChange: onChange })));
    })));
};
//# sourceMappingURL=RandomWalkEditor.js.map