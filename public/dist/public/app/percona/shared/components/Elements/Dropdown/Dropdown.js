import { __awaiter } from "tslib";
/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/consistent-type-assertions */
import { cx } from '@emotion/css';
import React, { memo, useEffect, useRef, useState } from 'react';
import { usePopper } from 'react-popper';
import { useStyles2 } from '@grafana/ui';
import { getStyles } from './Dropdown.styles';
const popperConfig = {
    placement: 'bottom',
    modifiers: [
        {
            name: 'offset',
            enabled: true,
            options: {
                offset: [0, 2],
            },
        },
        {
            name: 'preventOverflow',
            options: {
                altAxis: true,
                padding: 12,
            },
        },
    ],
};
export const Dropdown = memo(function Dropdown({ className, children, toggle: Toggle }) {
    const styles = useStyles2(getStyles);
    const [visible, setVisible] = useState(false);
    const size = React.Children.count(children);
    const toggleRef = useRef(null);
    const popperRef = useRef(null);
    // NOTE: -1 is used to indicate that there are no active menu items
    const [activeIndex, setActiveIndex] = useState(-1);
    // TODO: find a way to improve this
    const childrenArray = size > 1 ? children : React.Children.toArray(children);
    const menuItems = React.Children.map(childrenArray, (child, index) => React.cloneElement(child, Object.assign(Object.assign({}, child.props), { onClick: () => {
            setActiveIndex(index);
            child.props.onClick();
        }, className: cx(child.props.className, { active: index === activeIndex }) })));
    const { styles: popperStyles, attributes: popperAttributes, update: updatePopper, } = usePopper(toggleRef.current, popperRef.current, popperConfig);
    const handleDocumentClick = (event) => {
        var _a, _b;
        if (((_a = toggleRef.current) === null || _a === void 0 ? void 0 : _a.contains(event.target)) || ((_b = popperRef.current) === null || _b === void 0 ? void 0 : _b.contains(event.target))) {
            return;
        }
        setVisible(false);
    };
    const handleDropdownClick = () => __awaiter(this, void 0, void 0, function* () {
        setVisible((oldValue) => !oldValue);
        if (updatePopper != null) {
            yield updatePopper();
        }
    });
    useEffect(() => {
        const up = ['ArrowUp', 'ArrowLeft'];
        const down = ['ArrowDown', 'ArrowRight'];
        const handleKeyupClick = (event) => {
            if (!visible) {
                return;
            }
            const { code } = event;
            if (up.includes(code)) {
                setActiveIndex((currentIndex) => (currentIndex === 0 ? size - 1 : currentIndex - 1));
                event.preventDefault();
            }
            if (down.includes(code)) {
                setActiveIndex((currentIndex) => (currentIndex === size - 1 ? 0 : currentIndex + 1));
                event.preventDefault();
            }
            if (code === 'Escape') {
                setVisible(false);
            }
            if (code === 'Enter' && activeIndex !== -1) {
                const menuItem = React.Children.toArray(children).find((_, index) => index === activeIndex);
                if (menuItem) {
                    menuItem.props.onClick();
                    setVisible(false);
                }
            }
        };
        const handleKeydownClick = (event) => {
            if (visible) {
                event.preventDefault();
            }
        };
        document.addEventListener('mousedown', handleDocumentClick);
        document.addEventListener('keyup', handleKeyupClick);
        document.addEventListener('keydown', handleKeydownClick);
        return () => {
            document.removeEventListener('mousedown', handleDocumentClick);
            document.removeEventListener('keyup', handleKeyupClick);
            document.removeEventListener('keydown', handleKeydownClick);
            // on close reset index
            if (!visible) {
                setActiveIndex(-1);
            }
        };
    }, [activeIndex, children, size, visible]);
    return (React.createElement(React.Fragment, null,
        React.createElement("div", { ref: toggleRef },
            React.createElement(Toggle, { onClick: handleDropdownClick, "data-testid": "dropdown-menu-toggle" })),
        React.createElement("div", Object.assign({ ref: popperRef, style: popperStyles.popper, className: styles.dropdown }, popperAttributes.popper, { "data-testid": "dropdown-menu-container" }), visible ? (
        // eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions
        React.createElement("div", { className: cx(styles.dropdownMenu, className), style: popperStyles.offset, "data-testid": "dropdown-menu-menu", onClick: handleDropdownClick }, menuItems)) : null)));
});
//# sourceMappingURL=Dropdown.js.map