import React, { useCallback, useState } from 'react';
import { useStyles2, getSelectStyles, useTheme2 } from '@grafana/ui';
import { RoleMenuGroupOption } from './RoleMenuGroupOption';
import { RoleMenuOption } from './RoleMenuOption';
import { RolePickerSubMenu } from './RolePickerSubMenu';
import { getStyles } from './styles';
import { isNotDelegatable } from './utils';
export const RoleMenuGroupsSection = React.forwardRef(({ roles, renderedName, showGroups, optionGroups, onGroupChange, groupSelected, groupPartiallySelected, subMenuNode, selectedOptions, onRoleChange, onClearSubMenu, showOnLeftSubMenu, }, _ref) => {
    const [showSubMenu, setShowSubMenu] = useState(false);
    const [openedMenuGroup, setOpenedMenuGroup] = useState('');
    const theme = useTheme2();
    const selectStyles = getSelectStyles(theme);
    const styles = useStyles2(getStyles);
    const onOpenSubMenu = useCallback((value) => {
        setOpenedMenuGroup(value);
        setShowSubMenu(true);
    }, []);
    const onCloseSubMenu = useCallback(() => {
        setShowSubMenu(false);
        setOpenedMenuGroup('');
    }, []);
    return (React.createElement("div", null, roles.length > 0 && (React.createElement("div", { className: styles.menuSection },
        React.createElement("div", { className: styles.groupHeader }, renderedName),
        React.createElement("div", { className: selectStyles.optionBody }),
        showGroups && !!(optionGroups === null || optionGroups === void 0 ? void 0 : optionGroups.length)
            ? optionGroups.map((groupOption) => {
                var _a;
                return (React.createElement(RoleMenuGroupOption, { key: groupOption.value, name: groupOption.name, value: groupOption.value, isSelected: groupSelected(groupOption.value) || groupPartiallySelected(groupOption.value), partiallySelected: groupPartiallySelected(groupOption.value), disabled: (_a = groupOption.options) === null || _a === void 0 ? void 0 : _a.every(isNotDelegatable), onChange: onGroupChange, onOpenSubMenu: onOpenSubMenu, onCloseSubMenu: onCloseSubMenu, root: subMenuNode, isFocused: showSubMenu && openedMenuGroup === groupOption.value }, showSubMenu && openedMenuGroup === groupOption.value && (React.createElement(RolePickerSubMenu, { options: groupOption.options, selectedOptions: selectedOptions, onSelect: onRoleChange, onClear: () => onClearSubMenu(openedMenuGroup), showOnLeft: showOnLeftSubMenu }))));
            })
            : roles.map((option) => (React.createElement(RoleMenuOption, { data: option, key: option.uid, isSelected: !!(option.uid && !!selectedOptions.find((opt) => opt.uid === option.uid)), disabled: isNotDelegatable(option), onChange: onRoleChange, hideDescription: true })))))));
});
RoleMenuGroupsSection.displayName = 'RoleMenuGroupsSection';
//# sourceMappingURL=RoleMenuGroupsSection.js.map