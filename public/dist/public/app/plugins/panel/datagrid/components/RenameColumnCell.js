import React, { useLayoutEffect, useRef, useState } from 'react';
import { Portal } from '@grafana/ui';
export const RenameColumnCell = ({ renameColumnData, onColumnInputBlur, classStyle }) => {
    const { x, y, width, height, inputValue, columnIdx } = renameColumnData;
    const [styles, setStyles] = useState({});
    const [value, setValue] = useState(inputValue);
    const ref = useRef(null);
    useLayoutEffect(() => {
        var _a, _b;
        (_a = ref.current) === null || _a === void 0 ? void 0 : _a.focus();
        const rect = (_b = ref.current) === null || _b === void 0 ? void 0 : _b.getBoundingClientRect();
        if (rect) {
            const collisions = {
                right: window.innerWidth < x + rect.width,
                bottom: window.innerHeight < y + rect.height,
            };
            setStyles({
                position: 'fixed',
                left: collisions.right ? x - rect.width : x,
                top: collisions.bottom ? y - rect.height : y,
                width: width,
                height: height,
            });
        }
    }, [height, width, x, y]);
    const onBlur = (e) => {
        const columnName = e.target.value;
        if (columnName) {
            onColumnInputBlur(columnName, columnIdx);
        }
    };
    const onChange = (e) => {
        setValue(e.target.value);
    };
    const onKeyDown = (e) => {
        if (e.key === 'Enter') {
            const target = e.currentTarget;
            target.blur();
        }
    };
    return (React.createElement(Portal, null,
        React.createElement("input", { type: "text", className: classStyle, value: value, onBlur: onBlur, ref: ref, style: styles, onChange: onChange, onKeyDown: onKeyDown })));
};
//# sourceMappingURL=RenameColumnCell.js.map