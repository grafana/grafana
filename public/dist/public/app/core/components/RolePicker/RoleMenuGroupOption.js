import { cx } from '@emotion/css';
import React, { memo } from 'react';
import { Checkbox, Portal, useStyles2, useTheme2 } from '@grafana/ui';
import { getSelectStyles } from '@grafana/ui/src/components/Select/getSelectStyles';
import { getStyles } from './styles';
export const RoleMenuGroupOption = memo(React.forwardRef(({ name, value, isFocused, isSelected, partiallySelected, disabled, onChange, onClick, onOpenSubMenu, onCloseSubMenu, children, root, }, ref) => {
    const theme = useTheme2();
    const styles = getSelectStyles(theme);
    const customStyles = useStyles2(getStyles);
    const wrapperClassName = cx(styles.option, isFocused && styles.optionFocused, disabled && customStyles.menuOptionDisabled);
    const onChangeInternal = (event) => {
        if (disabled) {
            return;
        }
        if (value) {
            onChange(value);
        }
    };
    const onClickInternal = (event) => {
        if (onClick) {
            onClick(value);
        }
    };
    const onMouseEnter = () => {
        if (onOpenSubMenu) {
            onOpenSubMenu(value);
        }
    };
    const onMouseLeave = () => {
        if (onCloseSubMenu) {
            onCloseSubMenu();
        }
    };
    return (React.createElement("div", { onMouseEnter: onMouseEnter, onMouseLeave: onMouseLeave },
        React.createElement("div", { ref: ref, className: wrapperClassName, "aria-label": "Role picker option", onClick: onClickInternal },
            React.createElement(Checkbox, { value: isSelected, className: cx(customStyles.menuOptionCheckbox, {
                    [customStyles.checkboxPartiallyChecked]: partiallySelected,
                }), onChange: onChangeInternal, disabled: disabled }),
            React.createElement("div", { className: cx(styles.optionBody, customStyles.menuOptionBody) },
                React.createElement("span", null, name),
                React.createElement("span", { className: customStyles.menuOptionExpand })),
            root && children && (React.createElement(Portal, { className: customStyles.subMenuPortal, root: root }, children)))));
}));
RoleMenuGroupOption.displayName = 'RoleMenuGroupOption';
//# sourceMappingURL=RoleMenuGroupOption.js.map