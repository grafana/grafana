import { __awaiter } from "tslib";
import { cx } from '@emotion/css';
import React from 'react';
import { Button, CustomScrollbar, HorizontalGroup, useStyles2, useTheme2 } from '@grafana/ui';
import { getSelectStyles } from '@grafana/ui/src/components/Select/getSelectStyles';
import { RoleMenuOption } from './RoleMenuOption';
import { MENU_MAX_HEIGHT } from './constants';
import { getStyles } from './styles';
import { isNotDelegatable } from './utils';
export const RolePickerSubMenu = ({ options, selectedOptions, disabledOptions, onSelect, onClear, showOnLeft, }) => {
    const theme = useTheme2();
    const styles = getSelectStyles(theme);
    const customStyles = useStyles2(getStyles);
    const onClearInternal = () => __awaiter(void 0, void 0, void 0, function* () {
        if (onClear) {
            onClear();
        }
    });
    return (React.createElement("div", { className: cx(customStyles.subMenu, { [customStyles.subMenuLeft]: showOnLeft }), "aria-label": "Role picker submenu" },
        React.createElement(CustomScrollbar, { autoHide: false, autoHeightMax: `${MENU_MAX_HEIGHT}px`, hideHorizontalTrack: true },
            React.createElement("div", { className: styles.optionBody }, options.map((option, i) => (React.createElement(RoleMenuOption, { data: option, key: i, isSelected: !!(option.uid &&
                    (!!selectedOptions.find((opt) => opt.uid === option.uid) ||
                        (disabledOptions === null || disabledOptions === void 0 ? void 0 : disabledOptions.find((opt) => opt.uid === option.uid)))), disabled: !!(option.uid && (disabledOptions === null || disabledOptions === void 0 ? void 0 : disabledOptions.find((opt) => opt.uid === option.uid))) || isNotDelegatable(option), onChange: onSelect, hideDescription: true }))))),
        React.createElement("div", { className: customStyles.subMenuButtonRow },
            React.createElement(HorizontalGroup, { justify: "flex-end" },
                React.createElement(Button, { size: "sm", fill: "text", onClick: onClearInternal }, "Clear")))));
};
//# sourceMappingURL=RolePickerSubMenu.js.map