import React, { useCallback, useEffect, useState, useRef } from 'react';
import { ClickOutsideWrapper, HorizontalGroup, Spinner } from '@grafana/ui';
import { RolePickerInput } from './RolePickerInput';
import { RolePickerMenu } from './RolePickerMenu';
import { MENU_MAX_HEIGHT, ROLE_PICKER_SUBMENU_MIN_WIDTH, ROLE_PICKER_WIDTH } from './constants';
export const RolePicker = ({ basicRole, appliedRoles, roleOptions, disabled, isLoading, basicRoleDisabled, basicRoleDisabledMessage, showBasicRole, onRolesChange, onBasicRoleChange, canUpdateRoles = true, apply = false, maxWidth = ROLE_PICKER_WIDTH, }) => {
    const [isOpen, setOpen] = useState(false);
    const [selectedRoles, setSelectedRoles] = useState(appliedRoles);
    const [selectedBuiltInRole, setSelectedBuiltInRole] = useState(basicRole);
    const [query, setQuery] = useState('');
    const [offset, setOffset] = useState({ vertical: 0, horizontal: 0 });
    const ref = useRef(null);
    useEffect(() => {
        setSelectedBuiltInRole(basicRole);
        setSelectedRoles(appliedRoles);
    }, [appliedRoles, basicRole, onBasicRoleChange]);
    useEffect(() => {
        var _a;
        const dimensions = (_a = ref === null || ref === void 0 ? void 0 : ref.current) === null || _a === void 0 ? void 0 : _a.getBoundingClientRect();
        if (!dimensions || !isOpen) {
            return;
        }
        const { bottom, top, left, right, width: currentRolePickerWidth } = dimensions;
        const distance = window.innerHeight - bottom;
        const offsetVertical = bottom - top + 10; // Add extra 10px to offset to account for border and outline
        const offsetHorizontal = right - left;
        let horizontal = -offsetHorizontal;
        let vertical = -offsetVertical;
        if (distance < MENU_MAX_HEIGHT + 20) {
            // Off set to display the role picker menu at the bottom of the screen
            // without resorting to scroll the page
            vertical = 50 + (MENU_MAX_HEIGHT - distance) - offsetVertical;
        }
        /*
         * This expression calculates whether there is enough place
         * on the right of the RolePicker input to show/fit the role picker menu and its sub menu AND
         * whether there is enough place under the RolePicker input to show/fit
         * both (the role picker menu and its sub menu) aligned to the left edge of the input.
         * Otherwise, it aligns the role picker menu to the right.
         */
        if (window.innerWidth - right < currentRolePickerWidth &&
            currentRolePickerWidth < 2 * ROLE_PICKER_SUBMENU_MIN_WIDTH) {
            horizontal = offsetHorizontal;
        }
        setOffset({ horizontal, vertical });
    }, [isOpen, selectedRoles]);
    const onOpen = useCallback((event) => {
        if (!disabled) {
            event.preventDefault();
            event.stopPropagation();
            setOpen(true);
        }
    }, [setOpen, disabled]);
    const onClose = useCallback(() => {
        setOpen(false);
        setQuery('');
        setSelectedRoles(appliedRoles);
        setSelectedBuiltInRole(basicRole);
    }, [appliedRoles, basicRole]);
    // Only call onClose if menu is open. Prevent unnecessary calls for multiple pickers on the page.
    const onClickOutside = () => isOpen && onClose();
    const onInputChange = (query) => {
        if (query) {
            setQuery(query);
        }
        else {
            setQuery('');
        }
    };
    const onSelect = (roles) => {
        setSelectedRoles(roles);
    };
    const onBasicRoleSelect = (role) => {
        setSelectedBuiltInRole(role);
    };
    const onUpdate = (newRoles, newBuiltInRole) => {
        if (onBasicRoleChange && newBuiltInRole && newBuiltInRole !== basicRole) {
            onBasicRoleChange(newBuiltInRole);
        }
        if (canUpdateRoles) {
            onRolesChange(newRoles);
        }
        setQuery('');
        setOpen(false);
    };
    const getOptions = () => {
        // if roles cannot be updated mark every role as non delegatable
        const options = roleOptions.map((r) => (Object.assign(Object.assign({}, r), { delegatable: canUpdateRoles && r.delegatable })));
        if (query && query.trim() !== '') {
            return options.filter((option) => { var _a; return (_a = option.name) === null || _a === void 0 ? void 0 : _a.toLowerCase().includes(query.toLowerCase()); });
        }
        return options;
    };
    if (isLoading) {
        return (React.createElement(HorizontalGroup, { justify: "center" },
            React.createElement("span", null, "Loading..."),
            React.createElement(Spinner, { size: 16 })));
    }
    return (React.createElement("div", { "data-testid": "role-picker", style: {
            position: 'relative',
            maxWidth,
        }, ref: ref },
        React.createElement(ClickOutsideWrapper, { onClick: onClickOutside, useCapture: true },
            React.createElement(RolePickerInput, { basicRole: selectedBuiltInRole, appliedRoles: selectedRoles, query: query, onQueryChange: onInputChange, onOpen: onOpen, onClose: onClose, isFocused: isOpen, disabled: disabled, showBasicRole: showBasicRole }),
            isOpen && (React.createElement(RolePickerMenu, { options: getOptions(), basicRole: selectedBuiltInRole, appliedRoles: appliedRoles, onBasicRoleSelect: onBasicRoleSelect, onSelect: onSelect, onUpdate: onUpdate, showGroups: query.length === 0 || query.trim() === '', basicRoleDisabled: basicRoleDisabled, disabledMessage: basicRoleDisabledMessage, showBasicRole: showBasicRole, updateDisabled: basicRoleDisabled && !canUpdateRoles, apply: apply, offset: offset })))));
};
//# sourceMappingURL=RolePicker.js.map