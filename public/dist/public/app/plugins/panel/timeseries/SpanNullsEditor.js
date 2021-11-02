import React from 'react';
import { rangeUtil } from '@grafana/data';
import { HorizontalGroup, Input, RadioButtonGroup } from '@grafana/ui';
var GAPS_OPTIONS = [
    {
        label: 'Never',
        value: false,
    },
    {
        label: 'Always',
        value: true,
    },
    {
        label: 'Threshold',
        value: 3600000, // 1h
    },
];
export var SpanNullsEditor = function (_a) {
    var value = _a.value, onChange = _a.onChange;
    var isThreshold = typeof value === 'number';
    var formattedTime = isThreshold ? rangeUtil.secondsToHms(value / 1000) : undefined;
    GAPS_OPTIONS[2].value = isThreshold ? value : 3600000; // 1h
    var checkAndUpdate = function (txt) {
        var val = false;
        if (txt) {
            try {
                val = rangeUtil.intervalToSeconds(txt) * 1000;
            }
            catch (err) {
                console.warn('ERROR', err);
            }
        }
        onChange(val);
    };
    var handleEnterKey = function (e) {
        if (e.key !== 'Enter') {
            return;
        }
        checkAndUpdate(e.target.value);
    };
    var handleBlur = function (e) {
        checkAndUpdate(e.target.value);
    };
    return (React.createElement(HorizontalGroup, null,
        React.createElement(RadioButtonGroup, { value: value, options: GAPS_OPTIONS, onChange: onChange }),
        isThreshold && (React.createElement(Input, { autoFocus: false, placeholder: "never", width: 10, defaultValue: formattedTime, onKeyDown: handleEnterKey, onBlur: handleBlur, prefix: React.createElement("div", null, "<"), spellCheck: false }))));
};
//# sourceMappingURL=SpanNullsEditor.js.map