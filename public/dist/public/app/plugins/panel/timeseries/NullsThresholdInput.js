import React from 'react';
import { rangeUtil } from '@grafana/data';
import { Input } from '@grafana/ui';
export var InputPrefix;
(function (InputPrefix) {
    InputPrefix["LessThan"] = "lessthan";
    InputPrefix["GreaterThan"] = "greaterthan";
})(InputPrefix || (InputPrefix = {}));
export const NullsThresholdInput = ({ value, onChange, inputPrefix, isTime }) => {
    let defaultValue = rangeUtil.secondsToHms(value / 1000);
    if (!isTime) {
        defaultValue = '10';
    }
    const checkAndUpdate = (txt) => {
        let val = false;
        if (txt) {
            try {
                if (isTime && rangeUtil.isValidTimeSpan(txt)) {
                    val = rangeUtil.intervalToMs(txt);
                }
                else {
                    val = Number(txt);
                }
            }
            catch (err) {
                console.warn('ERROR', err);
            }
        }
        onChange(val);
    };
    const handleEnterKey = (e) => {
        if (e.key !== 'Enter') {
            return;
        }
        checkAndUpdate(e.currentTarget.value);
    };
    const handleBlur = (e) => {
        checkAndUpdate(e.currentTarget.value);
    };
    const prefix = inputPrefix === InputPrefix.GreaterThan ? (React.createElement("div", null, ">")) : inputPrefix === InputPrefix.LessThan ? (React.createElement("div", null, "<")) : null;
    return (React.createElement(Input, { autoFocus: false, placeholder: "never", width: 10, defaultValue: defaultValue, onKeyDown: handleEnterKey, onBlur: handleBlur, prefix: prefix, spellCheck: false }));
};
//# sourceMappingURL=NullsThresholdInput.js.map