import React from 'react';
import { Seg } from './Seg';
import { unwrap } from './unwrap';
export var AddButton = function (_a) {
    var loadOptions = _a.loadOptions, allowCustomValue = _a.allowCustomValue, onAdd = _a.onAdd;
    return (React.createElement(Seg, { value: "+", loadOptions: loadOptions, allowCustomValue: allowCustomValue, onChange: function (v) {
            onAdd(unwrap(v.value));
        } }));
};
//# sourceMappingURL=AddButton.js.map