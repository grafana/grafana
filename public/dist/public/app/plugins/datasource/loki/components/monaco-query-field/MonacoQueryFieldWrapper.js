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
    return React.createElement(MonacoQueryFieldLazy, Object.assign({ onRunQuery: handleRunQuery, onBlur: handleBlur, onChange: onChange }, rest));
};
//# sourceMappingURL=MonacoQueryFieldWrapper.js.map