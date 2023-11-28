import React from 'react';
import { unwrap } from '../utils/unwrap';
import { Seg } from './Seg';
export const AddButton = ({ loadOptions, allowCustomValue, onAdd }) => {
    return (React.createElement(Seg, { value: "+", loadOptions: loadOptions, allowCustomValue: allowCustomValue, onChange: (v) => {
            onAdd(unwrap(v.value));
        } }));
};
//# sourceMappingURL=AddButton.js.map