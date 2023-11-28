import { useEffect, useState } from 'react';
import { useEffectOnce } from 'react-use';
const modulo = (a, n) => ((a % n) + n) % n;
const UNFOCUSED = -1;
/** @internal */
export const useMenuFocus = ({ localRef, isMenuOpen, openedWithArrow, setOpenedWithArrow, close, onOpen, onClose, onKeyDown, }) => {
    const [focusedItem, setFocusedItem] = useState(UNFOCUSED);
    useEffect(() => {
        if (isMenuOpen && openedWithArrow) {
            setFocusedItem(0);
            setOpenedWithArrow === null || setOpenedWithArrow === void 0 ? void 0 : setOpenedWithArrow(false);
        }
    }, [isMenuOpen, openedWithArrow, setOpenedWithArrow]);
    useEffect(() => {
        var _a, _b;
        const menuItems = (_a = localRef === null || localRef === void 0 ? void 0 : localRef.current) === null || _a === void 0 ? void 0 : _a.querySelectorAll('[data-role="menuitem"]:not([data-disabled])');
        (_b = menuItems === null || menuItems === void 0 ? void 0 : menuItems[focusedItem]) === null || _b === void 0 ? void 0 : _b.focus();
        menuItems === null || menuItems === void 0 ? void 0 : menuItems.forEach((menuItem, i) => {
            menuItem.tabIndex = i === focusedItem ? 0 : -1;
        });
    }, [localRef, focusedItem]);
    useEffectOnce(() => {
        onOpen === null || onOpen === void 0 ? void 0 : onOpen(setFocusedItem);
    });
    const handleKeys = (event) => {
        var _a, _b, _c;
        const menuItems = (_a = localRef === null || localRef === void 0 ? void 0 : localRef.current) === null || _a === void 0 ? void 0 : _a.querySelectorAll('[data-role="menuitem"]:not([data-disabled])');
        const menuItemsCount = (_b = menuItems === null || menuItems === void 0 ? void 0 : menuItems.length) !== null && _b !== void 0 ? _b : 0;
        switch (event.key) {
            case 'ArrowUp':
                event.preventDefault();
                event.stopPropagation();
                setFocusedItem(modulo(focusedItem - 1, menuItemsCount));
                break;
            case 'ArrowDown':
                event.preventDefault();
                event.stopPropagation();
                setFocusedItem(modulo(focusedItem + 1, menuItemsCount));
                break;
            case 'ArrowLeft':
                event.preventDefault();
                event.stopPropagation();
                setFocusedItem(UNFOCUSED);
                close === null || close === void 0 ? void 0 : close();
                break;
            case 'Home':
                event.preventDefault();
                event.stopPropagation();
                setFocusedItem(0);
                break;
            case 'End':
                event.preventDefault();
                event.stopPropagation();
                setFocusedItem(menuItemsCount - 1);
                break;
            case 'Enter':
                event.preventDefault();
                event.stopPropagation();
                (_c = menuItems === null || menuItems === void 0 ? void 0 : menuItems[focusedItem]) === null || _c === void 0 ? void 0 : _c.click();
                break;
            case 'Escape':
                onClose === null || onClose === void 0 ? void 0 : onClose();
                break;
            case 'Tab':
                event.preventDefault();
                onClose === null || onClose === void 0 ? void 0 : onClose();
                break;
            default:
                break;
        }
        // Forward event to parent
        onKeyDown === null || onKeyDown === void 0 ? void 0 : onKeyDown(event);
    };
    return [handleKeys];
};
//# sourceMappingURL=hooks.js.map