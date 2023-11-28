import React, { useRef } from 'react';
import { EditorField } from '@grafana/experimental';
import { Select, AutoSizeInput } from '@grafana/ui';
import { LegendFormatMode } from '../../types';
const legendModeOptions = [
    {
        label: 'Auto',
        value: LegendFormatMode.Auto,
        description: 'Only includes unique labels',
    },
    { label: 'Verbose', value: LegendFormatMode.Verbose, description: 'All label names and values' },
    { label: 'Custom', value: LegendFormatMode.Custom, description: 'Provide a naming template' },
];
/**
 * Tests for this component are on the parent level (PromQueryBuilderOptions).
 */
export const PromQueryLegendEditor = React.memo(({ legendFormat, onChange, onRunQuery }) => {
    const mode = getLegendMode(legendFormat);
    const inputRef = useRef(null);
    const onLegendFormatChanged = (evt) => {
        let newFormat = evt.currentTarget.value;
        if (newFormat.length === 0) {
            newFormat = LegendFormatMode.Auto;
        }
        if (newFormat !== legendFormat) {
            onChange(newFormat);
            onRunQuery();
        }
    };
    const onLegendModeChanged = (value) => {
        switch (value.value) {
            case LegendFormatMode.Auto:
                onChange(LegendFormatMode.Auto);
                break;
            case LegendFormatMode.Custom:
                onChange('{{label_name}}');
                setTimeout(() => {
                    var _a, _b;
                    (_a = inputRef.current) === null || _a === void 0 ? void 0 : _a.focus();
                    (_b = inputRef.current) === null || _b === void 0 ? void 0 : _b.setSelectionRange(2, 12, 'forward');
                }, 10);
                break;
            case LegendFormatMode.Verbose:
                onChange('');
                break;
        }
        onRunQuery();
    };
    return (React.createElement(EditorField, { label: "Legend", tooltip: "Series name override or template. Ex. {{hostname}} will be replaced with label value for hostname." },
        React.createElement(React.Fragment, null,
            mode === LegendFormatMode.Custom && (React.createElement(AutoSizeInput, { id: "legendFormat", minWidth: 22, placeholder: "auto", defaultValue: legendFormat, onCommitChange: onLegendFormatChanged, ref: inputRef })),
            mode !== LegendFormatMode.Custom && (React.createElement(Select, { inputId: "legend.mode", isSearchable: false, placeholder: "Select legend mode", options: legendModeOptions, width: 22, onChange: onLegendModeChanged, value: legendModeOptions.find((x) => x.value === mode) })))));
});
PromQueryLegendEditor.displayName = 'PromQueryLegendEditor';
function getLegendMode(legendFormat) {
    // This special value means the new smart minimal series naming
    if (legendFormat === LegendFormatMode.Auto) {
        return LegendFormatMode.Auto;
    }
    // Missing or empty legend format is the old verbose behavior
    if (legendFormat == null || legendFormat === '') {
        return LegendFormatMode.Verbose;
    }
    return LegendFormatMode.Custom;
}
export function getLegendModeLabel(legendFormat) {
    var _a;
    const mode = getLegendMode(legendFormat);
    if (mode !== LegendFormatMode.Custom) {
        return (_a = legendModeOptions.find((x) => x.value === mode)) === null || _a === void 0 ? void 0 : _a.label;
    }
    return legendFormat;
}
//# sourceMappingURL=PromQueryLegendEditor.js.map