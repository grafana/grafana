import { __assign } from "tslib";
import React from 'react';
import { useTheme2 } from '../../themes/ThemeContext';
import { getSelectStyles } from './getSelectStyles';
import { cx } from '@emotion/css';
import { CustomScrollbar } from '../CustomScrollbar/CustomScrollbar';
import { Icon } from '../Icon/Icon';
export var SelectMenu = React.forwardRef(function (props, ref) {
    var theme = useTheme2();
    var styles = getSelectStyles(theme);
    var children = props.children, maxHeight = props.maxHeight, innerRef = props.innerRef, innerProps = props.innerProps;
    return (React.createElement("div", __assign({}, innerProps, { className: styles.menu, ref: innerRef, style: { maxHeight: maxHeight }, "aria-label": "Select options menu" }),
        React.createElement(CustomScrollbar, { autoHide: false, autoHeightMax: "inherit", hideHorizontalTrack: true }, children)));
});
SelectMenu.displayName = 'SelectMenu';
export var SelectMenuOptions = React.forwardRef(function (props, ref) {
    var theme = useTheme2();
    var styles = getSelectStyles(theme);
    var children = props.children, innerProps = props.innerProps, data = props.data, renderOptionLabel = props.renderOptionLabel, isSelected = props.isSelected, isFocused = props.isFocused;
    return (React.createElement("div", __assign({ ref: ref, className: cx(styles.option, isFocused && styles.optionFocused, isSelected && styles.optionSelected) }, innerProps, { "aria-label": "Select option" }),
        data.icon && React.createElement(Icon, { name: data.icon, className: styles.optionIcon }),
        data.imgUrl && React.createElement("img", { className: styles.optionImage, src: data.imgUrl, alt: data.label || data.value }),
        React.createElement("div", { className: styles.optionBody },
            React.createElement("span", null, renderOptionLabel ? renderOptionLabel(data) : children),
            data.description && React.createElement("div", { className: styles.optionDescription }, data.description),
            data.component && React.createElement(data.component, null))));
});
SelectMenuOptions.displayName = 'SelectMenuOptions';
//# sourceMappingURL=SelectMenu.js.map