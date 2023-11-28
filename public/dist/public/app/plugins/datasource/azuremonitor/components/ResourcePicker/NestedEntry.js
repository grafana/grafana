import { cx } from '@emotion/css';
import React, { useCallback, useEffect } from 'react';
import { Checkbox, IconButton, useStyles2, useTheme2 } from '@grafana/ui';
import { Space } from '../Space';
import { EntryIcon } from './EntryIcon';
import getStyles from './styles';
export const NestedEntry = ({ entry, isSelected, isDisabled, isOpen, isSelectable, level, scrollIntoView, onToggleCollapse, onSelectedChange, }) => {
    const theme = useTheme2();
    const styles = useStyles2(getStyles);
    const hasChildren = !!entry.children;
    const handleToggleCollapse = useCallback(() => {
        onToggleCollapse(entry);
    }, [onToggleCollapse, entry]);
    const handleSelectedChanged = useCallback((ev) => {
        const isSelected = ev.target.checked;
        onSelectedChange(entry, isSelected);
    }, [entry, onSelectedChange]);
    const checkboxId = `${scrollIntoView ? 'table' : 'summary'}_checkbox_${entry.uri}`;
    // Scroll to the selected element if it's not in the view
    // Only do it once, when the component is mounted
    useEffect(() => {
        var _a;
        if (isSelected && scrollIntoView) {
            (_a = document.getElementById(checkboxId)) === null || _a === void 0 ? void 0 : _a.scrollIntoView({
                behavior: 'smooth',
                block: 'center',
            });
        }
    }, []); // eslint-disable-line react-hooks/exhaustive-deps
    return (React.createElement("div", { className: styles.nestedEntry, style: { marginLeft: level * (3 * theme.spacing.gridSize) } },
        hasChildren ? (React.createElement(IconButton, { className: styles.collapseButton, name: isOpen ? 'angle-down' : 'angle-right', "aria-label": isOpen ? `Collapse ${entry.name}` : `Expand ${entry.name}`, onClick: handleToggleCollapse, id: entry.id })) : (React.createElement(Space, { layout: "inline", h: 2 })),
        React.createElement(Space, { layout: "inline", h: 2 }),
        isSelectable && (React.createElement(React.Fragment, null,
            React.createElement(Checkbox, { id: checkboxId, onChange: handleSelectedChanged, disabled: isDisabled, value: isSelected, className: styles.nestedRowCheckbox }),
            React.createElement(Space, { layout: "inline", h: 2 }))),
        React.createElement(EntryIcon, { entry: entry, isOpen: isOpen }),
        React.createElement(Space, { layout: "inline", h: 1 }),
        React.createElement("label", { htmlFor: checkboxId, className: cx(styles.entryContentItem, styles.truncated) }, entry.name)));
};
//# sourceMappingURL=NestedEntry.js.map