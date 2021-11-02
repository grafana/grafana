import React from 'react';
import { Icon } from '../Icon/Icon';
export var DropdownIndicator = function (_a) {
    var isOpen = _a.isOpen;
    var icon = isOpen ? 'angle-up' : 'angle-down';
    return React.createElement(Icon, { name: icon });
};
//# sourceMappingURL=DropdownIndicator.js.map