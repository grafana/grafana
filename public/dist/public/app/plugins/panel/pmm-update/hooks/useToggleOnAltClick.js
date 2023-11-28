import { useState } from 'react';
export const useToggleOnAltClick = (initialValue = false) => {
    const [toggleValue, setToggleValue] = useState(initialValue);
    const handler = (e) => {
        if (e.altKey) {
            setToggleValue((currentValue) => !currentValue);
        }
    };
    return [toggleValue, handler];
};
//# sourceMappingURL=useToggleOnAltClick.js.map