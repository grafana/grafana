import React, { memo } from 'react';
import { Checkbox } from '@grafana/ui';
export const SearchCheckbox = memo(({ onClick, className, checked = false, editable = false, 'aria-label': ariaLabel }) => {
    return editable ? (React.createElement(Checkbox, { onClick: onClick, className: className, value: checked, "aria-label": ariaLabel })) : null;
});
SearchCheckbox.displayName = 'SearchCheckbox';
//# sourceMappingURL=SearchCheckbox.js.map