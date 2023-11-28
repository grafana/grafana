import React from 'react';
import { Checkbox } from '@grafana/ui';
import { t } from 'app/core/internationalization';
import { SelectionState } from '../types';
export default function CheckboxHeaderCell({ isSelected, onAllSelectionChange }) {
    var _a;
    const state = (_a = isSelected === null || isSelected === void 0 ? void 0 : isSelected('$all')) !== null && _a !== void 0 ? _a : SelectionState.Unselected;
    return (React.createElement(Checkbox, { value: state === SelectionState.Selected, indeterminate: state === SelectionState.Mixed, "aria-label": t('browse-dashboards.dashboards-tree.select-all-header-checkbox', 'Select all'), onChange: (ev) => {
            if (state === SelectionState.Mixed) {
                // Ensure clicking an indeterminate checkbox always clears the selection
                onAllSelectionChange === null || onAllSelectionChange === void 0 ? void 0 : onAllSelectionChange(false);
            }
            else {
                onAllSelectionChange === null || onAllSelectionChange === void 0 ? void 0 : onAllSelectionChange(ev.currentTarget.checked);
            }
        } }));
}
//# sourceMappingURL=CheckboxHeaderCell.js.map