import React, { useCallback } from 'react';
import { PluginState, ReducerID, isReducerID } from '@grafana/data';
import { InlineFieldRow, InlineField, StatsPicker } from '@grafana/ui';
import { timeSeriesTableTransformer } from './timeSeriesTableTransformer';
export function TimeSeriesTableTransformEditor({ input, options, onChange, }) {
    const refIds = input.reduce((acc, frame) => {
        if (frame.refId && !acc.includes(frame.refId)) {
            return [...acc, frame.refId];
        }
        return acc;
    }, []);
    const onSelectStat = useCallback((refId, stats) => {
        const reducerID = stats[0];
        if (reducerID && isReducerID(reducerID)) {
            onChange({
                refIdToStat: Object.assign(Object.assign({}, options.refIdToStat), { [refId]: reducerID }),
            });
        }
    }, [onChange, options]);
    return (React.createElement(React.Fragment, null, refIds.map((refId) => {
        var _a, _b;
        return (React.createElement("div", { key: refId },
            React.createElement(InlineFieldRow, null,
                React.createElement(InlineField, { label: `Trend ${refIds.length > 1 ? ` #${refId}` : ''} value` },
                    React.createElement(StatsPicker, { stats: [(_b = (_a = options.refIdToStat) === null || _a === void 0 ? void 0 : _a[refId]) !== null && _b !== void 0 ? _b : ReducerID.lastNotNull], onChange: onSelectStat.bind(null, refId), filterOptions: (ext) => ext.id !== ReducerID.allValues && ext.id !== ReducerID.uniqueValues })))));
    })));
}
export const timeSeriesTableTransformRegistryItem = {
    id: timeSeriesTableTransformer.id,
    editor: TimeSeriesTableTransformEditor,
    transformation: timeSeriesTableTransformer,
    name: timeSeriesTableTransformer.name,
    description: timeSeriesTableTransformer.description,
    state: PluginState.beta,
    help: ``,
};
//# sourceMappingURL=TimeSeriesTableTransformEditor.js.map