import React, { memo } from 'react';
import { Checkbox } from '@grafana/ui';
export var SearchCheckbox = memo(function (_a) {
    var onClick = _a.onClick, className = _a.className, _b = _a.checked, checked = _b === void 0 ? false : _b, _c = _a.editable, editable = _c === void 0 ? false : _c, ariaLabel = _a["aria-label"];
    return editable ? (React.createElement("div", { onClick: onClick, className: className },
        React.createElement(Checkbox, { value: checked, "aria-label": ariaLabel }))) : null;
});
SearchCheckbox.displayName = 'SearchCheckbox';
//# sourceMappingURL=SearchCheckbox.js.map