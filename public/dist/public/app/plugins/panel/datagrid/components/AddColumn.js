import React, { useState } from 'react';
import { SimpleInput } from './SimpleInput';
export const AddColumn = ({ divStyle, onColumnInputBlur }) => {
    const [showInput, setShowInput] = useState(false);
    const setupColumnInput = () => {
        setShowInput(true);
    };
    const onBlur = (e) => {
        const columnName = e.target.value;
        if (columnName) {
            onColumnInputBlur(columnName);
        }
        setShowInput(false);
    };
    return (React.createElement("div", { className: divStyle }, showInput ? (React.createElement(SimpleInput, { placeholder: "Column Name", onBlur: onBlur })) : (React.createElement("button", { onClick: setupColumnInput }, "+"))));
};
//# sourceMappingURL=AddColumn.js.map