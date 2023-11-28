import { __rest } from "tslib";
import React, { useRef } from 'react';
import { MonacoQueryFieldLazy } from './MonacoQueryFieldLazy';
export const MonacoQueryFieldWrapper = (props) => {
    const lastRunValueRef = useRef(null);
    const { onRunQuery, onChange } = props, rest = __rest(props, ["onRunQuery", "onChange"]);
    const handleRunQuery = (value) => {
        lastRunValueRef.current = value;
        onChange(value);
        onRunQuery();
    };
    const handleBlur = (value) => {
        onChange(value);
    };
    /**
     * Handles changes without running any queries
     * @param value
     */
    const handleChange = (value) => {
        onChange(value);
    };
    return React.createElement(MonacoQueryFieldLazy, Object.assign({ onChange: handleChange, onRunQuery: handleRunQuery, onBlur: handleBlur }, rest));
};
//# sourceMappingURL=MonacoQueryFieldWrapper.js.map