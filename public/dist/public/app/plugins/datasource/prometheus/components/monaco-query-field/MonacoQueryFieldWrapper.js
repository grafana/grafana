import { __assign, __rest } from "tslib";
import React, { useRef } from 'react';
import { MonacoQueryFieldLazy } from './MonacoQueryFieldLazy';
export var MonacoQueryFieldWrapper = function (props) {
    var lastRunValueRef = useRef(null);
    var runQueryOnBlur = props.runQueryOnBlur, onRunQuery = props.onRunQuery, onChange = props.onChange, rest = __rest(props, ["runQueryOnBlur", "onRunQuery", "onChange"]);
    var handleRunQuery = function (value) {
        lastRunValueRef.current = value;
        onChange(value);
        onRunQuery();
    };
    var handleBlur = function (value) {
        if (runQueryOnBlur) {
            // run handleRunQuery only if the current value is different from the last-time-executed value
            if (value !== lastRunValueRef.current) {
                handleRunQuery(value);
            }
        }
        else {
            onChange(value);
        }
    };
    return React.createElement(MonacoQueryFieldLazy, __assign({ onRunQuery: handleRunQuery, onBlur: handleBlur }, rest));
};
//# sourceMappingURL=MonacoQueryFieldWrapper.js.map