import React, { useRef, useEffect } from 'react';
export const SimpleInput = ({ onBlur, placeholder }) => {
    const ref = useRef(null);
    useEffect(() => {
        if (!ref.current) {
            return;
        }
        ref.current.focus();
    });
    const onKeyDown = (e) => {
        if (e.key === 'Enter') {
            const target = e.currentTarget;
            target.blur();
        }
    };
    return (React.createElement("input", { type: "text", placeholder: placeholder, onBlur: onBlur, ref: ref, onKeyDown: onKeyDown, "data-testid": "column-input" }));
};
//# sourceMappingURL=SimpleInput.js.map