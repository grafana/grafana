import { css } from '@emotion/css';
import React from 'react';
import { selectors } from '@grafana/e2e-selectors';
import { Checkbox, useStyles2 } from '@grafana/ui';
import { t } from 'app/core/internationalization';
import { SelectionState } from '../types';
export default function CheckboxCell({ row: { original: row }, isSelected, onItemSelectionChange, }) {
    const styles = useStyles2(getStyles);
    const item = row.item;
    if (!isSelected) {
        return React.createElement("span", { className: styles.checkboxSpacer });
    }
    if (item.kind === 'ui') {
        if (item.uiKind === 'pagination-placeholder') {
            return React.createElement(Checkbox, { disabled: true, value: false });
        }
        else {
            return React.createElement("span", { className: styles.checkboxSpacer });
        }
    }
    const state = isSelected(item);
    return (React.createElement(Checkbox, { "data-testid": selectors.pages.BrowseDashboards.table.checkbox(item.uid), "aria-label": t('browse-dashboards.dashboards-tree.select-checkbox', 'Select'), value: state === SelectionState.Selected, indeterminate: state === SelectionState.Mixed, onChange: (ev) => onItemSelectionChange === null || onItemSelectionChange === void 0 ? void 0 : onItemSelectionChange(item, ev.currentTarget.checked) }));
}
const getStyles = (theme) => ({
    // Should be the same size as the <IconButton /> so Dashboard name is aligned to Folder name siblings
    checkboxSpacer: css({
        paddingLeft: theme.spacing(2),
    }),
});
//# sourceMappingURL=CheckboxCell.js.map